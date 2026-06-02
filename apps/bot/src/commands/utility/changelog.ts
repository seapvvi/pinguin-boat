import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Client,
  ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { prisma } from '@pinguin/db';
import { getConfig } from '@pinguin/config';
import { createEmbed, errorEmbed, successEmbed } from '../../services/embed';

const config = getConfig();
const CHARS_PER_PAGE = 3800;

function paginateContent(content: string): string[] {
  const pages: string[] = [];
  let remaining = content.trim();
  while (remaining.length > 0) {
    if (remaining.length <= CHARS_PER_PAGE) {
      pages.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf('\n', CHARS_PER_PAGE);
    if (splitAt <= 0) splitAt = remaining.lastIndexOf(' ', CHARS_PER_PAGE);
    if (splitAt <= 0) splitAt = CHARS_PER_PAGE;
    pages.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trim();
  }
  return pages;
}

export const data = new SlashCommandBuilder()
  .setName('changelog')
  .setDescription('Affiche ou publie le changelog')
  .addSubcommand(sub =>
    sub.setName('show')
      .setDescription('Affiche le dernier changelog ou un changelog spécifique')
      .addStringOption(opt =>
        opt.setName('version')
          .setDescription('Version du changelog (ex: 1.2.3)')
          .setRequired(false)
      )
  )
  .addSubcommand(sub =>
    sub.setName('announce')
      .setDescription('Publie le changelog dans le salon configuré (owner uniquement)')
      .addStringOption(opt =>
        opt.setName('version')
          .setDescription('Version du changelog à annoncer')
          .setRequired(true)
      )
  );

export const module = 'utility';

function createPaginationButtons(changelogId: string, page: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  const prev = new ButtonBuilder()
    .setCustomId(`changelog_prev_${changelogId}`)
    .setLabel('◀ Précédent')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page === 0);
  const next = new ButtonBuilder()
    .setCustomId(`changelog_next_${changelogId}`)
    .setLabel('Suivant ▶')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(page >= totalPages - 1);
  row.addComponents(prev, next);
  return row;
}

function buildChangelogEmbed(
  title: string,
  content: string,
  page: number,
  totalPages: number,
): ReturnType<typeof createEmbed> {
  const embed = createEmbed('default')
    .setTitle(title)
    .setDescription(content)
    .setFooter({ text: `Page ${page + 1}/${totalPages}` });
  return embed;
}

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Cette commande doit être utilisée dans un serveur.')], ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'show') {
    await interaction.deferReply();
    const version = interaction.options.getString('version');

    const changelog = version
      ? await prisma.changelog.findFirst({ where: { version, published: true }, orderBy: { createdAt: 'desc' } })
      : await prisma.changelog.findFirst({ where: { published: true }, orderBy: { createdAt: 'desc' } });

    if (!changelog) {
      const msg = version
        ? `Aucun changelog trouvé pour la version **${version}**.`
        : 'Aucun changelog publié pour le moment.';
      await interaction.editReply({ embeds: [errorEmbed('Changelog introuvable', msg)] });
      return;
    }

    const pages = paginateContent(changelog.content);
    const versionStr = changelog.version ? `v${changelog.version}` : '';
    const title = versionStr ? `${changelog.title} — ${versionStr}` : changelog.title;
    const embed = buildChangelogEmbed(title, pages[0], 0, pages.length);
    const components = pages.length > 1 ? [createPaginationButtons(changelog.id, 0, pages.length)] : [];

    await interaction.editReply({ embeds: [embed], components });
    return;
  }

  if (subcommand === 'announce') {
    if (interaction.user.id !== config.DISCORD_OWNER_ID) {
      await interaction.reply({
        embeds: [errorEmbed('Accès refusé', 'Commande réservée au créateur du bot.')],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const version = interaction.options.getString('version', true);
    const changelog = await prisma.changelog.findFirst({
      where: { version, published: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!changelog) {
      await interaction.editReply({ embeds: [errorEmbed('Changelog introuvable', `Aucun changelog publié pour la version **${version}**.`)] });
      return;
    }

    const settings = await prisma.guildSettings.findUnique({
      where: { guildId: interaction.guild.id },
    });

    if (!settings?.changelogChannel) {
      await interaction.editReply({
        embeds: [errorEmbed('Salon non configuré', 'Aucun salon de publication configuré. Définissez `changelogChannel` dans les paramètres du serveur.')],
      });
      return;
    }

    const channel = await interaction.guild.channels.fetch(settings.changelogChannel).catch(() => null);
    if (!channel?.isTextBased()) {
      await interaction.editReply({ embeds: [errorEmbed('Salon invalide', 'Le salon configuré est introuvable ou n\'est pas un salon textuel.')] });
      return;
    }

    const pages = paginateContent(changelog.content);
    const versionStr = `v${changelog.version}`;
    const title = `${changelog.title} — ${versionStr}`;
    const embed = buildChangelogEmbed(`📢 Nouveau changelog : ${title}`, pages[0], 0, pages.length);
    const components = pages.length > 1 ? [createPaginationButtons(changelog.id, 0, pages.length)] : [];

    await channel.send({ embeds: [embed], components });

    await interaction.editReply({
      embeds: [successEmbed('Changelog publié', `Le changelog **${title}** a été publié dans <#${channel.id}>.`)],
    });
    return;
  }
}

export async function handleChangelogPagination(interaction: ButtonInteraction, client: Client): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Cette action doit être effectuée dans un serveur.')], ephemeral: true });
    return;
  }

  const customId = interaction.customId;
  const isPrev = customId.startsWith('changelog_prev_');
  const changelogId = customId.replace(/^changelog_(prev|next)_/, '');

  const changelog = await prisma.changelog.findUnique({ where: { id: changelogId } });
  if (!changelog) {
    await interaction.update({ embeds: [errorEmbed('Erreur', 'Changelog introuvable.')], components: [] });
    return;
  }

  const pages = paginateContent(changelog.content);
  const totalPages = pages.length;

  let currentPage = 0;
  const embed = interaction.message.embeds[0];
  if (embed?.footer?.text) {
    const match = embed.footer.text.match(/Page (\d+)\/(\d+)/);
    if (match) currentPage = parseInt(match[1], 10) - 1;
  }

  let newPage = currentPage;
  if (isPrev && currentPage > 0) newPage--;
  else if (!isPrev && currentPage < totalPages - 1) newPage++;

  const versionStr = changelog.version ? `v${changelog.version}` : '';
  const title = versionStr ? `${changelog.title} — ${versionStr}` : changelog.title;
  const newEmbed = buildChangelogEmbed(title, pages[newPage], newPage, totalPages);
  const components = totalPages > 1 ? [createPaginationButtons(changelogId, newPage, totalPages)] : [];

  await interaction.update({ embeds: [newEmbed], components });
}
