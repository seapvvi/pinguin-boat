import { SlashCommandBuilder, ChatInputCommandInteraction, Client, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ButtonInteraction, Collection, Message } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { getEconomySettings, getOrCreateWallet } from '../../services/economy';
import { getMinigameSettings, createGameSession, getActiveSession, updateGameSession, endGameSession, minigameChannelError } from '../../services/minigames';
import { successEmbed, errorEmbed, createEmbed } from '../../services/embed';
import { isModuleEnabled } from '../../guards/module';
import { logger } from '@pinguin/shared';

const SUITS = ['♠️', '♥️', '♦️', '♣️'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

type Card = { suit: string; value: string };
type Hand = Card[];
type Player = {
  userId: string;
  username: string;
  hand: Hand;
  bet: number;
  currentBet: number;
  folded: boolean;
  allIn: boolean;
  wallet: number;
};
type PokerPhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

interface PokerGameState {
  deck: Hand;
  communityCards: Hand;
  players: Player[];
  phase: PokerPhase;
  pot: number;
  currentBet: number;
  dealerIndex: number;
  currentPlayerIndex: number;
  smallBlind: number;
  bigBlind: number;
  minRaise: number;
  gameOver: boolean;
}

function createDeck(): Hand {
  const deck: Hand = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ suit, value });
    }
  }
  return deck;
}

function shuffleDeck(deck: Hand): Hand {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function getCardValue(card: Card): number {
  const index = VALUES.indexOf(card.value);
  return index + 2;
}

function formatCard(card: Card): string {
  return card.value + card.suit;
}

function formatHand(hand: Hand): string {
  return hand.map(formatCard).join(' ');
}

function evaluateHand(hand: Hand, communityCards: Hand): { rank: number; name: string; value: number } {
  const allCards = [...hand, ...communityCards];
  const combinations = getCombinations(allCards, 5);
  
  let bestHand = { rank: 0, name: 'Hauteur', value: 0 };
  
  for (const combo of combinations) {
    const handEval = evaluateFiveCards(combo);
    if (handEval.rank > bestHand.rank || (handEval.rank === bestHand.rank && handEval.value > bestHand.value)) {
      bestHand = handEval;
    }
  }
  
  return bestHand;
}

function getCombinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length === 0) return [];
  
  const [first, ...rest] = arr;
  const combsWithFirst = getCombinations(rest, size - 1).map((comb) => [first, ...comb]);
  const combsWithoutFirst = getCombinations(rest, size);
  
  return [...combsWithFirst, ...combsWithoutFirst];
}

function evaluateFiveCards(cards: Hand): { rank: number; name: string; value: number } {
  const values = cards.map(getCardValue).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  
  const isFlush = suits.every((s) => s === suits[0]);
  const isStraight = checkStraight(values);
  const counts = getValueCounts(values);
  const countValues = Object.values(counts).sort((a, b) => b - a);
  
  // Royal Flush
  if (isFlush && isStraight && values[0] === 14) {
    return { rank: 10, name: 'Quinte Flush Royale', value: values[0] };
  }
  
  // Straight Flush
  if (isFlush && isStraight) {
    return { rank: 9, name: 'Quinte Flush', value: values[0] };
  }
  
  // Four of a Kind
  if (countValues[0] === 4) {
    return { rank: 8, name: 'Carré', value: values[0] };
  }
  
  // Full House
  if (countValues[0] === 3 && countValues[1] === 2) {
    return { rank: 7, name: 'Full', value: values[0] };
  }
  
  // Flush
  if (isFlush) {
    return { rank: 6, name: 'Couleur', value: values[0] };
  }
  
  // Straight
  if (isStraight) {
    return { rank: 5, name: 'Quinte', value: values[0] };
  }
  
  // Three of a Kind
  if (countValues[0] === 3) {
    return { rank: 4, name: 'Brelan', value: values[0] };
  }
  
  // Two Pair
  if (countValues[0] === 2 && countValues[1] === 2) {
    return { rank: 3, name: 'Deux Paires', value: values[0] };
  }
  
  // One Pair
  if (countValues[0] === 2) {
    return { rank: 2, name: 'Paire', value: values[0] };
  }
  
  // High Card
  return { rank: 1, name: 'Hauteur', value: values[0] };
}

function checkStraight(values: number[]): boolean {
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] - values[i + 1] !== 1) {
      // Check for A-2-3-4-5 straight
      if (i === 0 && values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
        return true;
      }
      return false;
    }
  }
  return true;
}

function getValueCounts(values: number[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const v of values) {
    counts[v] = (counts[v] || 0) + 1;
  }
  return counts;
}

