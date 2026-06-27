import { SlashCommandBuilder, ChatInputCommandInteraction, Client, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ButtonInteraction } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { getEconomySettings, getOrCreateWallet } from '../../services/economy';
import { getMinigameSettings, createGameSession, getActiveSession, updateGameSession, endGameSession, minigameChannelError } from '../../services/minigames';
import { successEmbed, errorEmbed, createEmbed } from '../../services/embed';
import { isModuleEnabled } from '../../guards/module';
import { logger } from '@pinguin/shared';

type Player = 'R' | 'Y';
type Board = (Player | null)[][];

const COLS = 7;
const ROWS = 6;

const PLAYER_EMOJIS: Record<Player, string> = { R: '🔴', Y: '🟡' };

export const data = new SlashCommandBuilder()
  .setName('connect4')
  .setDescription('Jouez au Puissance 4')
  .addUserOption((opt) =>
    opt.setName('adversaire')
      .setDescription('L\'utilisateur contre qui vous voulez jouer')
      .setRequired(true)
  )
  .addIntegerOption((opt) =>
    opt.setName('mise')
      .setDescription('Mise en coins (0 pour jouer sans mise)')
      .setRequired(false)
      .setMinValue(0)
  );

export const module = 'minigames';

function createEmptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function checkWinner(board: Board): Player | 'draw' | null {
  const check = (cells: (Player | null)[]): Player | null => {
    for (let i = 0; i <= cells.length - 4; i++) {
      if (cells[i] && cells[i] === cells[i + 1] && cells[i] === cells[i + 2] && cells[i] === cells[i + 3]) {
        return cells[i]!;
      }
    }
    return null;
  };

  for (let row = 0; row < ROWS; row++) {
    const result = check(board[row]);
    if (result) return result;
  }

  for (let col = 0; col < COLS; col++) {
    const result = check(Array.from({ length: ROWS }, (_, r) => board[r][col]));
    if (result) return result;
  }

  for (let row = 0; row < ROWS - 3; row++) {
    for (let col = 0; col < COLS - 3; col++) {
      const cell = board[row][col];
      if (cell && cell === board[row + 1][col + 1] && cell === board[row + 2][col + 2] && cell === board[row + 3][col + 3]) {
        return cell;
      }
    }
  }

  for (let row = 3; row < ROWS; row++) {
    for (let col = 0; col < COLS - 3; col++) {
      const cell = board[row][col];
      if (cell && cell === board[row - 1][col + 1] && cell === board[row - 2][col + 2] && cell === board[row - 3][col + 3]) {
        return cell;
      }
    }
  }

  if (board.every(row => row.every(cell => cell !== null))) return 'draw';
  return null;
}

function getAvailableRow(board: Board, col: number): number {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row][col] === null) return row;
  }
  return -1;
}

function buildBoardComponents(board: Board, disabled: boolean = false): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>();
  for (let col = 0; col < COLS; col++) {
    const isFull = getAvailableRow(board, col) === -1;
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`c4_${col}`)
        .setLabel(`${col + 1}`)
        .setStyle(isFull ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(disabled || isFull)
    );
  }
  return [row];
}

