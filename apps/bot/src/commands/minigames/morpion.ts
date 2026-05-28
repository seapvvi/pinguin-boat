import { SlashCommandBuilder, ChatInputCommandInteraction, Client, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { getEconomySettings, getOrCreateWallet } from '../../services/economy';
import { getMinigameSettings, createGameSession, getActiveSession, updateGameSession, endGameSession } from '../../services/minigames';
import { successEmbed, errorEmbed, createEmbed } from '../../services/embed';
import { isModuleEnabled } from '../../guards/module';

type Player = 'X' | 'O';
type Board = (Player | null)[];

export const data = new SlashCommandBuilder()
  .setName('morpion')
  .setDescription('Jouez au Morpion (Tic-Tac-Toe)')
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

async function checkWinner(board: Board): Promise<Player | 'draw' | null> {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]              // Diagonals
  ];

  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  if (board.every(cell => cell !== null)) {
    return 'draw';
  }

  return null;
}

function createBoardButtons(board: Board, disabled: boolean = false): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  
  for (let i = 0; i < 3; i++) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    
    for (let j = 0; j < 3; j++) {
      const index = i * 3 + j;
      const cell = board[index];
      
      const button = new ButtonBuilder()
        .setCustomId(`morpion_${index}`)
        .setLabel(cell || ' ')
        .setStyle(cell === 'X' ? ButtonStyle.Primary : cell === 'O' ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(disabled || cell !== null);
      
      row.addComponents(button);
    }
    
    rows.push(row);
  }
  
  return rows;
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
    const activeSession1 = await getActiveSession(interaction.user.id, 'morpion');
    if (activeSession1) {
      await interaction.editReply({ embeds: [errorEmbed('Session active', 'Vous avez déjà une partie en cours.')] });
      return;
    }

    const activeSession2 = await getActiveSession(opponent.id, 'morpion');
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
    const board: Board = Array(9).fill(null);
    const gameState = {
      board,
      currentPlayer: interaction.user.id,
      playerX: interaction.user.id,
      playerO: opponent.id,
    };

    const session = await createGameSession(
      interaction.guild.id,
      interaction.user.id,
      'morpion',
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
      .setTitle('🎮 Morpion')
      .setDescription(`${interaction.user} (X) vs ${opponent} (O)`)
      .addFields(
        { name: 'Tour', value: `<@${interaction.user.id}> (X)`, inline: true },
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

    // Set up collector
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000, // 5 minutes
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== gameState.currentPlayer) {
        await i.reply({ content: "Ce n'est pas votre tour !", ephemeral: true });
        return;
      }

      const index = parseInt(i.customId.split('_')[1]);
      if (board[index] !== null) {
        await i.reply({ content: 'Cette case est déjà prise !', ephemeral: true });
        return;
      }

      // Make move
      const currentPlayerSymbol: Player = gameState.currentPlayer === gameState.playerX ? 'X' : 'O';
      board[index] = currentPlayerSymbol;
      gameState.currentPlayer = gameState.currentPlayer === gameState.playerX ? gameState.playerO : gameState.playerX;

      // Check for winner
      const winner = await checkWinner(board);
      
      const updatedEmbed = createEmbed('minigame')
        .setTitle('🎮 Morpion')
        .setDescription(`${interaction.user} (X) vs ${opponent} (O)`)
        .addFields(
          { name: 'Tour', value: winner ? 'Terminé' : `<@${gameState.currentPlayer}> (${gameState.currentPlayer === gameState.playerX ? 'X' : 'O'})`, inline: true },
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
          winnerId = winner === 'X' ? gameState.playerX : gameState.playerO;
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
                description: 'Morpion - Gagné',
              },
            });
          } else {
            winnings = settings.morpionReward;
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
        await endGameSession(session.id, winner === 'draw' ? 'draw' : 'completed');

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
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time') {
        const timeoutEmbed = createEmbed('minigame')
          .setTitle('🎮 Morpion')
          .setDescription('Temps écoulé ! La partie est annulée.')
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
    console.error('Morpion game error:', error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Une erreur est survenue lors de la partie.')] });
  }
}