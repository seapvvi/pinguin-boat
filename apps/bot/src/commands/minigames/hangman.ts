import { SlashCommandBuilder, ChatInputCommandInteraction, Client, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { getEconomySettings, getOrCreateWallet } from '../../services/economy';
import { getMinigameSettings, createGameSession, getActiveSession, updateGameSession, endGameSession, minigameChannelError } from '../../services/minigames';
import { successEmbed, errorEmbed, createEmbed } from '../../services/embed';
import { isModuleEnabled } from '../../guards/module';
import { logger } from '@pinguin/shared';

const WORD_CATEGORIES: Record<string, string[]> = {
  animaux: ['CHAT', 'CHIEN', 'ELEPHANT', 'GIRAFE', 'LION', 'TIGRE', 'SINGE', 'POULE', 'LAPIN', 'CHEVAL', 'DAUPHIN', 'BALEINE', 'AIGLE', 'PERROQUET', 'PANDA'],
  pays: ['FRANCE', 'ALLEMAGNE', 'ESPAGNE', 'ITALIE', 'PORTUGAL', 'BELGIQUE', 'SUISSE', 'CANADA', 'BRESIL', 'JAPON', 'CHINE', 'INDE', 'AUSTRALIE', 'MEXIQUE', 'RUSSIE'],
  fruits: ['POMME', 'POIRE', 'BANANE', 'ORANGE', 'FRAISE', 'RAISIN', 'KIWI', 'MANGUE', 'ANANAS', 'CERISE', 'PECHE', 'ABRICOT', 'FIGUE', 'NOIX', 'AMANDE'],
  metiers: ['MEDECIN', 'AVOCAT', 'INGENIEUR', 'PROFESSEUR', 'BOULANGER', 'CUISINIER', 'MECANICIEN', 'ELECTRICIEN', 'PLOMBIER', 'ARCHITECTE', 'PILOTE', 'JOURNALISTE', 'ARTISTE', 'MUSICIEN', 'ECRIVAIN'],
  couleurs: ['ROUGE', 'BLEU', 'VERT', 'JAUNE', 'ORANGE', 'VIOLET', 'ROSE', 'NOIR', 'BLANC', 'GRIS', 'MARRON', 'BEIGE', 'CYAN', 'MAGENTA', 'TURQUOISE'],
  sports: ['FOOTBALL', 'BASKETBALL', 'TENNIS', 'NATATION', 'ATHLETISME', 'GYMNASTIQUE', 'BOXE', 'JUDO', 'KARATE', 'GOLF', 'RUGBY', 'HOCKEY', 'BASEBALL', 'VOLLEYBALL', 'SKI'],
};

const HANGMAN_STAGES: string[] = [
  '',
  `
  +---+
  |   |
      |
      |
      |
      |
=========`,
  `
  +---+
  |   |
  O   |
      |
      |
      |
=========`,
  `
  +---+
  |   |
  O   |
  |   |
      |
      |
=========`,
  `
  +---+
  |   |
  O   |
 /|   |
      |
      |
=========`,
  `
  +---+
  |   |
  O   |
 /|\\  |
      |
      |
=========`,
  `
  +---+
  |   |
  O   |
 /|\\  |
 /    |
      |
=========`,
  `
  +---+
  |   |
  O   |
 /|\\  |
 / \\  |
      |
=========`,
];

function getRandomWord(category: string): string {
  const words = WORD_CATEGORIES[category.toLowerCase()] || WORD_CATEGORIES.animaux;
  return words[Math.floor(Math.random() * words.length)];
}

function createKeyboard(usedLetters: string[]): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const groupSize = 6;
  
  for (let i = 0; i < letters.length; i += groupSize) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (let j = 0; j < groupSize && i + j < letters.length; j++) {
      const letter = letters[i + j];
      const isUsed = usedLetters.includes(letter);
      
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('hm_' + letter)
          .setLabel(letter)
          .setStyle(isUsed ? ButtonStyle.Secondary : ButtonStyle.Primary)
          .setDisabled(isUsed)
      );
    }
    rows.push(row);
  }
  
  return rows;
}

function formatWord(word: string, guessedLetters: string[]): string {
  return word.split('').map(letter => guessedLetters.includes(letter) ? letter : '_').join(' ');
}