function formatBoard(board: Board): string {
  let display = '';
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      display += (board[row][col] ? PLAYER_EMOJIS[board[row][col]!] : '⚪') + ' ';
    }
    display += '\n';
  }
  display += '1 2 3 4 5 6 7';
  return display;
}

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guild) return;

  try {
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

    const opponent = interaction.options.getUser('adversaire', true);
    const bet = interaction.options.getInteger('mise') ?? 0;

    if (opponent.bot) {
      await interaction.editReply({ embeds: [errorEmbed('Adversaire invalide', 'Vous ne pouvez pas jouer contre un bot.')] });
      return;
    }

    if (opponent.id === interaction.user.id) {
      await interaction.editReply({ embeds: [errorEmbed('Adversaire invalide', 'Vous ne pouvez pas jouer contre vous-même.')] });
      return;
    }

    const activeSession1 = await getActiveSession(interaction.user.id, 'connect4');
    if (activeSession1) {
      await interaction.editReply({ embeds: [errorEmbed('Session active', 'Vous avez déjà une partie en cours.')] });
      return;
    }

    const activeSession2 = await getActiveSession(opponent.id, 'connect4');
    if (activeSession2) {
      await interaction.editReply({ embeds: [errorEmbed('Session active', 'Votre adversaire a déjà une partie en cours.')] });
      return;
    }

    if (bet > 0) {
      if (bet < settings.betMin || bet > settings.betMax) {
        await interaction.editReply({
          embeds: [errorEmbed('Mise invalide', `La mise doit être entre ${settings.betMin} et ${settings.betMax} ${economySettings.currencySymbol}.`)]
        });
        return;
      }

      await ensureUser(interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL());
      await ensureUser(opponent.id, opponent.username, opponent.displayAvatarURL());

      const wallet1 = await getOrCreateWallet(interaction.guild.id, interaction.user.id, economySettings.startupBalance);
      const wallet2 = await getOrCreateWallet(interaction.guild.id, opponent.id, economySettings.startupBalance);

      if (wallet1.wallet < bet) {
        await interaction.editReply({ embeds: [errorEmbed('Fonds insuffisants', `Vous n'avez que ${wallet1.wallet} ${economySettings.currencySymbol}.`)] });
        return;
      }

      if (wallet2.wallet < bet) {
        await interaction.editReply({ embeds: [errorEmbed('Fonds insuffisants', `Votre adversaire n'a que ${wallet2.wallet} ${economySettings.currencySymbol}.`)] });
        return;
      }
    }

    const board: Board = createEmptyBoard();
    const players = { playerR: interaction.user.id, playerY: opponent.id };
    const state = { board, currentPlayer: players.playerR as string, ...players };
    const totalPool = bet * 2;

    const message = await interaction.editReply({
      embeds: [buildGameEmbed(state, interaction.user, opponent, bet, economySettings.currencySymbol)],
      components: buildBoardComponents(board),
    });

    const session = await createGameSession(
      interaction.guild.id,
      interaction.user.id,
      'connect4',
      bet,
      interaction.channelId,
      message.id,
      opponent.id
    );

    await updateGameSession(session.id, { gameState: JSON.stringify(state) });

    if (bet > 0) {
      await prisma.$transaction([
        prisma.economyWallet.update({
          where: { guildId_userId: { guildId: interaction.guild!.id, userId: interaction.user.id } },
          data: { wallet: { decrement: bet } },
        }),
        prisma.economyWallet.update({
          where: { guildId_userId: { guildId: interaction.guild!.id, userId: opponent.id } },
          data: { wallet: { decrement: bet } },
        }),
      ]);
    }

    const validPlayers = new Set([interaction.user.id, opponent.id]);
    let gameOver = false;
    let turnTimeoutId: NodeJS.Timeout | null = null;

    const clearTurnTimeout = () => {
      if (turnTimeoutId) { clearTimeout(turnTimeoutId); turnTimeoutId = null; }
    };

    const resetTurnTimeout = () => {
      clearTurnTimeout();
      turnTimeoutId = setTimeout(() => {
        collector.stop('turn_timeout');
      }, 60000);
    };

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i: ButtonInteraction) => validPlayers.has(i.user.id),
      time: 600000,
    });

    resetTurnTimeout();

    collector.on('collect', async (i: ButtonInteraction) => {
      if (gameOver) {
        await i.reply({ content: 'Cette partie est terminée.', ephemeral: true });
        return;
      }

      if (i.user.id !== state.currentPlayer) {
        await i.reply({ content: "Ce n'est pas votre tour !", ephemeral: true });
        return;
      }

      clearTurnTimeout();

      const col = parseInt(i.customId.split('_')[1], 10);
      const row = getAvailableRow(state.board, col);

      if (row === -1) {
        await i.reply({ content: 'Cette colonne est pleine !', ephemeral: true });
        resetTurnTimeout();
        return;
      }

      const symbol: Player = state.currentPlayer === state.playerR ? 'R' : 'Y';
      state.board[row][col] = symbol;
      state.currentPlayer = state.currentPlayer === state.playerR ? state.playerY : state.playerR;

      const winner = checkWinner(state.board);

      if (winner) {
        gameOver = true;
        collector.stop();

        let winnings = 0;
        let winnerId: string | null = null;

        if (winner === 'draw') {
          if (bet > 0) {
            await prisma.$transaction([
              prisma.economyWallet.update({
                where: { guildId_userId: { guildId: interaction.guild!.id, userId: state.playerR } },
                data: { wallet: { increment: bet } },
              }),
              prisma.economyWallet.update({
                where: { guildId_userId: { guildId: interaction.guild!.id, userId: state.playerY } },
                data: { wallet: { increment: bet } },
              }),
            ]);
          }
          await endGameSession(session.id, 'draw', 0);
        } else {
          winnerId = winner === 'R' ? state.playerR : state.playerY;

          if (bet > 0) {
            winnings = totalPool;
            await prisma.economyWallet.update({
              where: { guildId_userId: { guildId: interaction.guild!.id, userId: winnerId } },
              data: { wallet: { increment: winnings }, totalEarned: { increment: bet } },
            });
            await prisma.economyTransaction.create({
              data: {
                guildId: interaction.guild!.id,
                toUserId: winnerId,
                amount: winnings,
                type: 'GAMBLE',
                description: 'Puissance 4 - Gagné',
              },
            });
          } else {
            winnings = settings.connect4Reward ?? 0;
            await prisma.economyWallet.update({
              where: { guildId_userId: { guildId: interaction.guild!.id, userId: winnerId } },
              data: { wallet: { increment: winnings }, totalEarned: { increment: winnings } },
            });
          }

          const payoutForCreator = winnerId === state.playerR
            ? (bet > 0 ? bet : winnings)
            : (bet > 0 ? -bet : 0);
          await endGameSession(session.id, 'completed', payoutForCreator);
        }

        const embed = buildGameEmbed(state, interaction.user, opponent, bet, economySettings.currencySymbol, winner, winnerId);
        await i.update({ embeds: [embed], components: buildBoardComponents(state.board, true) });
        return;
      }

      await updateGameSession(session.id, { gameState: JSON.stringify(state) });
      await i.update({
        embeds: [buildGameEmbed(state, interaction.user, opponent, bet, economySettings.currencySymbol)],
        components: buildBoardComponents(state.board),
      });

      resetTurnTimeout();
    });

    collector.on('end', async (_collected, reason) => {
      clearTurnTimeout();
      if (gameOver) return;

      if (reason === 'time' || reason === 'turn_timeout') {
        if (bet > 0) {
          await prisma.$transaction([
            prisma.economyWallet.update({
              where: { guildId_userId: { guildId: interaction.guild!.id, userId: state.playerR } },
              data: { wallet: { increment: bet } },
            }),
            prisma.economyWallet.update({
              where: { guildId_userId: { guildId: interaction.guild!.id, userId: state.playerY } },
              data: { wallet: { increment: bet } },
            }),
          ]);
        }

        await endGameSession(session.id, 'timeout');

        const embed = createEmbed('minigame')
          .setTitle('⏱️ Temps écoulé')
          .setDescription(reason === 'turn_timeout'
            ? `<@${state.currentPlayer}> n'a pas joué à temps. Partie annulée, mises remboursées.`
            : 'Temps total écoulé. Partie annulée, mises remboursées.')
          .setTimestamp();

        try {
          await message.edit({ embeds: [embed], components: buildBoardComponents(state.board, true) });
        } catch { }
      }
    });

  } catch (error) {
    logger.error('Connect4 game error', { err: error instanceof Error ? error.message : String(error) });
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Une erreur est survenue lors de la partie.')] });
  }
}