function getNextActivePlayerIndex(gameState: PokerGameState, startIndex: number): number {
  let index = startIndex;
  const activePlayers = gameState.players.filter((p) => !p.folded && !p.allIn);
  
  if (activePlayers.length <= 1) return -1;
  
  do {
    index = (index + 1) % gameState.players.length;
  } while (gameState.players[index].folded || gameState.players[index].allIn);
  
  return index;
}

function allPlayersMatched(gameState: PokerGameState): boolean {
  const activePlayers = gameState.players.filter((p) => !p.folded && !p.allIn);
  if (activePlayers.length <= 1) return true;
  
  return activePlayers.every((p) => p.currentBet === gameState.currentBet);
}

export const data = new SlashCommandBuilder()
  .setName('poker')
  .setDescription('Jouez au Poker Texas Hold\'em')
  .addIntegerOption((opt) =>
    opt.setName('mise')
      .setDescription('Mise initiale (blind)')
      .setRequired(true)
      .setMinValue(10)
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

    const channelErr = minigameChannelError(settings, interaction.channelId);
    if (channelErr) {
      await interaction.editReply({ embeds: [errorEmbed('Mauvais salon', channelErr)] });
      return;
    }

    const bet = interaction.options.getInteger('mise', true);

    // Check if user has an active session
    const activeSession = await getActiveSession(interaction.user.id, 'poker');
    if (activeSession) {
      await interaction.editReply({ embeds: [errorEmbed('Session active', 'Vous avez déjà une partie de Poker en cours.')] });
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

    // Deduct initial bet
    await prisma.economyWallet.update({
      where: { guildId_userId: { guildId: interaction.guild!.id, userId: interaction.user.id } },
      data: { wallet: { decrement: bet } },
    });

    // Initialize game state
    const deck = shuffleDeck(createDeck());
    const smallBlind = Math.floor(bet / 2);
    const bigBlind = bet;

    const gameState: PokerGameState = {
      deck,
      communityCards: [],
      players: [{
        userId: interaction.user.id,
        username: interaction.user.username,
        hand: [deck.pop()!, deck.pop()!],
        bet,
        currentBet: bet,
        folded: false,
        allIn: false,
        wallet: wallet.wallet,
      }],
      phase: 'waiting',
      pot: bet,
      currentBet: bet,
      dealerIndex: 0,
      currentPlayerIndex: 0,
      smallBlind,
      bigBlind,
      minRaise: bigBlind,
      gameOver: false,
    };

    // Create game session
    const session = await createGameSession(
      interaction.guild.id,
      interaction.user.id,
      'poker',
      bet,
      interaction.channelId,
      interaction.id
    );

    await updateGameSession(session.id, {
      gameState: JSON.stringify(gameState),
    });

    // Send initial game state with join button
    const embed = createEmbed('minigame')
      .setTitle('🃏 Poker Texas Hold\'em')
      .setDescription('En attente de joueurs (2-4)...')
      .addFields(
        { name: 'Créateur', value: interaction.user.username, inline: true },
        { name: 'Mise initiale', value: String(bet) + ' ' + economySettings.currencySymbol, inline: true },
        { name: 'Joueurs', value: '1/4', inline: true },
        { name: 'Pot actuel', value: String(gameState.pot) + ' ' + economySettings.currencySymbol, inline: true }
      )
      .setColor(0x3b82f6)
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('poker_join_' + session.id)
          .setLabel('🎮 Rejoindre')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('poker_start_' + session.id)
          .setLabel('▶️ Démarrer')
          .setStyle(ButtonStyle.Success)
      );

    const message = await interaction.editReply({ 
      embeds: [embed],
      components: [row],
    });

    await updateGameSession(session.id, { messageId: message.id });

    // Set up collector for join/start buttons
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000, // 5 minutes
    });

  collector.on('collect', async (i: ButtonInteraction) => {
      try {
        const currentSession = await prisma.minigameSession.findUnique({
          where: { id: session.id },
        });

        if (!currentSession || currentSession.status !== 'active') {
          await i.reply({ content: 'Cette session n\'est plus active.', ephemeral: true });
          return;
        }

        const currentGameState = JSON.parse(currentSession.gameState || '{}') as PokerGameState;

        if (i.customId === 'poker_join_' + session.id) {
          if (currentGameState.phase !== 'waiting') {
            await i.reply({ content: 'La partie a déjà commencé !', ephemeral: true });
            return;
          }

          if (currentGameState.players.some((p) => p.userId === i.user.id)) {
            await i.reply({ content: 'Vous avez déjà rejoint la partie !', ephemeral: true });
            return;
          }

          if (currentGameState.players.length >= 4) {
            await i.reply({ content: 'La table est pleine (4 joueurs max) !', ephemeral: true });
            return;
          }

          // Check wallet
          const playerWallet = await getOrCreateWallet(interaction.guild!.id, i.user.id, economySettings.startupBalance);
          if (playerWallet.wallet < bet) {
            await i.reply({ 
              embeds: [errorEmbed('Fonds insuffisants', 'Vous n\'avez que ' + playerWallet.wallet + ' ' + economySettings.currencySymbol + '.')] 
            });
            return;
          }

          // Deduct bet
          await prisma.economyWallet.update({
            where: { guildId_userId: { guildId: interaction.guild!.id, userId: i.user.id } },
            data: { wallet: { decrement: bet } },
          });

          // Add player
          currentGameState.players.push({
            userId: i.user.id,
            username: i.user.username,
            hand: [currentGameState.deck.pop()!, currentGameState.deck.pop()!],
            bet,
            currentBet: bet,
            folded: false,
            allIn: false,
            wallet: playerWallet.wallet,
          });
          currentGameState.pot += bet;

          await updateGameSession(session.id, {
            gameState: JSON.stringify(currentGameState),
          });

          const updatedEmbed = createEmbed('minigame')
            .setTitle('🃏 Poker Texas Hold\'em')
            .setDescription('En attente de joueurs (2-4)...')
            .addFields(
              { name: 'Créateur', value: interaction.user.username, inline: true },
              { name: 'Mise initiale', value: String(bet) + ' ' + economySettings.currencySymbol, inline: true },
              { name: 'Joueurs', value: String(currentGameState.players.length) + '/4', inline: true },
              { name: 'Pot actuel', value: String(currentGameState.pot) + ' ' + economySettings.currencySymbol, inline: true },
              { name: 'Joueurs inscrits', value: currentGameState.players.map((p) => p.username).join(', '), inline: false }
            )
            .setColor(0x3b82f6)
            .setTimestamp();

          await i.update({ embeds: [updatedEmbed], components: [row] });

        } else if (i.customId === 'poker_start_' + session.id) {
          if (i.user.id !== interaction.user.id) {
            await i.reply({ content: 'Seul le créateur peut démarrer la partie !', ephemeral: true });
            return;
          }

          if (currentGameState.players.length < 2) {
            await i.reply({ content: 'Il faut au moins 2 joueurs pour démarrer !', ephemeral: true });
            return;
          }

          if (currentGameState.phase !== 'waiting') {
            await i.reply({ content: 'La partie a déjà commencé !', ephemeral: true });
            return;
          }

          // Start the game
          currentGameState.phase = 'preflop';
          currentGameState.currentPlayerIndex = 1; // First player after creator
          currentGameState.currentBet = currentGameState.bigBlind;

          await updateGameSession(session.id, {
            gameState: JSON.stringify(currentGameState),
          });

          collector.stop();
          await runGamePhase(interaction, session, currentGameState, message, economySettings);
        }
      } catch (err) {
        logger.error('Poker interaction error', { err: err instanceof Error ? err.message : String(err) });
      }
    });

  collector.on('end', async (collected: Collection<string, Message>, reason: string) => {
      if (reason === 'time') {
        const finalSession = await prisma.minigameSession.findUnique({
          where: { id: session.id },
        });

        if (finalSession && finalSession.status === 'active') {
          const gameState = JSON.parse(finalSession.gameState || '{}') as PokerGameState;
          
          if (gameState.phase === 'waiting') {
            // Refund bets
            for (const player of gameState.players) {
              await prisma.economyWallet.update({
                where: { guildId_userId: { guildId: interaction.guild!.id, userId: player.userId } },
                data: { wallet: { increment: player.bet } },
              });
            }

            await endGameSession(session.id, 'timeout');

            const timeoutEmbed = createEmbed('minigame')
              .setTitle('⏱️ Temps écoulé')
              .setDescription('La partie est annulée. Les mises ont été remboursées.')
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
        }
      }
    });

  } catch (error) {
    logger.error('Poker game error', { err: error instanceof Error ? error.message : String(error) });
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Une erreur est survenue lors de la partie.')] });
  }
}

