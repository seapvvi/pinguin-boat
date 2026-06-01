import { SlashCommandBuilder, ChatInputCommandInteraction, Client, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { getEconomySettings, getOrCreateWallet } from '../../services/economy';
import { getMinigameSettings, createGameSession, getActiveSession, updateGameSession, endGameSession, minigameChannelError } from '../../services/minigames';
import { successEmbed, errorEmbed, createEmbed } from '../../services/embed';
import { isModuleEnabled } from '../../guards/module';

type Player = 'R' | 'Y';
type Board = (Player | null)[][];

const COLS = 7;
const ROWS = 6;

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
  return Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
}

function checkWinner(board: Board): Player | 'draw' | null {
  // Check horizontal
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS - 3; col++) {
      const cell = board[row][col];
      if (cell && cell === board[row][col + 1] && cell === board[row][col + 2] && cell === board[row][col + 3]) {
        return cell;
      }
    }
  }

  // Check vertical
  for (let row = 0; row < ROWS - 3; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = board[row][col];
      if (cell && cell === board[row + 1][col] && cell === board[row + 2][col] && cell === board[row + 3][col]) {
        return cell;
      }
    }
  }

  // Check diagonal (top-left to bottom-right)
  for (let row = 0; row < ROWS - 3; row++) {
    for (let col = 0; col < COLS - 3; col++) {
      const cell = board[row][col];
      if (cell && cell === board[row + 1][col + 1] && cell === board[row + 2][col + 2] && cell === board[row + 3][col + 3]) {
        return cell;
      }
    }
  }

  // Check diagonal (bottom-left to top-right)
  for (let row = 3; row < ROWS; row++) {
    for (let col = 0; col < COLS - 3; col++) {
      const cell = board[row][col];
      if (cell && cell === board[row - 1][col + 1] && cell === board[row - 2][col + 2] && cell === board[row - 3][col + 3]) {
        return cell;
      }
    }
  }

  // Check for draw (board full)
  if (board.every(row => row.every(cell => cell !== null))) {
    return 'draw';
  }

  return null;
}

function getColumnHeight(board: Board, col: number): number {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row][col] === null) {
      return row;
    }
  }
  return -1; // Column is full
}

