import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits, TextChannel, ChannelType, ButtonBuilder, ButtonStyle, ActionRowBuilder, OverwriteType } from 'discord.js';
import { errorEmbed, successEmbed, warningEmbed } from '../../services/embed';

export const data = new SlashCommandBuilder()
  .setName('nuke')
  .setDescription('Recréer un salon (supprime et clone le salon actuel)')
  .addChannelOption((opt) =>
    opt.setName('channel').setDescription('Salon à recréer').addChannelTypes(ChannelType.GuildText)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export const permissions = true;
export const requireAdmin = true;
export const module = 'moderation';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const channel = (interaction.options.get('channel')?.channel as TextChannel) ?? interaction.channel;

  if (!channel || !interaction.guild) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Salon invalide.')], ephemeral: true });
    return;
  }

  const confirmButton = new ButtonBuilder()
    .setCustomId('nuke_confirm')
    .setLabel('Confirmer')
    .setStyle(ButtonStyle.Danger);

  const cancelButton = new ButtonBuilder()
    .setCustomId('nuke_cancel')
    .setLabel('Annuler')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

  await interaction.reply({
    embeds: [warningEmbed('Confirmation', `Êtes-vous sûr de vouloir recréer ${channel} ?\nCette action est irréversible.`)],
    components: [row],
    ephemeral: true,
  });

  const filter = (i: any) => i.user.id === interaction.user.id;
  const collected = await interaction.channel?.awaitMessageComponent({ filter, time: 30000 }).catch(() => null);

  if (!collected) {
    await interaction.editReply({ embeds: [errorEmbed('Annulé', 'Temps écoulé. Opération annulée.')], components: [] });
    return;
  }

  if (collected.customId === 'nuke_cancel') {
    await collected.update({ embeds: [errorEmbed('Annulé', 'Opération annulée.')], components: [] });
    return;
  }

  await collected.deferUpdate();

  try {
    const position = channel.position;
    const topic = (channel as TextChannel).topic;
    const nsfw = (channel as TextChannel).nsfw;
    const rateLimit = (channel as TextChannel).rateLimitPerUser;
    const parentId = channel.parentId;
    const permissionOverwrites = channel.permissionOverwrites.cache.map((p) => ({
      id: p.id,
      allow: p.allow.bitfield.toString(),
      deny: p.deny.bitfield.toString(),
      type: p.type,
    }));

    await channel.delete(`Salon recréé par ${interaction.user.username}`);

    const newChannel = await interaction.guild.channels.create({
      name: channel.name,
      type: ChannelType.GuildText,
      topic: topic ?? undefined,
      nsfw,
      rateLimitPerUser: rateLimit,
      parent: parentId ?? undefined,
      position,
      reason: `Salon recréé par ${interaction.user.username}`,
    });

    const overwriteData = permissionOverwrites.map((p) => ({
      id: p.id,
      allow: BigInt(p.allow),
      deny: BigInt(p.deny),
      type: p.type as OverwriteType,
    }));

    try {
      await newChannel.permissionOverwrites.set(overwriteData);
    } catch {}

    await newChannel.send({ embeds: [successEmbed('Salon recréé', `Ce salon a été recréé par ${interaction.user.username}.`)] });

    await collected.editReply({ embeds: [successEmbed('Salon recréé', `${newChannel} a été recréé avec succès.`)], components: [] });
  } catch (error) {
    console.error(error);
    await collected.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de recréer le salon.')], components: [] });
  }
}