function buildGameEmbed(
  state: { board: Board; currentPlayer: string; playerR: string; playerY: string },
  author: { toString(): string },
  opponent: { toString(): string },
  bet: number,
  currencySymbol: string,
  winner?: Player | 'draw' | null,
  winnerId?: string | null
) {
  const isDraw = winner === 'draw';
  const isOver = !!winner;

  const embed = createEmbed('minigame')
    .setTitle('🎮 Puissance 4')
    .setDescription(`${author} (🔴) vs ${opponent} (🟡)\n\n${formatBoard(state.board)}`)
    .addFields(
      {
        name: 'Tour',
        value: isOver
          ? 'Terminé'
          : `<@${state.currentPlayer}> (${state.currentPlayer === state.playerR ? '🔴' : '🟡'})`,
        inline: true,
      },
      {
        name: 'Mise',
        value: bet > 0 ? `${bet * 2} ${currencySymbol}` : 'Gratuit',
        inline: true,
      }
    );

  if (isDraw) {
    embed.addFields({ name: 'Résultat', value: '🤝 Égalité !', inline: false });
  } else if (winner && winnerId) {
    embed.addFields({ name: 'Résultat', value: `🎉 <@${winnerId}> a gagné !`, inline: false });
    if (bet > 0) {
      embed.addFields({ name: 'Gain', value: `+${bet * 2} ${currencySymbol}`, inline: true });
    } else {
      embed.addFields({ name: 'Gain', value: 'Gratuit', inline: true });
    }
  }

  return embed;
}
