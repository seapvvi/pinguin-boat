import { SlashCommandBuilder, ChatInputCommandInteraction, Client, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { getEconomySettings, getOrCreateWallet } from '../../services/economy';
import { getMinigameSettings, createGameSession, getActiveSession, updateGameSession, endGameSession, minigameChannelError } from '../../services/minigames';
import { successEmbed, errorEmbed, createEmbed } from '../../services/embed';
import { isModuleEnabled } from '../../guards/module';
import { updateQuestProgress } from '../../services/quests';

const SUITS = ['♠️', '♥️', '♦️', '♣️'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

type Card = { suit: string; value: string };
type Hand = Card[];

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ suit, value });
    }
  }
  return deck;
}

function shuffleDeck(deck: Card[]): Card[] {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function calculateHandValue(hand: Hand): number {
  let value = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.value === 'A') {
      aces++;
      value += 11;
    } else if (['K', 'Q', 'J'].includes(card.value)) {
      value += 10;
    } else {
      value += parseInt(card.value);
    }
  }

  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }

  return value;
}

function formatHand(hand: Hand, hideFirst: boolean = false): string {
  if (hideFirst && hand.length > 0) {
    return '🂠 ' + hand.slice(1).map(c => c.value + c.suit).join(' ');
  }
  return hand.map(c => c.value + c.suit).join(' ');
}

function formatCard(card: Card): string {
  return card.value + card.suit;
}