function createBoardButtons(board: Board, disabled: boolean = false): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  
  const buttonRow = new ActionRowBuilder<ButtonBuilder>();
  
  for (let col = 0; col < COLS; col++) {
    const isFull = getColumnHeight(board, col) === -1;
    
    const button = new ButtonBuilder()
      .setCustomId(`connect4_${col}`)
      .setLabel(`${col + 1}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled || isFull);
    
    buttonRow.addComponents(button);
  }
  
  rows.push(buttonRow);
  
  return rows;
}

function formatBoard(board: Board): string {
  const emojis: Record<Player, string> = { R: '🔴', Y: '🟡' };
  let display = '';
  
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = board[row][col];
      display += cell ? emojis[cell] : '⚪';
      if (col < COLS - 1) display += ' ';
    }
    display += '\n';
  }
  
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

    // Validate opponent
    if (opponent.bot) {
      await interaction.editReply({ embeds: [errorEmbed('Adversaire invalide', 'Vous ne pouvez pas jouer contre un bot.')] });
      return;
    }

    if (opponent.id === interaction.user.id) {
      await interaction.editReply({ embeds: [errorEmbed('Adversaire invalide', 'Vous ne pouvez pas jouer contre vous-même.')] });
      return;
    }

    // Check for active sessions
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

    // Check bet limits
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
        await interaction.editReply({ 
          embeds: [errorEmbed('Fonds insuffisants', `Vous n'avez que ${wallet1.wallet} ${economySettings.currencySymbol}.`)] 
        });
        return;
      }

      if (wallet2.wallet < bet) {
        await interaction.editReply({ 
          embeds: [errorEmbed('Fonds insuffisants', `Votre adversaire n'a que ${wallet2.wallet} ${economySettings.currencySymbol}.`)] 
        });
        return;
      }

      // Deduct bets
      await prisma.economyWallet.update({
        where: { guildId_userId: { guildId: interaction.guild!.id, userId: interaction.user.id } },
        data: { wallet: { decrement: bet } },
      });

      await prisma.economyWallet.update({
        where: { guildId_userId: { guildId: interaction.guild!.id, userId: opponent.id } },
        data: { wallet: { decrement: bet } },
      });
    }

    // Create game session
    const board: Board = createEmptyBoard();
    const gameState = {
      board,
      currentPlayer: interaction.user.id,
      playerR: interaction.user.id,
      playerY: opponent.id,
    };

    const session = await createGameSession(
      interaction.guild.id,
      interaction.user.id,
      'connect4',
      bet,
      interaction.channelId,
      interaction.id,
      opponent.id
    );

    await updateGameSession(session.id, {
      gameState: JSON.stringify(gameState),
    });

    // Send initial board
    const embed = createEmbed('minigame')
      .setTitle('🎮 Puissance 4')
      .setDescription(`${interaction.user} (🔴) vs ${opponent} (🟡)`)
      .addFields(
        { name: 'Plateau', value: `\`\`\`\n${formatBoard(board)}\n\`\`\``, inline: false },
        { name: 'Tour', value: `<@${interaction.user.id}> (🔴)`, inline: true },
        { name: 'Mise', value: bet > 0 ? `${bet * 2} ${economySettings.currencySymbol}` : 'Gratuit', inline: true }
      )
      .setTimestamp();

    const message = await interaction.editReply({ 
      embeds: [embed],
      components: createBoardButtons(board),
    });

    // Update session with message ID
    await updateGameSession(session.id, {
      gameState: JSON.stringify({ ...gameState, messageId: message.id }),
    });

    // Set up collector with 60s timeout per turn
    let turnTimeout: NodeJS.Timeout | null = null;
    let currentTurnStartTime = Date.now();
    const TURN_TIMEOUT = 60000; // 60 seconds

    const resetTurnTimeout = () => {
      if (turnTimeout) clearTimeout(turnTimeout);
      currentTurnStartTime = Date.now();
      turnTimeout = setTimeout(() => {
        collector.stop('turn_timeout');
      }, TURN_TIMEOUT);
    };

    resetTurnTimeout();

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 600000, // 10 minutes total
    });

    collector.on('collect', async (i) => {
     try {
      if (turnTimeout) clearTimeout(turnTimeout);

      if (i.user.id !== gameState.currentPlayer) {
        await i.reply({ content: "Ce n'est pas votre tour !", ephemeral: true });
        resetTurnTimeout();
        return;
      }

      const col = parseInt(i.customId.split('_')[1]);
      const row = getColumnHeight(board, col);
      
      if (row === -1) {
        await i.reply({ content: 'Cette colonne est pleine !', ephemeral: true });
        resetTurnTimeout();
        return;
      }

      // Make move
      const currentPlayerSymbol: Player = gameState.currentPlayer === gameState.playerR ? 'R' : 'Y';
      board[row][col] = currentPlayerSymbol;
      gameState.currentPlayer = gameState.currentPlayer === gameState.playerR ? gameState.playerY : gameState.playerR;

      // Check for winner
      const winner = checkWinner(board);
      
      const updatedEmbed = createEmbed('minigame')
        .setTitle('🎮 Puissance 4')
        .setDescription(`${interaction.user} (🔴) vs ${opponent} (🟡)`)
        .addFields(
          { name: 'Plateau', value: `\`\`\`\n${formatBoard(board)}\n\`\`\``, inline: false },
          { name: 'Tour', value: winner ? 'Terminé' : `<@${gameState.currentPlayer}> (${gameState.currentPlayer === gameState.playerR ? '🔴' : '🟡'})`, inline: true },
          { name: 'Mise', value: bet > 0 ? `${bet * 2} ${economySettings.currencySymbol}` : 'Gratuit', inline: true }
        );

      if (winner) {
        collector.stop();
        
        let winnings = 0;
        let winnerId: string | null = null;

        if (winner === 'draw') {
          updatedEmbed.addFields({ name: 'Résultat', value: '🤝 Égalité !', inline: false });
          
          // Return bets on draw
          if (bet > 0) {
            await prisma.economyWallet.update({
              where: { guildId_userId: { guildId: interaction.guild!.id, userId: interaction.user.id } },
              data: { wallet: { increment: bet } },
            });
            await prisma.economyWallet.update({
              where: { guildId_userId: { guildId: interaction.guild!.id, userId: opponent.id } },
              data: { wallet: { increment: bet } },
            });
          }
        } else {
          winnerId = winner === 'R' ? gameState.playerR : gameState.playerY;
          const winnerUser = await client.users.fetch(winnerId);
          updatedEmbed.addFields({ name: 'Résultat', value: `🎉 ${winnerUser} a gagné !`, inline: false });
          
          if (bet > 0) {
            winnings = bet * 2;
            await prisma.economyWallet.update({
              where: { guildId_userId: { guildId: interaction.guild!.id, userId: winnerId } },
              data: { 
                wallet: { increment: winnings },
                totalEarned: { increment: bet }
              },
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
            winnings = settings.connect4Reward;
            await prisma.economyWallet.update({
              where: { guildId_userId: { guildId: interaction.guild!.id, userId: winnerId } },
              data: { wallet: { increment: winnings }, totalEarned: { increment: winnings } },
            });
          }
          
          updatedEmbed.addFields({ name: 'Gain', value: `+${winnings} ${economySettings.currencySymbol}`, inline: true });
        }

        await updateGameSession(session.id, {
          gameState: JSON.stringify(gameState),
        });
        
        // Record the net result for the session creator (player R) for the leaderboard
        let creatorPayout = 0;
        if (winner !== 'draw' && winnerId) {
          if (winnerId === interaction.user.id) {
            creatorPayout = bet > 0 ? bet : winnings;
          } else {
            creatorPayout = bet > 0 ? -bet : 0;
          }
        }
        await endGameSession(session.id, winner === 'draw' ? 'draw' : 'completed', creatorPayout);

        await i.update({ 
          embeds: [updatedEmbed],
          components: createBoardButtons(board, true),
        });
      } else {
        await updateGameSession(session.id, {
          gameState: JSON.stringify(gameState),
        });

        await i.update({ 
          embeds: [updatedEmbed],
          components: createBoardButtons(board),
        });
        
        resetTurnTimeout();
      }
     } catch (err) {
       console.error('Connect4 interaction error:', err);
     }
    });

    collector.on('end', async (collected, reason) => {
      if (turnTimeout) clearTimeout(turnTimeout);
      
      if (reason === 'time' || reason === 'turn_timeout') {
        const timeoutEmbed = createEmbed('minigame')
          .setTitle('🎮 Puissance 4')
          .setDescription(reason === 'turn_timeout' 
            ? `Temps écoulé ! <@${gameState.currentPlayer}> n'a pas joué à temps.`
            : 'Temps écoulé ! La partie est annulée.')
          .setTimestamp();

        // Return bets on timeout
        if (bet > 0) {
          await prisma.economyWallet.update({
            where: { guildId_userId: { guildId: interaction.guild!.id, userId: interaction.user.id } },
            data: { wallet: { increment: bet } },
          });
          await prisma.economyWallet.update({
            where: { guildId_userId: { guildId: interaction.guild!.id, userId: opponent.id } },
            data: { wallet: { increment: bet } },
          });
        }

        await endGameSession(session.id, 'timeout');
        
        try {
          await message.edit({ 
            embeds: [timeoutEmbed],
            components: createBoardButtons(board, true),
          });
        } catch (e) {
          // Message might have been deleted
        }
      }
    });

  } catch (error) {
    console.error('Connect4 game error:', error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Une erreur est survenue lors de la partie.')] });
  }
}
