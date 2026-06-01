import { SlashCommandBuilder, ChatInputCommandInteraction, Client, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuInteraction, ButtonInteraction } from 'discord.js';
import { createEmbed } from '../../services/embed';

interface CommandInfo {
  name: string;
  description: string;
  category: string;
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  economy: '💰 Économie et monnaie virtuelle',
  moderation: '🔨 Gestion des sanctions et de la modération',
  levels: '📊 Système de niveaux et d\'XP',
  minigames: '🎮 Jeux et divertissement',
  fun: '😂 Commandes fun',
  utility: '🛠️ Commandes utilitaires',
  admin: '⚙️ Commandes d\'administration',
  music: '🎵 Musique en salon vocal',
  tickets: '🎫 Système de tickets de support',
  giveaways: '🎁 Organisation de giveaways',
  polls: '📊 Création de sondages',
  suggestions: '💡 Système de suggestions',
  welcome: '👋 Messages de bienvenue',
  autoroles: '🤖 Rôles automatiques',
  embeds: '📝 Embeds personnalisés',
  forms: '📋 Formulaires',
  starboard: '⭐ Système de starboard',
};

const CATEGORY_EMOJIS: Record<string, string> = {
  economy: '💰',
  moderation: '🔨',
  levels: '📊',
  minigames: '🎮',
  fun: '😂',
  utility: '🛠️',
  admin: '⚙️',
  music: '🎵',
  tickets: '🎫',
  giveaways: '🎁',
  polls: '📊',
  suggestions: '💡',
  welcome: '👋',
  autoroles: '🤖',
  embeds: '📝',
  forms: '📋',
  starboard: '⭐',
};

const COMMANDS_PER_PAGE = 10;

function getCommandsByCategory(client: Client): Record<string, CommandInfo[]> {
  const commandsByCategory: Record<string, CommandInfo[]> = {};

  for (const [name, command] of client.commands) {
    const category = (command as any).module || 'utility';
    const description = command.data.description || 'Pas de description';

    if (!commandsByCategory[category]) {
      commandsByCategory[category] = [];
    }

    commandsByCategory[category].push({
      name: `/${name}`,
      description,
      category,
    });
  }

  for (const category in commandsByCategory) {
    commandsByCategory[category].sort((a, b) => a.name.localeCompare(b.name));
  }

  return commandsByCategory;
}

function createCategorySelect(commandsByCategory: Record<string, CommandInfo[]>, selectedCategory?: string): ActionRowBuilder<StringSelectMenuBuilder> {
  const categories = Object.keys(commandsByCategory).sort();

  const select = new StringSelectMenuBuilder()
    .setCustomId('help_category_select')
    .setPlaceholder('Choisir une catégorie')
    .addOptions(
      categories.map((cat) => {
        const emoji = CATEGORY_EMOJIS[cat] || '📁';
        const label = `${emoji} ${cat.charAt(0).toUpperCase() + cat.slice(1)}`;
        const count = commandsByCategory[cat].length;

        return new StringSelectMenuOptionBuilder()
          .setLabel(label)
          .setDescription(`${CATEGORY_DESCRIPTIONS[cat] || cat} (${count} commandes)`)
          .setValue(cat)
          .setDefault(selectedCategory === cat);
      })
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

function createPaginationButtons(category: string, page: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  const prevButton = new ButtonBuilder()
    .setCustomId(`help_prev_${category}`)
    .setLabel('◀ Précédent')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page === 0);

  const nextButton = new ButtonBuilder()
    .setCustomId(`help_next_${category}`)
    .setLabel('Suivant ▶')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page >= totalPages - 1);

  row.addComponents(prevButton, nextButton);

  return row;
}