export const data = new SlashCommandBuilder()
  .setName('blackjack')
  .setDescription('Jouez au Blackjack')
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
    const activeSession = await getActiveSession(interaction.user.id, 'blackjack');
    if (activeSession) {
      await interaction.editReply({ embeds: [errorEmbed('Session active', 'Vous avez déjà une partie de Blackjack en cours.')] });
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

    // Deduct bet
    await prisma.economyWallet.update({
      where: { guildId_userId: { guildId: interaction.guild!.id, userId: interaction.user.id } },
      data: { wallet: { decrement: bet } },
    });

    // Create and shuffle deck
    const deck = shuffleDeck(createDeck());
    
    // Deal initial cards
    const playerHand: Hand = [deck.pop()!, deck.pop()!];
    const dealerHand: Hand = [deck.pop()!, deck.pop()!];

    // Check for blackjack
    const playerValue = calculateHandValue(playerHand);
    const dealerValue = calculateHandValue(dealerHand);

    const gameState = {
      deck,
      playerHand,
      dealerHand,
      playerValue,
      dealerValue,
      bet,
      gameOver: false,
    };

    // Create game session
    const session = await createGameSession(
      interaction.guild.id,
      interaction.user.id,
      'blackjack',
      bet,
      interaction.channelId,
      interaction.id
    );

    await updateGameSession(session.id, {
      gameState: JSON.stringify(gameState),
    });

    // Check for immediate blackjack
    if (playerValue === 21) {
      let winnings = 0;
      let result = '';

      if (dealerValue === 21) {
        // Both have blackjack - push
        winnings = bet;
        result = 'push';
      } else {
        // Player has blackjack - 3:2 payout
        winnings = Math.floor(bet * 2.5);
        result = 'blackjack';
      }

      await prisma.economyWallet.update({
        where: { guildId_userId: { guildId: interaction.guild!.id, userId: interaction.user.id } },
        data: { 
          wallet: { increment: winnings },
          totalEarned: { increment: result === 'blackjack' ? winnings - bet : 0 }
        },
      });

      await prisma.economyTransaction.create({
        data: {
          guildId: interaction.guild!.id,
          toUserId: interaction.user.id,
          amount: winnings,
          type: 'GAMBLE',
          description: 'Blackjack - ' + (result === 'blackjack' ? 'Blackjack !' : 'Égalité'),
        },
      });

      if (result === 'blackjack') {
        await updateQuestProgress(interaction.guild!.id, interaction.user.id, 'WIN_BLACKJACK', 1);
      }

      await endGameSession(session.id, result, winnings - bet);

      const embed = createEmbed('minigame')
        .setTitle('🃏 Blackjack')
        .setDescription(result === 'blackjack' ? '🎉 BLACKJACK !' : '🤝 Égalité !')
        .addFields(
          { name: 'Votre main', value: formatHand(playerHand), inline: true },
          { name: 'Main du croupier', value: formatHand(dealerHand), inline: true },
          { name: 'Votre total', value: String(playerValue), inline: true },
          { name: 'Total croupier', value: String(dealerValue), inline: true },
          { name: 'Gain', value: '+' + String(winnings) + ' ' + economySettings.currencySymbol, inline: true }
        )
        .setColor(result === 'blackjack' ? 0x22c55e : 0xf59e0b)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Send initial game state
    const embed = createEmbed('minigame')
      .setTitle('🃏 Blackjack')
      .addFields(
        { name: 'Votre main', value: formatHand(playerHand), inline: true },
        { name: 'Main du croupier', value: formatHand(dealerHand, true), inline: true },
        { name: 'Votre total', value: String(playerValue), inline: true },
        { name: 'Mise', value: String(bet) + ' ' + economySettings.currencySymbol, inline: true }
      )
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('bj_hit')
          .setLabel('🃏 Tirer')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('bj_stand')
          .setLabel('✋ Rester')
          .setStyle(ButtonStyle.Success)
      );

    const message = await interaction.editReply({ 
      embeds: [embed],
      components: [row],
    });

    // Set up collector
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000, // 5 minutes
    });

    collector.on('collect', async (i) => {
     try {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: "Ce n'est pas votre partie !", ephemeral: true });
        return;
      }

      if (gameState.gameOver) {
        await i.reply({ content: 'Cette partie est terminée.', ephemeral: true });
        return;
      }

      if (i.customId === 'bj_hit') {
        // Player draws a card
        const newCard = gameState.deck.pop()!;
        gameState.playerHand.push(newCard);
        gameState.playerValue = calculateHandValue(gameState.playerHand);

        if (gameState.playerValue > 21) {
          // Player busts
          gameState.gameOver = true;
          collector.stop();

          await endGameSession(session.id, 'lost', -bet);

          const bustEmbed = createEmbed('minigame')
            .setTitle('💥 Perdu !')
            .setDescription('Vous avez dépassé 21 !')
            .addFields(
              { name: 'Votre main', value: formatHand(gameState.playerHand), inline: true },
              { name: 'Main du croupier', value: formatHand(gameState.dealerHand), inline: true },
              { name: 'Votre total', value: String(gameState.playerValue), inline: true },
              { name: 'Perte', value: '-' + String(bet) + ' ' + economySettings.currencySymbol, inline: true }
            )
            .setColor(0xef4444)
            .setTimestamp();

          await i.update({ 
            embeds: [bustEmbed],
            components: [],
          });
          return;
        }

        await updateGameSession(session.id, {
          gameState: JSON.stringify(gameState),
        });

        const updateEmbed = createEmbed('minigame')
          .setTitle('🃏 Blackjack')
          .addFields(
            { name: 'Votre main', value: formatHand(gameState.playerHand), inline: true },
            { name: 'Main du croupier', value: formatHand(gameState.dealerHand, true), inline: true },
            { name: 'Votre total', value: String(gameState.playerValue), inline: true },
            { name: 'Mise', value: String(bet) + ' ' + economySettings.currencySymbol, inline: true }
          )
          .setTimestamp();

        await i.update({ 
          embeds: [updateEmbed],
          components: [row],
        });
      } else if (i.customId === 'bj_stand') {
        // Player stands, dealer plays
        gameState.gameOver = true;
        collector.stop();

        // Dealer draws until 17 or higher
        while (gameState.dealerValue < 17) {
          const newCard = gameState.deck.pop()!;
          gameState.dealerHand.push(newCard);
          gameState.dealerValue = calculateHandValue(gameState.dealerHand);
        }

        // Determine winner
        let winnings = 0;
        let result = '';
        let resultColor = 0xef4444;

        if (gameState.dealerValue > 21) {
          // Dealer busts - player wins
          winnings = bet * 2;
          result = 'Le croupier a sauté !';
          resultColor = 0x22c55e;
        } else if (gameState.playerValue > gameState.dealerValue) {
          // Player wins
          winnings = bet * 2;
          result = 'Vous gagnez !';
          resultColor = 0x22c55e;
        } else if (gameState.playerValue < gameState.dealerValue) {
          // Dealer wins
          winnings = 0;
          result = 'Le croupier gagne.';
        } else {
          // Push
          winnings = bet;
          result = 'Égalité !';
          resultColor = 0xf59e0b;
        }

        await prisma.economyWallet.update({
          where: { guildId_userId: { guildId: interaction.guild!.id, userId: interaction.user.id } },
          data: { 
            wallet: { increment: winnings },
            totalEarned: { increment: winnings > bet ? winnings - bet : 0 }
          },
        });

        await prisma.economyTransaction.create({
          data: {
            guildId: interaction.guild!.id,
            toUserId: interaction.user.id,
            amount: winnings,
            type: 'GAMBLE',
            description: 'Blackjack - ' + result,
          },
        });

        if (winnings > bet) {
          await updateQuestProgress(interaction.guild!.id, interaction.user.id, 'WIN_BLACKJACK', 1);
        }

        await endGameSession(session.id, winnings > bet ? 'won' : winnings === bet ? 'push' : 'lost', winnings - bet);

        const finalEmbed = createEmbed('minigame')
          .setTitle('🃏 Blackjack')
          .setDescription(result)
          .addFields(
            { name: 'Votre main', value: formatHand(gameState.playerHand), inline: true },
            { name: 'Main du croupier', value: formatHand(gameState.dealerHand), inline: true },
            { name: 'Votre total', value: String(gameState.playerValue), inline: true },
            { name: 'Total croupier', value: String(gameState.dealerValue), inline: true },
            { name: 'Gain', value: winnings > 0 ? '+' + String(winnings) + ' ' + economySettings.currencySymbol : '-' + String(bet) + ' ' + economySettings.currencySymbol, inline: true }
          )
          .setColor(resultColor)
          .setTimestamp();

        await i.update({ 
          embeds: [finalEmbed],
          components: [],
        });
      }
     } catch (err) {
       console.error('Blackjack interaction error:', err);
     }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time' && !gameState.gameOver) {
        gameState.gameOver = true;
        
        // Return bet on timeout
        await prisma.economyWallet.update({
          where: { guildId_userId: { guildId: interaction.guild!.id, userId: interaction.user.id } },
          data: { wallet: { increment: bet } },
        });

        await endGameSession(session.id, 'timeout');

        const timeoutEmbed = createEmbed('minigame')
          .setTitle('⏱️ Temps écoulé')
          .setDescription('La partie est annulée. Votre mise vous a été remboursée.')
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
    console.error('Blackjack game error:', error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Une erreur est survenue lors de la partie.')] });
  }
}