async function runGamePhase(
  interaction: ChatInputCommandInteraction,
  session: any,
  gameState: PokerGameState,
  message: any,
  economySettings: any
): Promise<void> {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  
  const embed = createEmbed('minigame')
    .setTitle('🃏 Poker Texas Hold\'em - ' + getPhaseName(gameState.phase))
    .addFields(
      { name: 'Phase', value: getPhaseName(gameState.phase), inline: true },
      { name: 'Pot', value: String(gameState.pot) + ' ' + economySettings.currencySymbol, inline: true },
      { name: 'Mise actuelle', value: String(gameState.currentBet) + ' ' + economySettings.currencySymbol, inline: true },
      { name: 'Cartes communes', value: gameState.communityCards.length > 0 ? formatHand(gameState.communityCards) : 'Aucune', inline: false },
      { name: 'Tour de', value: currentPlayer.username, inline: true }
    )
    .setColor(0x3b82f6)
    .setTimestamp();

  // Show player's cards only to them
  const playerHandEmbed = createEmbed('minigame')
    .setTitle('🃏 Vos cartes')
    .setDescription(formatHand(currentPlayer.hand))
    .setColor(0x3b82f6);

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('poker_fold_' + session.id)
        .setLabel('🏳️ Fold')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('poker_call_' + session.id)
        .setLabel('📞 Call (' + String(gameState.currentBet - currentPlayer.currentBet) + ')')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('poker_raise_' + session.id)
        .setLabel('⬆️ Raise')
        .setStyle(ButtonStyle.Success)
    );

  await message.edit({ 
    embeds: [embed],
    components: [row],
  });

  // Send DM with player's cards
  try {
    const dmChannel = await interaction.client.users.fetch(currentPlayer.userId).then((u) => u.createDM());
    await dmChannel.send({ embeds: [playerHandEmbed] });
  } catch (e) {
    // DM might be disabled
  }

  // Set up collector for player actions
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120000, // 2 minutes per action
  });

  collector.on('collect', async (i: ButtonInteraction) => {
    try {
      if (i.user.id !== currentPlayer.userId) {
        await i.reply({ content: "Ce n'est pas votre tour !", ephemeral: true });
        return;
      }

      const currentSession = await prisma.minigameSession.findUnique({
        where: { id: session.id },
      });

      if (!currentSession || currentSession.status !== 'active') {
        await i.reply({ content: 'Cette session n\'est plus active.', ephemeral: true });
        collector.stop();
        return;
      }

      const currentGameState = JSON.parse(currentSession.gameState || '{}') as PokerGameState;

      if (i.customId === 'poker_fold_' + session.id) {
        currentGameState.players[gameState.currentPlayerIndex].folded = true;
        await handlePlayerAction(interaction, session, currentGameState, message, economySettings, collector);
      } else if (i.customId === 'poker_call_' + session.id) {
        const callAmount = currentGameState.currentBet - currentGameState.players[gameState.currentPlayerIndex].currentBet;
        const player = currentGameState.players[gameState.currentPlayerIndex];
        
        if (player.wallet < callAmount) {
          // All-in
          currentGameState.players[gameState.currentPlayerIndex].allIn = true;
          currentGameState.players[gameState.currentPlayerIndex].currentBet += player.wallet;
          currentGameState.pot += player.wallet;
        } else {
          currentGameState.players[gameState.currentPlayerIndex].currentBet += callAmount;
          currentGameState.pot += callAmount;
        }
        
        await handlePlayerAction(interaction, session, currentGameState, message, economySettings, collector);
      } else if (i.customId === 'poker_raise_' + session.id) {
        const raiseAmount = currentGameState.minRaise;
        const player = currentGameState.players[gameState.currentPlayerIndex];
        const totalNeeded = (currentGameState.currentBet - player.currentBet) + raiseAmount;
        
        if (player.wallet < totalNeeded) {
          await i.reply({ content: 'Fonds insuffisants pour raise !', ephemeral: true });
          return;
        }
        
        currentGameState.players[gameState.currentPlayerIndex].currentBet += totalNeeded;
        currentGameState.pot += totalNeeded;
        currentGameState.currentBet += raiseAmount;
        currentGameState.minRaise = raiseAmount;
        
        await handlePlayerAction(interaction, session, currentGameState, message, economySettings, collector);
      }
    } catch (err) {
      logger.error('Poker action error', { err: err instanceof Error ? err.message : String(err) });
    }
  });

  collector.on('end', async (collected: Collection<string, Message>, reason: string) => {
    if (reason === 'time') {
      // Auto-fold on timeout
      gameState.players[gameState.currentPlayerIndex].folded = true;
      await handlePlayerAction(interaction, session, gameState, message, economySettings, collector);
    }
  });
}

