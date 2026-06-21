import { Client, TextChannel, PermissionFlagsBits, ChannelType } from 'discord.js';
import { prisma } from '@pinguin/db';
import { errorEmbed, successEmbed } from './embed';

export interface OpenTicketOptions {
  guildId: string;
  userId: string;
  username: string;
  subject: string;
  description?: string;
  categoryId?: string;
  client: Client;
}

export async function openTicket(options: OpenTicketOptions): Promise<{ success: boolean; channel?: TextChannel; error?: string }> {
  const { guildId, userId, username, subject, description, categoryId, client } = options;

  const guild = await client.guilds.fetch(guildId);
  if (!guild) {
    return { success: false, error: 'Serveur introuvable.' };
  }

  // Fetch TicketSettings and GuildSettings
  const [ticketSettings, guildSettings] = await Promise.all([
    prisma.ticketSettings.findUnique({ where: { guildId } }),
    prisma.guildSettings.findUnique({ where: { guildId } }),
  ]);

  // Check max open tickets limit
  const maxOpenTickets = ticketSettings?.maxOpenPerUser ?? 1;
  const openTicketsCount = await prisma.ticket.count({
    where: {
      guildId,
      creatorId: userId,
      status: { in: ['OPEN', 'CLAIMED', 'PENDING'] },
    },
  });

  if (openTicketsCount >= maxOpenTickets) {
    return {
      success: false,
      error: `Vous avez déjà **${openTicketsCount}** ticket(s) ouvert(s). La limite est de **${maxOpenTickets}**. Veuillez fermer un ticket existant avant d'en ouvrir un nouveau.`,
    };
  }

  // Check bot permissions
  const botMember = await guild.members.fetch(client.user!.id);
  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return { success: false, error: 'Le bot doit avoir la permission **Gérer les salons** (ou Administrateur) sur ce serveur pour créer des tickets.' };
  }

  // Create ticket channel
  let ticketChannel: TextChannel;
  try {
    const channelName = ticketSettings?.channelFormat
      ? ticketSettings.channelFormat.replace('{username}', username.toLowerCase().replace(/[^a-z0-9]/g, ''))
      : `ticket-${username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

    const parent = categoryId ? categoryId : (ticketSettings?.categoryId ?? undefined);

    const permissionOverwrites = [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: client.user!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
    ];

    if (guildSettings?.modRoleIds) {
      try {
        const modRoleIds = JSON.parse(guildSettings.modRoleIds) as string[];
        for (const roleId of modRoleIds) {
          if (!permissionOverwrites.find(p => p.id === roleId)) {
            permissionOverwrites.push({
              id: roleId,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
            });
          }
        }
      } catch {
        // Invalid JSON, ignore
      }
    }

    ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent,
      permissionOverwrites,
      reason: `Ticket ouvert par ${username}`,
    }) as TextChannel;
  } catch (error) {
    const code = (error as any)?.code ?? (error as any)?.rawError?.code;
    if (code === 50013) {
      return { success: false, error: 'Permissions manquantes. Le bot doit avoir les permissions **Gérer les salons** et **Gérer les rôles** (ou Administrateur) sur ce serveur.' };
    }
    return { success: false, error: 'Impossible de créer le salon ticket. Vérifiez que le bot a les permissions nécessaires.' };
  }

  // Create ticket record
  const ticket = await prisma.ticket.create({
    data: {
      guildId,
      channelId: ticketChannel.id,
      creatorId: userId,
      subject,
      description,
      status: 'OPEN',
      categoryId: categoryId || ticketSettings?.categoryId,
    },
  });

  // transcriptId is set later when the transcript is generated; do not store channelId here

  // Mention moderators if enabled
  if (ticketSettings?.mentionModerators && guildSettings?.modRoleIds) {
    try {
      const modRoleIds = JSON.parse(guildSettings.modRoleIds) as string[];
      if (modRoleIds.length > 0 && modRoleIds[0]) {
        await ticketChannel.send(`<@&${modRoleIds[0]}>`);
      }
    } catch {
      // Invalid JSON, ignore
    }
  }

  return { success: true, channel: ticketChannel };
}
