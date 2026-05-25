import { ButtonInteraction, Client, TextChannel, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { errorEmbed, successEmbed, createEmbed } from '../../services/embed';
import { closeTicketViaApi } from '../../services/ticket-close';

export async function handleTicketButton(interaction: ButtonInteraction, client: Client): Promise<void> {
  const { customId, guild, user, channel } = interaction;
  if (!guild) return;

  if (customId === 'ticket_open') {
    await handleTicketOpen(interaction, client);
    return;
  }

  if (customId === 'ticket_close') {
    await handleTicketClose(interaction);
    return;
  }

  if (customId === 'ticket_claim') {
    await handleTicketClaim(interaction);
    return;
  }
}

async function handleTicketOpen(interaction: ButtonInteraction, client: Client): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const existing = await prisma.ticket.findMany({
    where: { guildId: interaction.guildId!, creatorId: interaction.user.id, status: { in: ['OPEN', 'CLAIMED', 'PENDING'] } },
  });

  const categories = await prisma.ticketCategory.findMany({ where: { guildId: interaction.guildId! } });
  const maxTickets = categories.length > 0 ? categories[0].maxTicketsPerUser : 5;

  if (existing.length >= maxTickets) {
    await interaction.editReply({ embeds: [errorEmbed('Limite atteinte', `Tu as déjà **${existing.length}** ticket(s) ouverts.`)] });
    return;
  }

  await ensureUser(interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL());

  const ticketChannel = await interaction.guild!.channels.create({
    name: `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    type: ChannelType.GuildText,
    permissionOverwrites: [
      { id: interaction.guild!.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: client.user!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
    ],
    reason: `Ticket ouvert par ${interaction.user.tag}`,
  });

  const ticket = await prisma.ticket.create({
    data: {
      guildId: interaction.guildId!,
      channelId: ticketChannel.id,
      creatorId: interaction.user.id,
      subject: 'Support',
      status: 'OPEN',
    },
  });

  const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Fermer').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
    new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setStyle(ButtonStyle.Success).setEmoji('🤚'),
  );

  const ticketEmbed = createEmbed('ticket')
    .setTitle('Ticket — Support')
    .setDescription('Un membre de l\'équipe va te répondre sous peu.')
    .addFields(
      { name: 'Ouvert par', value: interaction.user.toString(), inline: true },
      { name: 'Statut', value: '🟢 Ouvert', inline: true },
    )
    .setTimestamp();

  await ticketChannel.send({ content: interaction.user.toString(), embeds: [ticketEmbed], components: [closeRow] });
  await interaction.editReply({ embeds: [successEmbed('Ticket ouvert', `Ton ticket a été créé : ${ticketChannel}`)] });
}

async function handleTicketClose(interaction: ButtonInteraction): Promise<void> {
  const ticket = await prisma.ticket.findUnique({ where: { channelId: interaction.channelId } });
  if (!ticket || ticket.guildId !== interaction.guildId) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Ce salon n\'est pas un ticket.')], ephemeral: true });
    return;
  }

  if (ticket.status === 'CLOSED') {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Ce ticket est déjà fermé.')], ephemeral: true });
    return;
  }

  if (ticket.creatorId !== interaction.user.id && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ embeds: [errorEmbed('Permission refusée', 'Seul le créateur ou un admin peut fermer.')], ephemeral: true });
    return;
  }

  const ch = interaction.channel as TextChannel;
  try {
    const member = await interaction.guild!.members.fetch(ticket.creatorId);
    await ch.permissionOverwrites.edit(member, { ViewChannel: false });
  } catch {}

  await interaction.reply({ embeds: [successEmbed('Fermé', 'Ticket fermé. Transcription en cours…')] });

  await closeTicketViaApi(ticket.id, interaction.user.id, interaction.guild!.name);

  setTimeout(async () => {
    try {
      await ch.delete('Ticket fermé');
      await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'DELETED' } });
    } catch {}
  }, 30000);
}

async function handleTicketClaim(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
    await interaction.reply({ embeds: [errorEmbed('Permission refusée', 'Permissions de modération requises.')], ephemeral: true });
    return;
  }

  const ticket = await prisma.ticket.findUnique({ where: { channelId: interaction.channelId } });
  if (!ticket || ticket.guildId !== interaction.guildId) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Ce salon n\'est pas un ticket.')], ephemeral: true });
    return;
  }

  if (ticket.claimedById) {
    await interaction.reply({ embeds: [errorEmbed('Déjà claim', `Par <@${ticket.claimedById}>.`)], ephemeral: true });
    return;
  }

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: 'CLAIMED', claimedById: interaction.user.id },
  });

  await (interaction.channel as TextChannel)?.setName(`claimed-${ticket.subject.slice(0, 24).toLowerCase().replace(/[^a-z0-9]/g, '-')}`).catch(() => {});
  await interaction.reply({ embeds: [successEmbed('Claim', `Ticket claim par ${interaction.user}.`)] });
}
