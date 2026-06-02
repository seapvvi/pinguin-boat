import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, Client } from 'discord.js';
import { prisma, type StreamPlatform } from '@pinguin/db';
import { createEmbed, successEmbed, errorEmbed } from '../../services/embed';
import { isModuleEnabled } from '../../guards/module';

export const data = new SlashCommandBuilder()
  .setName('twitch')
  .setDescription('Gerer les notifications Twitch')
  .addSubcommand((sub) =>
    sub.setName('add').setDescription('Ajouter un streamer Twitch a surveiller')
      .addStringOption((opt) =>
        opt.setName('channel').setDescription('Nom de la chaine Twitch').setRequired(true)
      )
      .addChannelOption((opt) =>
        opt.setName('salon').setDescription('Salon ou publier la notification').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('remove').setDescription('Supprimer une notification Twitch')
      .addStringOption((opt) =>
        opt.setName('channel').setDescription('Nom de la chaine Twitch').setRequired(true).setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('Lister les notifications Twitch configurees')
  );

export const module = 'notifications';
export const cooldown = 5;
export const permissions = true;
export const requireAdmin = true;

const platform: StreamPlatform = 'TWITCH';

export async function execute(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  if (!interaction.guild) return;

  if (!(await isModuleEnabled(interaction.guild.id, 'notifications'))) {
    await interaction.editReply({ embeds: [errorEmbed('Module desactive', 'Le module notifications est desactive sur ce serveur.')] });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'add':
      await handleAdd(interaction);
      break;
    case 'remove':
      await handleRemove(interaction);
      break;
    case 'list':
      await handleList(interaction);
      break;
  }
}

async function handleAdd(interaction: ChatInputCommandInteraction): Promise<void> {
  const channelName = interaction.options.getString('channel', true).toLowerCase();
  const salon = interaction.options.getChannel('salon', true);
  const channel = interaction.guild?.channels.cache.get(salon.id);

  if (!channel || !channel.isTextBased()) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Le salon doit etre un salon textuel.')] });
    return;
  }

  const existing = await prisma.streamNotification.findUnique({
    where: { guildId_platform_channelName: { guildId: interaction.guild!.id, platform, channelName } },
  });

  if (existing) {
    await interaction.editReply({ embeds: [errorEmbed('Deja configure', channelName + ' est deja surveille.')] });
    return;
  }

  await prisma.streamNotification.create({
    data: {
      guildId: interaction.guild!.id,
      platform,
      channelName,
      discordChannelId: channel.id,
    },
  });

  await interaction.editReply({
    embeds: [successEmbed('Twitch ajoute', channelName + ' sera surveille. Les notifications seront envoyees dans <#' + channel.id + '>.')],
  });
}

async function handleRemove(interaction: ChatInputCommandInteraction): Promise<void> {
  const channelName = interaction.options.getString('channel', true).toLowerCase();

  const existing = await prisma.streamNotification.findUnique({
    where: { guildId_platform_channelName: { guildId: interaction.guild!.id, platform, channelName } },
  });

  if (!existing) {
    await interaction.editReply({ embeds: [errorEmbed('Introuvable', channelName + " n'est pas configure.") ] });
    return;
  }

  await prisma.streamNotification.delete({ where: { id: existing.id } });

  await interaction.editReply({
    embeds: [successEmbed('Twitch supprime', channelName + ' ne sera plus surveille.')],
  });
}

async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {
  const notifications = await prisma.streamNotification.findMany({
    where: { guildId: interaction.guild!.id, platform },
  });

  if (notifications.length === 0) {
    await interaction.editReply({ embeds: [errorEmbed('Aucune notification', 'Aucune chaine Twitch configuree.')] });
    return;
  }

  const lines = notifications.map((n) => {
    const status = n.isLive ? ':red_circle: En live' : ':black_circle: Hors ligne';
    return '**' + n.channelName + '** - ' + status + ' -> <#' + n.discordChannelId + '>';
  });

  const embed = createEmbed('info')
    .setTitle('Notifications Twitch')
    .setDescription(lines.join('\n'));

  await interaction.editReply({ embeds: [embed] });
}

export async function autocomplete(interaction: AutocompleteInteraction, _client: Client): Promise<void> {
  if (!interaction.guild) return;
  const focusedValue = interaction.options.getFocused().toLowerCase();

  const notifications = await prisma.streamNotification.findMany({
    where: { guildId: interaction.guild.id, platform },
    select: { channelName: true },
    take: 25,
  });

  const filtered = notifications
    .filter((n) => n.channelName.includes(focusedValue))
    .map((n) => ({ name: n.channelName, value: n.channelName }));

  await interaction.respond(filtered);
}