export const data = new SlashCommandBuilder()
  .setName('hangman')
  .setDescription('Jouez au Pendu')
  .addIntegerOption((opt) =>
    opt.setName('mise')
      .setDescription('Mise en coins (0 pour jouer sans mise)')
      .setRequired(false)
      .setMinValue(0)
  )
  .addStringOption((opt) =>
    opt.setName('categorie')
      .setDescription('Catégorie de mots')
      .setRequired(false)
      .addChoices(
        { name: 'Animaux', value: 'animaux' },
        { name: 'Pays', value: 'pays' },
        { name: 'Fruits', value: 'fruits' },
        { name: 'Métiers', value: 'metiers' },
        { name: 'Couleurs', value: 'couleurs' },
        { name: 'Sports', value: 'sports' },
      )
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

    const bet = interaction.options.getInteger('mise') ?? 0;
    const category = interaction.options.getString('categorie') ?? 'animaux';

    // Check if user has an active session
    const activeSession = await getActiveSession(interaction.user.id, 'hangman');
    if (activeSession) {
      await interaction.editReply({ embeds: [errorEmbed('Session active', 'Vous avez déjà une partie de Pendu en cours.')] });
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
      const wallet = await getOrCreateWallet(interaction.guild.id, interaction.user.id, economySettings.startupBalance);
      
      if (wallet.wallet < bet) {
        await interaction.editReply({ 
          embeds: [errorEmbed('Fonds insuffisants', 'Vous n\'avez que ' + wallet.wallet + ' ' + economySettings.currencySymbol + ' dans votre portefeuille.')] 
        });
        return;
      }

      // Deduct bet
      await prisma.economyWallet.update({
        where: { guildId_userId: { guildId: interaction.guild.id, userId: interaction.user.id } },
        data: { wallet: { decrement: bet } },
      });
    }

    // Get custom word categories from settings if available
    let customCategories: Record<string, string[]> = {};
    try {
      customCategories = JSON.parse(settings.hangmanWordCategories || '{}');
    } catch (e) {
      // Use default categories if parsing fails
    }

    // Merge custom categories with defaults
    const allCategories = { ...WORD_CATEGORIES, ...customCategories };
    const words = allCategories[category.toLowerCase()] || allCategories.animaux;
    const word = words[Math.floor(Math.random() * words.length)];

    const gameState = {
      word,
      category,
      guessedLetters: [] as string[],
      wrongGuesses: 0,
      maxWrongGuesses: 6,
      bet,
      gameOver: false,
    };

    const guildId = interaction.guild.id;

    const session = await createGameSession(
      guildId,
      interaction.user.id,
      'hangman',
      bet,
      interaction.channelId,
      interaction.id
    );

    await updateGameSession(session.id, {
      gameState: JSON.stringify(gameState),
    });

    const embed = createEmbed('minigame')
      .setTitle('🎯 Pendu')
      .setDescription('Devinez le mot avant d\'être pendu !')
      .addFields(
        { name: 'Catégorie', value: category.charAt(0).toUpperCase() + category.slice(1), inline: true },
        { name: 'Mot', value: '```' + formatWord(word, gameState.guessedLetters) + '```', inline: false },
        { name: 'Pendu', value: '```' + HANGMAN_STAGES[gameState.wrongGuesses] + '```', inline: false },
        { name: 'Erreurs', value: '0/' + String(gameState.maxWrongGuesses), inline: true },
        { name: 'Mise', value: bet > 0 ? String(bet) + ' ' + economySettings.currencySymbol : 'Gratuit', inline: true },
        { name: 'Gain potentiel', value: String(settings.hangmanReward) + ' ' + economySettings.currencySymbol, inline: true }
      )
      .setColor(0x3b82f6)
      .setTimestamp();

    const rows = createKeyboard(gameState.guessedLetters);

    const message = await interaction.editReply({ 
      embeds: [embed],
      components: rows,
    });

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

        const letter = i.customId.replace('hm_', '');
        
        if (gameState.guessedLetters.includes(letter)) {
          await i.reply({ content: 'Vous avez déjà essayé cette lettre !', ephemeral: true });
          return;
        }

        gameState.guessedLetters.push(letter);

        if (word.includes(letter)) {
          // Correct guess
          const formattedWord = formatWord(word, gameState.guessedLetters);
          
          if (!formattedWord.includes('_')) {
            // Word completed - win
            gameState.gameOver = true;
            collector.stop();

            let winnings = bet > 0 ? Math.floor(bet * 2) + settings.hangmanReward : settings.hangmanReward;
            
            await prisma.economyWallet.update({
              where: { guildId_userId: { guildId, userId: interaction.user.id } },
              data: { 
                wallet: { increment: winnings },
                totalEarned: { increment: winnings }
              },
            });

            await prisma.economyTransaction.create({
              data: {
                guildId,
                toUserId: interaction.user.id,
                amount: winnings,
                type: 'GAMBLE',
                description: 'Pendu - Gagné',
              },
            });

            await endGameSession(session.id, 'won', winnings - bet);

            const winEmbed = createEmbed('minigame')
              .setTitle('🎉 Bravo !')
              .setDescription('Vous avez trouvé le mot : **' + word + '**')
              .addFields(
                { name: 'Catégorie', value: category.charAt(0).toUpperCase() + category.slice(1), inline: true },
                { name: 'Pendu', value: '```' + HANGMAN_STAGES[gameState.wrongGuesses] + '```', inline: false },
                { name: 'Erreurs', value: String(gameState.wrongGuesses) + '/' + String(gameState.maxWrongGuesses), inline: true },
                { name: 'Gain', value: '+' + String(winnings) + ' ' + economySettings.currencySymbol, inline: true }
              )
              .setColor(0x22c55e)
              .setTimestamp();

            await i.update({ 
              embeds: [winEmbed],
              components: [],
            });
            return;
          }
        } else {
          // Wrong guess
          gameState.wrongGuesses++;

          if (gameState.wrongGuesses >= gameState.maxWrongGuesses) {
            // Game over - lost
            gameState.gameOver = true;
            collector.stop();

            await endGameSession(session.id, 'lost', -bet);

            const loseEmbed = createEmbed('minigame')
              .setTitle('💀 Perdu !')
              .setDescription('Le mot était : **' + word + '**')
              .addFields(
                { name: 'Catégorie', value: category.charAt(0).toUpperCase() + category.slice(1), inline: true },
                { name: 'Pendu', value: '```' + HANGMAN_STAGES[gameState.wrongGuesses] + '```', inline: false },
                { name: 'Mot', value: '```' + word + '```', inline: false },
                { name: 'Perte', value: bet > 0 ? '-' + String(bet) + ' ' + economySettings.currencySymbol : '0 ' + economySettings.currencySymbol, inline: true }
              )
              .setColor(0xef4444)
              .setTimestamp();

            await i.update({ 
              embeds: [loseEmbed],
              components: [],
            });
            return;
          }
        }

        await updateGameSession(session.id, {
          gameState: JSON.stringify(gameState),
        });

        const updateEmbed = createEmbed('minigame')
          .setTitle('🎯 Pendu')
          .setDescription('Devinez le mot avant d\'être pendu !')
          .addFields(
            { name: 'Catégorie', value: category.charAt(0).toUpperCase() + category.slice(1), inline: true },
            { name: 'Mot', value: '```' + formatWord(word, gameState.guessedLetters) + '```', inline: false },
            { name: 'Pendu', value: '```' + HANGMAN_STAGES[gameState.wrongGuesses] + '```', inline: false },
            { name: 'Erreurs', value: String(gameState.wrongGuesses) + '/' + String(gameState.maxWrongGuesses), inline: true },
            { name: 'Mise', value: bet > 0 ? String(bet) + ' ' + economySettings.currencySymbol : 'Gratuit', inline: true },
            { name: 'Gain potentiel', value: String(settings.hangmanReward) + ' ' + economySettings.currencySymbol, inline: true }
          )
          .setColor(0x3b82f6)
          .setTimestamp();

        const updatedRows = createKeyboard(gameState.guessedLetters);

        await i.update({ 
          embeds: [updateEmbed],
          components: updatedRows,
        });
      } catch (err) {
        logger.error('Hangman interaction error', { err: err instanceof Error ? err.message : String(err) });
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time' && !gameState.gameOver) {
        gameState.gameOver = true;
        
        // Return bet on timeout
        if (bet > 0) {
          await prisma.economyWallet.update({
            where: { guildId_userId: { guildId, userId: interaction.user.id } },
            data: { wallet: { increment: bet } },
          });
        }

        await endGameSession(session.id, 'timeout');

        const timeoutEmbed = createEmbed('minigame')
          .setTitle('⏱️ Temps écoulé')
          .setDescription('Le mot était : **' + word + '**')
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
    logger.error('Hangman game error', { err: error instanceof Error ? error.message : String(error) });
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Une erreur est survenue lors de la partie.')] });
  }
}