async function handlePlayerAction(
  interaction: ChatInputCommandInteraction,
  session: any,
  gameState: PokerGameState,
  message: any,
  economySettings: any,
  collector: any
): Promise<void> {
  await updateGameSession(session.id, {
    gameState: JSON.stringify(gameState),
  });

  // Check if only one player remains
  const activePlayers = gameState.players.filter((p) => !p.folded);
  if (activePlayers.length === 1) {
    await endGame(interaction, session, gameState, message, economySettings, activePlayers[0]);
    return;
  }

  // Move to next player
  gameState.currentPlayerIndex = getNextActivePlayerIndex(gameState, gameState.currentPlayerIndex);
  
  // Check if round is complete
  if (allPlayersMatched(gameState) || gameState.currentPlayerIndex === -1) {
    await advancePhase(interaction, session, gameState, message, economySettings);
  } else {
    collector.stop();
    await runGamePhase(interaction, session, gameState, message, economySettings);
  }
}

async function advancePhase(
  interaction: ChatInputCommandInteraction,
  session: any,
  gameState: PokerGameState,
  message: any,
  economySettings: any
): Promise<void> {
  // Reset current bets for next round
  gameState.players.forEach((p) => {
    p.currentBet = 0;
  });
  gameState.currentBet = 0;
  gameState.currentPlayerIndex = (gameState.dealerIndex + 1) % gameState.players.length;

  switch (gameState.phase) {
    case 'preflop':
      gameState.phase = 'flop';
      gameState.communityCards.push(gameState.deck.pop()!, gameState.deck.pop()!, gameState.deck.pop()!);
      break;
    case 'flop':
      gameState.phase = 'turn';
      gameState.communityCards.push(gameState.deck.pop()!);
      break;
    case 'turn':
      gameState.phase = 'river';
      gameState.communityCards.push(gameState.deck.pop()!);
      break;
    case 'river':
      gameState.phase = 'showdown';
      await endGame(interaction, session, gameState, message, economySettings);
      return;
  }

  await updateGameSession(session.id, {
    gameState: JSON.stringify(gameState),
  });

  await runGamePhase(interaction, session, gameState, message, economySettings);
}

