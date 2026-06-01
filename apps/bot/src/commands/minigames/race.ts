import { SlashCommandBuilder, ChatInputCommandInteraction, Client, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { getEconomySettings, getOrCreateWallet } from '../../services/economy';
import { getMinigameSettings, createGameSession, getActiveSession, updateGameSession, endGameSession, minigameChannelError } from '../../services/minigames';
import { successEmbed, errorEmbed, createEmbed } from '../../services/embed';
import { isModuleEnabled } from '../../guards/module';
import { checkCooldown } from '../../guards/cooldown';

interface Horse {
  id: string;
  name: string;
  emoji: string;
  odds: number;
  multiplier: number;
  position: number;
  speed: number;
}

const HORSES: Horse[] = [
  { id: 'horse_1', name: 'Éclair', emoji: '⚡', odds: 0.35, multiplier: 1.5, position: 0, speed: 0 },
  { id: 'horse_2', name: 'Tempête', emoji: '🌪️', odds: 0.25, multiplier: 2.0, position: 0, speed: 0 },
  { id: 'horse_3', name: 'Comète', emoji: '☄️', odds: 0.20, multiplier: 2.5, position: 0, speed: 0 },
  { id: 'horse_4', name: 'Tornade', emoji: '🌀', odds: 0.12, multiplier: 3.5, position: 0, speed: 0 },
  { id: 'horse_5', name: 'Phénix', emoji: '🔥', odds: 0.06, multiplier: 5.0, position: 0, speed: 0 },
  { id: 'horse_6', name: 'Spectre', emoji: '👻', odds: 0.02, multiplier: 10.0, position: 0, speed: 0 },
];

const RACE_LENGTH = 100;
const RACE_ROUNDS = 10;

export const data = new SlashCommandBuilder()
  .setName('race')
  .setDescription('Course de chevaux - Pariez sur votre cheval et gagnez !')
  .addIntegerOption((opt) =>
    opt.setName('mise')
      .setDescription('Mise en coins')
      .setRequired(true)
      .setMinValue(1)
  );

export const module = 'minigames';

export async function execute(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guild) return;

  try {
    const cooldownCheck = checkCooldown(interaction, 'race', 5);
    if (!cooldownCheck.allowed) {
      await interaction.editReply({ embeds: [errorEmbed('Cooldown', cooldownCheck.message!)] });
      return;
    }

    if (!(await isModuleEnabled(interaction.guild.id, 'minigames'))) {
      await interaction.editReply({ embeds: [errorEmbed('Module désactivé', 'Le module minijeux est désactivé sur ce serveur.')] });
      return;
    }

    const settings = await getMinigameSettings(interaction.guild.id);
    const economySettings = await getEconomySettings(interaction.guild.id);

    const channelErr = minigameChannelError(settings, interaction.channelId);
    if (channelErr) {
      await interaction.editReply({ embeds: [errorEmbed('Mauvais salon', channelErr)] });
      return;
    }

    const bet = interaction.options.getInteger('mise', true);

    // Check if user has an active session
    const activeSession = await getActiveSession(interaction.user.id, 'horse_race');
    if (activeSession) {
      await interaction.editReply({ embeds: [errorEmbed('Session active', 'Vous avez déjà une course en cours.')] });
      return;
    }

    // Check bet limits
    if (bet < settings.betMin || bet > settings.betMax) {
      await interaction.editReply({ 
        embeds: [errorEmbed('Mise invalide', 'La mise doit être entre ' + settings.betMin + ' et ' + settings.betMax + ' ' + economySettings.currencySymbol + '.')] 
      });
      return;
    }

    await ensureUser(interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL());
    const wallet = await getOrCreateWallet(interaction.guild.id, interaction.user.id, economySettings.startupBalance);
    
    if (wallet.wallet < bet) {
      await interaction.editReply({ 
        embeds: [errorEmbed('Fonds insuffisants', 'Vous n\'avez que ' + wallet.wallet + ' ' + economySettings.currencySymbol + ' dans votre portefeuille.')] 
      });
      return;
    }

    // Create horse selection buttons
    const horseButtons = HORSES.map((horse) => 
      new ButtonBuilder()
        .setCustomId('race_select_' + horse.id)
        .setLabel(horse.emoji + ' ' + horse.name + ' (x' + horse.multiplier + ')')
        .setStyle(ButtonStyle.Primary)
    );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(horseButtons);

    const selectionEmbed = createEmbed('minigame')
      .setTitle('🏇 Course de Chevaux')
      .setDescription('Choisissez votre cheval pour la course !')
      .addFields(
        { name: 'Mise', value: String(bet) + ' ' + economySettings.currencySymbol, inline: true },
        { name: 'Gain potentiel', value: 'Jusqu\'à x10', inline: true }
      )
      .addFields(
        { name: '⚡ Éclair', value: 'Favori - x1.5', inline: true },
        { name: '🌪️ Tempête', value: 'x2.0', inline: true },
        { name: '☄️ Comète', value: 'x2.5', inline: true },
        { name: '🌀 Tornade', value: 'x3.5', inline: true },
        { name: '🔥 Phénix', value: 'x5.0', inline: true },
        { name: '👻 Spectre', value: 'Outsider - x10.0', inline: true }
      )
      .setTimestamp();

    const message = await interaction.editReply({ 
      embeds: [selectionEmbed],
      components: [row],
    });

    // Set up collector for horse selection
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000, // 1 minute to select
    });

    collector.on('collect', async (i) => {
      try {
        if (i.user.id !== interaction.user.id) {
          await i.reply({ content: "Ce n'est pas votre course !", ephemeral: true });
          return;
        }

        if (!i.customId.startsWith('race_select_')) {
          return;
        }

        const horseId = i.customId.replace('race_select_', '');
        const selectedHorse = HORSES.find((h) => h.id === horseId);

        if (!selectedHorse) {
          await i.reply({ content: 'Cheval invalide.', ephemeral: true });
          return;
        }

        collector.stop();

        // Deduct bet
        await prisma.economyWallet.update({
          where: { guildId_userId: { guildId: interaction.guild!.id, userId: interaction.user.id } },
          data: { wallet: { decrement: bet } },
        });

        // Initialize race state
        const raceHorses = HORSES.map((h) => ({ ...h, position: 0, speed: 0 }));
        
        const gameState = {
          horses: raceHorses,
          selectedHorseId: horseId,
          currentRound: 0,
          bet,
          gameOver: false,
        };

        const session = await createGameSession(
          interaction.guild!.id,
          interaction.user.id,
          'horse_race',
          bet,
          interaction.channelId,
          interaction.id
        );

        await updateGameSession(session.id, {
          gameState: JSON.stringify(gameState),
        });

        // Start race animation
        await runRaceAnimation(i, session, gameState, economySettings, interaction);
      } catch (err) {
        console.error('Race selection error:', err);
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time') {
        const timeoutEmbed = createEmbed('minigame')
          .setTitle('⏱️ Temps écoulé')
          .setDescription('Vous n\'avez pas sélectionné de cheval à temps.')
          .setColor(0xf59e0b)
          .setTimestamp();

        try {
          await message.edit({ 
            embeds: [timeoutEmbed],
            components: [],
          });
        } catch (e) {
          // Message might have been deleted
        }
      }
    });

  } catch (error) {
    console.error('Race game error:', error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Une erreur est survenue lors de la course.')] });
  }
}

