import { SlashCommandBuilder, ChatInputCommandInteraction, Client, TextChannel, Collection, Message } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { getEconomySettings, getOrCreateWallet } from '../../services/economy';
import { getMinigameSettings, createGameSession, getActiveSession, updateGameSession, endGameSession } from '../../services/minigames';
import { successEmbed, errorEmbed, createEmbed } from '../../services/embed';
import { isModuleEnabled } from '../../guards/module';

const GAMES_TIMEOUT = 60000; // 1 minute per guess attempt

export const data = new SlashCommandBuilder()
  .setName('guess')
  .setDescription('Devinette de nombre - Devinez le nombre mystère')
  .addIntegerOption((opt) =>
    opt.setName('mise')
      .setDescription('Mise en coins (0 pour jouer sans mise)')
      .setRequired(false)
      .setMinValue(0)
  );

export const module = 'minigames';

export async function execute(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guild) return;

  try {
    if (!(await isModuleEnabled(interaction.guild.id, 'minigames'))) {
      await interaction.editReply({ embeds: [errorEmbed('Module désactivé', 'Le module minijeux est désactivé sur ce serveur.')] });
      return;
    }

    const settings = await getMinigameSettings(interaction.guild.id);
    const economySettings = await getEconomySettings(interaction.guild.id);
    
    const bet = interaction.options.getInteger('mise') ?? 0;

    // Check if user has an active session
    const activeSession = await getActiveSession(interaction.user.id, 'guess');
    if (activeSession) {
      const gameState = JSON.parse(activeSession.gameState || '{}');
      const remainingAttempts = gameState.maxAttempts - gameState.attempts;
      
      await interaction.editReply({ 
        embeds: [errorEmbed('Session active', 'Vous avez déjà une partie en cours. Il vous reste ' + remainingAttempts + ' essais pour deviner le nombre entre 1 et ' + settings.guessRange + '.')] 
      });
      return;
    }

    // Check bet limits
    if (bet > 0) {
      if (bet < settings.betMin || bet > settings.betMax) {
        await interaction.editReply({ 
          embeds: [errorEmbed('Mise invalide', 'La mise doit être entre ' + settings.betMin + ' et ' + settings.betMax + ' ' + economySettings.currencySymbol + '.')] 
        });
        return;
      }

      await ensureUser(interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL());
      const wallet = await getOrCreateWallet(interaction.guild!.id, interaction.user.id, economySettings.startupBalance);
      
      if (wallet.wallet < bet) {
        await interaction.editReply({ 
          embeds: [errorEmbed('Fonds insuffisants', 'Vous n\'avez que ' + wallet.wallet + ' ' + economySettings.currencySymbol + ' dans votre portefeuille.')] 
        });
        return;
      }

      // Deduct bet
      await prisma.economyWallet.update({
        where: { guildId_userId: { guildId: interaction.guild!.id, userId: interaction.user.id } },
        data: { wallet: { decrement: bet } },
      });
    }

    // Generate random number
    const secretNumber = Math.floor(Math.random() * settings.guessRange) + 1;
    const maxAttempts = Math.max(5, Math.floor(Math.log2(settings.guessRange)));
    
    // Create game session
    const gameState = {
      secretNumber,
      attempts: 0,
      maxAttempts,
      range: settings.guessRange,
    };

    const session = await createGameSession(
      interaction.guild!.id,
      interaction.user.id,
      'guess',
      bet,
      interaction.channelId,
      interaction.id
    );

    await updateGameSession(session.id, {
      gameState: JSON.stringify(gameState),
    });

    const embed = createEmbed('minigame')
      .setTitle('🔢 Devinette de Nombre')
      .setDescription('Devinez le nombre mystère entre **1** et **' + settings.guessRange + '** !')
      .addFields(
        { name: 'Essais restants', value: String(maxAttempts), inline: true },
        { name: 'Mise', value: bet > 0 ? String(bet) + ' ' + economySettings.currencySymbol : 'Gratuit', inline: true },
        { name: 'Gain potentiel', value: String(settings.guessReward) + ' ' + economySettings.currencySymbol, inline: true }
      )
      .setFooter({ text: 'Répondez avec un nombre pour deviner !' })
      .setTimestamp();

    const message = await interaction.editReply({ embeds: [embed] });

    // Set up message collector for guesses
    if (!interaction.channel || !interaction.channel.isTextBased()) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de créer le collecteur de messages dans ce type de canal.')] });
      return;
    }

    const collector = (interaction.channel as TextChannel).createMessageCollector({
      filter: (msg: Message) => msg.author.id === interaction.user.id && !msg.author.bot,
      time: 300000, // 5 minutes total
      max: maxAttempts,
    });

    collector.on('collect', async (msg: Message) => {
      const guess = parseInt(msg.content);
      
      if (isNaN(guess)) {
        await msg.reply({ content: 'Veuillez entrer un nombre valide.' });
        return;
      }

      gameState.attempts++;
      const remainingAttempts = maxAttempts - gameState.attempts;

      if (guess === secretNumber) {
        collector.stop();
        
        let winnings = bet > 0 ? Math.floor(bet * 2) + settings.guessReward : settings.guessReward;
        
        await prisma.economyWallet.update({
          where: { guildId_userId: { guildId: interaction.guild!.id, userId: interaction.user.id } },
          data: { 
            wallet: { increment: winnings },
            totalEarned: { increment: winnings }
          },
        });

        await prisma.economyTransaction.create({
          data: {
            guildId: interaction.guild!.id,
            toUserId: interaction.user.id,
            amount: winnings,
            type: 'GAMBLE',
            description: 'Devinette - Gagné',
          },
        });

        await endGameSession(session.id, 'won');

        const winEmbed = createEmbed('minigame')
          .setTitle('🎉 Bravo !')
          .setDescription('Vous avez trouvé le nombre mystère : **' + secretNumber + '**')
          .addFields(
            { name: 'Essais utilisés', value: String(gameState.attempts), inline: true },
            { name: 'Gain', value: '+' + String(winnings) + ' ' + economySettings.currencySymbol, inline: true }
          )
          .setColor(0x22c55e)
          .setTimestamp();

        await msg.reply({ embeds: [winEmbed] });
        try {
          await message.edit({ embeds: [winEmbed] });
        } catch (e) {
          // Message might have been deleted
        }
      } else if (remainingAttempts <= 0) {
        collector.stop();
        
        await endGameSession(session.id, 'lost');

        const loseEmbed = createEmbed('minigame')
          .setTitle('😢 Perdu !')
          .setDescription('Le nombre mystère était : **' + secretNumber + '**')
          .addFields(
            { name: 'Essais utilisés', value: String(gameState.attempts), inline: true },
          )
          .setColor(0xef4444)
          .setTimestamp();

        await msg.reply({ embeds: [loseEmbed] });
        try {
          await message.edit({ embeds: [loseEmbed] });
        } catch (e) {
          // Message might have been deleted
        }
      } else {
        const hint = guess < secretNumber ? '📈 Plus grand !' : '📉 Plus petit !';
        
        await updateGameSession(session.id, {
          gameState: JSON.stringify(gameState),
        });

        const updateEmbed = createEmbed('minigame')
          .setTitle('🔢 Devinette de Nombre')
          .setDescription(hint)
          .addFields(
            { name: 'Votre proposition', value: String(guess), inline: true },
            { name: 'Essais restants', value: String(remainingAttempts), inline: true },
            { name: 'Gain potentiel', value: String(settings.guessReward) + ' ' + economySettings.currencySymbol, inline: true }
          )
          .setFooter({ text: 'Continuez à deviner !' })
          .setTimestamp();

        await msg.reply({ embeds: [updateEmbed] });
        
        try {
          await message.edit({ embeds: [updateEmbed] });
        } catch (e) {
          // Message might have been deleted
        }
      }
    });

    collector.on('end', async (collected: Collection<string, Message>, reason: string) => {
      if (reason === 'time') {
        await endGameSession(session.id, 'timeout');

        // Return bet on timeout
        if (bet > 0) {
          await prisma.economyWallet.update({
            where: { guildId_userId: { guildId: interaction.guild!.id, userId: interaction.user.id } },
            data: { wallet: { increment: bet } },
          });
        }

        const timeoutEmbed = createEmbed('minigame')
          .setTitle('⏱️ Temps écoulé')
          .setDescription('Le nombre mystère était : **' + secretNumber + '**')
          .setColor(0xf59e0b)
          .setTimestamp();

        try {
          await message.edit({ embeds: [timeoutEmbed] });
        } catch (e) {
          // Message might have been deleted
        }
      }
    });

  } catch (error) {
    console.error('Guess game error:', error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Une erreur est survenue lors de la partie.')] });
  }
}