async function endGame(
  interaction: ChatInputCommandInteraction,
  session: any,
  gameState: PokerGameState,
  message: any,
  economySettings: any,
  winner?: Player
): Promise<void> {
  gameState.gameOver = true;

  let finalWinner: Player | undefined;
  
  if (winner) {
    finalWinner = winner;
  } else {
    // Showdown - evaluate hands
    const activePlayers = gameState.players.filter((p) => !p.folded);
    let bestHand = { rank: 0, name: '', value: 0 };
    
    for (const player of activePlayers) {
      const handEval = evaluateHand(player.hand, gameState.communityCards);
      if (handEval.rank > bestHand.rank || (handEval.rank === bestHand.rank && handEval.value > bestHand.value)) {
        bestHand = handEval;
        finalWinner = player;
      }
    }
  }

  if (!finalWinner) {
    await endGameSession(session.id, 'draw', 0);
    return;
  }

  // Award winnings
  await prisma.economyWallet.update({
    where: { guildId_userId: { guildId: interaction.guild!.id, userId: finalWinner.userId } },
    data: { 
      wallet: { increment: gameState.pot },
      totalEarned: { increment: gameState.pot - finalWinner.bet }
    },
  });

  await prisma.economyTransaction.create({
    data: {
      guildId: interaction.guild!.id,
      toUserId: finalWinner.userId,
      amount: gameState.pot,
      type: 'GAMBLE',
      description: 'Poker - Victoire',
    },
  });

  await endGameSession(session.id, 'won', gameState.pot - finalWinner.bet);

  const embed = createEmbed('minigame')
    .setTitle('🃏 Poker - Terminé')
    .setDescription('🎉 ' + finalWinner.username + ' gagne ' + String(gameState.pot) + ' ' + economySettings.currencySymbol + ' !')
    .addFields(
      { name: 'Vainqueur', value: finalWinner.username, inline: true },
      { name: 'Gain', value: '+' + String(gameState.pot) + ' ' + economySettings.currencySymbol, inline: true },
      { name: 'Cartes communes', value: formatHand(gameState.communityCards), inline: false }
    )
    .setColor(0x22c55e)
    .setTimestamp();

  try {
    await message.edit({ 
      embeds: [embed],
      components: [],
    });
  } catch (e) {
    // Message might have been deleted
  }
}

function getPhaseName(phase: PokerPhase): string {
  switch (phase) {
    case 'waiting': return 'En attente';
    case 'preflop': return 'Pre-flop';
    case 'flop': return 'Flop';
    case 'turn': return 'Turn';
    case 'river': return 'River';
    case 'showdown': return 'Showdown';
    default: return phase;
  }
}