function createCategoryEmbed(commandsByCategory: Record<string, CommandInfo[]>, category: string, page: number): ReturnType<typeof createEmbed> {
  const commands = commandsByCategory[category] || [];
  const totalPages = Math.ceil(commands.length / COMMANDS_PER_PAGE);
  const startIndex = page * COMMANDS_PER_PAGE;
  const endIndex = startIndex + COMMANDS_PER_PAGE;
  const pageCommands = commands.slice(startIndex, endIndex);

  const emoji = CATEGORY_EMOJIS[category] || '📁';
  const embed = createEmbed('default')
    .setTitle(`${emoji} ${category.charAt(0).toUpperCase() + category.slice(1)}`)
    .setDescription(CATEGORY_DESCRIPTIONS[category] || category)
    .addFields(
      pageCommands.map((cmd) => ({
        name: cmd.name,
        value: cmd.description,
        inline: true,
      }))
    )
    .setFooter({ text: `Page ${page + 1}/${totalPages} • ${commands.length} commande(s)` })
    .setTimestamp();

  return embed;
}

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Afficher l\'aide interactive avec les commandes par catégorie');

export const module = 'utility';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const commandsByCategory = getCommandsByCategory(client);
  const categories = Object.keys(commandsByCategory).sort();

  if (categories.length === 0) {
    await interaction.reply({
      embeds: [createEmbed('error').setTitle('❌ Erreur').setDescription('Aucune commande disponible.')],
      ephemeral: true,
    });
    return;
  }

  const firstCategory = categories[0];
  const embed = createCategoryEmbed(commandsByCategory, firstCategory, 0);
  const selectRow = createCategorySelect(commandsByCategory, firstCategory);
  const buttonRow = createPaginationButtons(firstCategory, 0, Math.ceil(commandsByCategory[firstCategory].length / COMMANDS_PER_PAGE));

  await interaction.reply({
    embeds: [embed],
    components: [selectRow, buttonRow],
  });
}

export async function handleHelpSelect(interaction: StringSelectMenuInteraction, client: Client): Promise<void> {
  const categoryId = interaction.values[0];
  const commandsByCategory = getCommandsByCategory(client);
  const commands = commandsByCategory[categoryId];

  if (!commands) {
    await interaction.update({
      embeds: [createEmbed('error').setTitle('❌ Erreur').setDescription('Catégorie introuvable.')],
      components: [],
    });
    return;
  }

  const embed = createCategoryEmbed(commandsByCategory, categoryId, 0);
  const selectRow = createCategorySelect(commandsByCategory, categoryId);
  const buttonRow = createPaginationButtons(categoryId, 0, Math.ceil(commands.length / COMMANDS_PER_PAGE));

  await interaction.update({
    embeds: [embed],
    components: [selectRow, buttonRow],
  });
}

export async function handleHelpPagination(interaction: ButtonInteraction, client: Client, direction: 'prev' | 'next'): Promise<void> {
  const customId = interaction.customId;
  const category = customId.split('_')[2];
  const commandsByCategory = getCommandsByCategory(client);
  const commands = commandsByCategory[category];

  if (!commands) {
    await interaction.update({
      embeds: [createEmbed('error').setTitle('❌ Erreur').setDescription('Catégorie introuvable.')],
      components: [],
    });
    return;
  }

  const totalPages = Math.ceil(commands.length / COMMANDS_PER_PAGE);
  let currentPage = 0;

  const message = interaction.message;
  const embed = message.embeds[0];
  if (embed && embed.footer) {
    const footerText = embed.footer.text;
    const match = footerText.match(/Page (\d+)\/(\d+)/);
    if (match) {
      currentPage = parseInt(match[1], 10) - 1;
    }
  }

  if (direction === 'prev' && currentPage > 0) {
    currentPage--;
  } else if (direction === 'next' && currentPage < totalPages - 1) {
    currentPage++;
  }

  const newEmbed = createCategoryEmbed(commandsByCategory, category, currentPage);
  const selectRow = createCategorySelect(commandsByCategory, category);
  const buttonRow = createPaginationButtons(category, currentPage, totalPages);

  await interaction.update({
    embeds: [newEmbed],
    components: [selectRow, buttonRow],
  });
}
