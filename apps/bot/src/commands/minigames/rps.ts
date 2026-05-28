import { SlashCommandBuilder, ChatInputCommandInteraction, Client, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { getEconomySettings, getOrCreateWallet } from '../../services/economy';
import { getMinigameSettings, createGameSession, getActiveSession, endGameSession } from '../../services/minigames';
import { successEmbed, enrichedErrorEmbed, createEmbed } from '../../services/embed';
import { isModuleEnabled } from '../../guards/module';

const RPS_CHOICES = ['🪨', '📄', '✂️'] as const;
const RPS_NAMES = ['pierre', 'feuille', 'ciseaux'] as const;

type RPSChoice = typeof RPS_CHOICES[number];

export const data = new SlashCommandBuilder()
  .setName('rps')
  .setDescription('Jouez à Pierre-Feuille-Ciseaux')
  .addIntegerOption((opt) =>
    opt.setName('mise')
      .setDescription('Mise en coins (0 pour jouer sans mise)')
      .setRequired(false)
      .setMinValue(0)
  )
  .addStringOption((opt) =>
    opt.setName('choix')
      .setDescription('Votre choix')
      .setRequired(true)
      .addChoices(
        { name: '🪨 Pierre', value: 'pierre' },
        { name: '📄 Feuille', value: 'feuille' },
        { name: '✂️ Ciseaux', value: 'ciseaux' }
      )
  );

export const module = 'minigames';

export async function execute(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guild) return;

  try {
    if (!(await isModuleEnabled(interaction.guild.id, 'minigames'))) {
      await interaction.editReply({ 
        embeds: [enrichedErrorEmbed(
          'Module désactivé',
          'Le module minijeux est désactivé sur ce serveur.',
          'Activez le module minijeux dans les paramètres du serveur ou via le dashboard.'
        )] 
      });
      return;
    }

    const settings = await getMinigameSettings(interaction.guild.id);
    const economySettings = await getEconomySettings(interaction.guild.id);
    
    const bet = interaction.options.getInteger('mise') ?? 0;
    const choiceIndex = interaction.options.getString('choix', true);
    const choiceIndexNum = RPS_NAMES.indexOf(choiceIndex as any);
    
    if (choiceIndexNum === -1) {
      await interaction.editReply({ 
        embeds: [enrichedErrorEmbed(
          'Choix invalide',
          'Choisissez entre pierre, feuille ou ciseaux.',
          'Les options valides sont: pierre, feuille, ciseaux.'
        )] 
      });
      return;
    }

    const playerChoice: RPSChoice = RPS_CHOICES[choiceIndexNum];

    // Check if user has an active session
    const activeSession = await getActiveSession(interaction.user.id, 'rps');
    if (activeSession) {
      await interaction.editReply({ 
        embeds: [enrichedErrorEmbed(
          'Session active',
          'Vous avez déjà une partie en cours.',
          'Terminez votre partie actuelle avant d\'en commencer une nouvelle.'
        )] 
      });
      return;
    }

    // Check bet limits
    if (bet > 0) {
      if (bet < settings.betMin || bet > settings.betMax) {
        await interaction.editReply({ 
          embeds: [enrichedErrorEmbed(
            'Mise invalide',
            `La mise doit être entre ${settings.betMin} et ${settings.betMax} ${economySettings.currencySymbol}.`,
            'Les limites de mise peuvent être configurées dans les paramètres du serveur.'
          )] 
        });
        return;
      }

      await ensureUser(interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL());
      const wallet = await getOrCreateWallet(interaction.guild.id, interaction.user.id, economySettings.startupBalance);
      
      if (wallet.wallet < bet) {
        await interaction.editReply({ 
          embeds: [enrichedErrorEmbed(
            'Fonds insuffisants',
            `Vous n'avez que ${wallet.wallet} ${economySettings.currencySymbol} dans votre portefeuille.`,
            'Gagnez plus de coins en utilisant les commandes /daily et /work.'
          )] 
        });
        return;
      }

      // Deduct bet
      await prisma.economyWallet.update({
        where: { guildId_userId: { guildId: interaction.guild.id, userId: interaction.user.id } },
        data: { wallet: { decrement: bet } },
      });
    }

    // Bot choice
    const botChoiceIndex = Math.floor(Math.random() * 3);
    const botChoice: RPSChoice = RPS_CHOICES[botChoiceIndex];

    // Determine winner
    let result: 'win' | 'lose' | 'draw';
    if (playerChoice === botChoice) {
      result = 'draw';
    } else if (
      (playerChoice === '🪨' && botChoice === '✂️') ||
      (playerChoice === '📄' && botChoice === '🪨') ||
      (playerChoice === '✂️' && botChoice === '📄')
    ) {
      result = 'win';
    } else {
      result = 'lose';
    }

    // Calculate winnings
    let winnings = 0;
    if (result === 'win') {
      winnings = bet > 0 ? Math.floor(bet * 1.5) : settings.rpsReward;
    } else if (result === 'draw' && bet > 0) {
      winnings = bet; // Return bet on draw
    }

    // Update wallet if there was a bet
    if (bet > 0 && winnings > 0) {
      await prisma.economyWallet.update({
        where: { guildId_userId: { guildId: interaction.guild.id, userId: interaction.user.id } },
        data: { 
          wallet: { increment: winnings },
          totalEarned: { increment: result === 'win' ? winnings - bet : 0 }
        },
      });

      await prisma.economyTransaction.create({
        data: {
          guildId: interaction.guild.id,
          toUserId: interaction.user.id,
          amount: winnings,
          type: 'GAMBLE',
          description: `Pierre-Feuille-Ciseaux - ${result === 'win' ? 'Gagné' : result === 'draw' ? 'Remboursé' : 'Perdu'}`,
        },
      });
    } else if (winnings > 0) {
      // Free game reward
      await ensureUser(interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL());
      const wallet = await getOrCreateWallet(interaction.guild.id, interaction.user.id, economySettings.startupBalance);
      await prisma.economyWallet.update({
        where: { guildId_userId: { guildId: interaction.guild.id, userId: interaction.user.id } },
        data: { wallet: { increment: winnings }, totalEarned: { increment: winnings } },
      });
    }

    // Create game session for history
    const session = await createGameSession(
      interaction.guild.id,
      interaction.user.id,
      'rps',
      bet,
      interaction.channelId,
      interaction.id
    );

    await endGameSession(session.id, result);

    // Build response embed
    const embed = createEmbed('minigame')
      .setTitle('🎮 Pierre-Feuille-Ciseaux')
      .addFields(
        { name: 'Votre choix', value: playerChoice, inline: true },
        { name: 'Choix du bot', value: botChoice, inline: true },
        { name: 'Résultat', value: result === 'win' ? '🎉 Victoire !' : result === 'draw' ? '🤝 Égalité' : '😢 Défaite', inline: true }
      );

    if (bet > 0) {
      embed.addFields({
        name: 'Mise',
        value: `${bet} ${economySettings.currencySymbol}`,
        inline: true,
      });
    }

    if (winnings > 0) {
      embed.addFields({
        name: 'Gain',
        value: `+${winnings} ${economySettings.currencySymbol}`,
        inline: true,
      });
      embed.setColor(0x22c55e);
    } else if (result === 'lose' && bet > 0) {
      embed.setColor(0xef4444);
    }

    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('RPS game error:', error);
    await interaction.editReply({ 
      embeds: [enrichedErrorEmbed(
        'Erreur',
        'Une erreur est survenue lors de la partie.',
        'Veuillez réessayer ou contacter le support si le problème persiste.'
      )] 
    });
  }
}