async function runRaceAnimation(
  interaction: any,
  session: any,
  gameState: any,
  economySettings: any,
  originalInteraction: ChatInputCommandInteraction
): Promise<void> {
  const { horses, selectedHorseId, bet } = gameState;
  const selectedHorse = horses.find((h: Horse) => h.id === selectedHorseId);

  // Initial race embed
  const raceEmbed = createEmbed('minigame')
    .setTitle('🏇 Course en cours...')
    .setDescription('Les chevaux sont au départ !')
    .addFields(
      { name: 'Votre choix', value: selectedHorse.emoji + ' ' + selectedHorse.name + ' (x' + selectedHorse.multiplier + ')', inline: true },
      { name: 'Mise', value: String(bet) + ' ' + economySettings.currencySymbol, inline: true }
    )
    .setTimestamp();

  await interaction.update({ 
    embeds: [raceEmbed],
    components: [],
  });

  // Run race rounds
  for (let round = 0; round < RACE_ROUNDS; round++) {
    await new Promise((resolve) => setTimeout(resolve, 1500)); // 1.5s between rounds

    gameState.currentRound = round + 1;

    // Update horse positions with weighted random
    for (const horse of gameState.horses) {
      // Weighted speed based on odds (higher odds = faster)
      const baseSpeed = Math.random() * 15 + 5;
      const oddsBonus = horse.odds * 10;
      horse.speed = Math.floor(baseSpeed + oddsBonus);
      horse.position = Math.min(RACE_LENGTH, horse.position + horse.speed);
    }

    // Check if any horse finished
    const finishedHorse = gameState.horses.find((h: Horse) => h.position >= RACE_LENGTH);
    if (finishedHorse) {
      gameState.gameOver = true;
      break;
    }

    await updateGameSession(session.id, {
      gameState: JSON.stringify(gameState),
    });

    // Update embed with current positions
    const progressFields = gameState.horses.map((h: Horse) => {
      const progressBar = '█'.repeat(Math.floor(h.position / 5)) + '░'.repeat(20 - Math.floor(h.position / 5));
      return {
        name: h.emoji + ' ' + h.name,
        value: progressBar + ' (' + h.position + '/' + RACE_LENGTH + ')',
        inline: false,
      };
    });

    const roundEmbed = createEmbed('minigame')
      .setTitle('🏇 Tour ' + (round + 1) + '/' + RACE_ROUNDS)
      .setDescription('La course continue !')
      .addFields(...progressFields)
      .addFields(
        { name: 'Votre choix', value: selectedHorse.emoji + ' ' + selectedHorse.name, inline: true },
        { name: 'Position actuelle', value: String(gameState.horses.find((h: Horse) => h.id === selectedHorseId)?.position || 0) + '/' + RACE_LENGTH, inline: true }
      )
      .setTimestamp();

    try {
      await originalInteraction.editReply({ embeds: [roundEmbed] });
    } catch (e) {
      // Message might have been deleted
      return;
    }
  }

  // Determine winner if game not over
  if (!gameState.gameOver) {
    gameState.gameOver = true;
    gameState.horses.sort((a: Horse, b: Horse) => b.position - a.position);
  }

  const winner = gameState.horses[0];
  const isWinner = winner.id === selectedHorseId;

  let winnings = 0;
  let result = '';
  let resultColor = 0xef4444;

  if (isWinner) {
    winnings = Math.floor(bet * selectedHorse.multiplier);
    result = '🎉 Votre cheval a gagné !';
    resultColor = 0x22c55e;
  } else {
    result = '😢 Votre cheval a perdu...';
  }

  // Update wallet
  await prisma.economyWallet.update({
    where: { guildId_userId: { guildId: originalInteraction.guild!.id, userId: originalInteraction.user.id } },
    data: { 
      wallet: { increment: winnings },
      totalEarned: { increment: isWinner ? winnings - bet : 0 }
    },
  });

  // Create transaction
  await prisma.economyTransaction.create({
    data: {
      guildId: originalInteraction.guild!.id,
      toUserId: originalInteraction.user.id,
      amount: winnings,
      type: 'GAMBLE',
      description: 'Course de chevaux - ' + (isWinner ? 'Gagné avec ' + winner.name : 'Perdu, gagnant: ' + winner.name),
    },
  });

  await endGameSession(session.id, isWinner ? 'won' : 'lost', winnings - bet);

  // Final results embed
  const finalFields = gameState.horses.map((h: Horse, index: number) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
    return {
      name: medal + ' ' + h.emoji + ' ' + h.name,
      value: 'Position: ' + h.position + '/' + RACE_LENGTH,
      inline: true,
    };
  });

  const finalEmbed = createEmbed('minigame')
    .setTitle('🏁 Résultats de la course')
    .setDescription(result)
    .addFields(...finalFields)
    .addFields(
      { name: 'Vainqueur', value: winner.emoji + ' ' + winner.name, inline: true },
      { name: 'Gain', value: isWinner ? '+' + String(winnings) + ' ' + economySettings.currencySymbol : '-' + String(bet) + ' ' + economySettings.currencySymbol, inline: true }
    )
    .setColor(resultColor)
    .setTimestamp();

  try {
    await originalInteraction.editReply({ embeds: [finalEmbed] });
  } catch (e) {
    // Message might have been deleted
  }
}
