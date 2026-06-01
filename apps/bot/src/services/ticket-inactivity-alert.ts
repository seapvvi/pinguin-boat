import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { prisma } from '@pinguin/db';
import { createEmbed } from './embed';

const runningIntervals = new Map<string, NodeJS.Timeout>();

async function isTicketsModuleActive(guildId: string): Promise<boolean> {
  const moduleEnabled = await prisma.moduleEnabled.findUnique({
    where: { guildId },
  });
  return moduleEnabled?.tickets ?? false;
}

async function getTicketSettings(guildId: string) {
  return await prisma.ticketSettings.findUnique({
    where: { guildId },
  });
}

async function checkInactiveTickets(client: Client, guildId: string): Promise<void> {
  const active = await isTicketsModuleActive(guildId);
  if (!active) {
    stopInactivityAlertCron(guildId);
    return;
  }

  const settings = await getTicketSettings(guildId);
  if (!settings?.enabled || settings.inactivityAlertHours <= 0) {
    return;
  }

  const threshold = new Date(Date.now() - settings.inactivityAlertHours * 60 * 60 * 1000);

  const inactiveTickets = await prisma.ticket.findMany({
    where: {
      guildId,
      status: { in: ['OPEN', 'CLAIMED'] },
      updatedAt: { lt: threshold },
    },
    include: {
      creator: true,
      claimedBy: true,
    },
  });

  if (inactiveTickets.length === 0) {
    return;
  }

  const moderatorRoles = JSON.parse(settings.moderatorRoles) as string[];
  const mentionModerators = settings.mentionModerators;

  for (const ticket of inactiveTickets) {
    try {
      const channel = await client.channels.fetch(ticket.channelId) as TextChannel;
      if (!channel) continue;

      const lastMessage = await channel.messages
        .fetch({ limit: 1 })
        .then((messages) => messages.first())
        .catch(() => null);

      if (!lastMessage) continue;

      const lastMessageTime = lastMessage.createdAt;
      const inactivityThreshold = new Date(Date.now() - settings.inactivityAlertHours * 60 * 60 * 1000);

      if (lastMessageTime >= inactivityThreshold) {
        continue;
      }

      const moderatorMentions = mentionModerators && moderatorRoles.length > 0
        ? moderatorRoles.map((roleId) => `<@&${roleId}>`).join(' ')
        : '';

      const embed = createEmbed('ticket')
        .setTitle('⚠️ Ticket inactif')
        .setDescription(`Ce ticket n'a reçu aucun message depuis plus de **${settings.inactivityAlertHours} heure(s)**.`)
        .addFields(
          { name: 'Sujet', value: ticket.subject, inline: true },
          { name: 'Statut', value: ticket.status === 'OPEN' ? '🟢 Ouvert' : '🤚 Claimé', inline: true },
          { name: 'Créé par', value: `<@${ticket.creatorId}>`, inline: true },
        )
        .setTimestamp();

      if (ticket.claimedBy) {
        embed.addFields({ name: 'Claimé par', value: `<@${ticket.claimedBy.discordId}>`, inline: true });
      }

      await channel.send({
        content: moderatorMentions || undefined,
        embeds: [embed],
      });

      console.log(`[TicketInactivity] Alerte envoyée pour le ticket ${ticket.id} dans ${guildId}`);
    } catch (error) {
      console.error(`[TicketInactivity] Erreur lors de l'envoi de l'alerte pour le ticket ${ticket.id}:`, error);
    }
  }
}

export async function startInactivityAlertCron(client: Client, guildId: string): Promise<void> {
  if (runningIntervals.has(guildId)) {
    return;
  }

  const settings = await getTicketSettings(guildId);
  if (!settings?.enabled || settings.inactivityAlertHours <= 0) {
    return;
  }

  const interval = setInterval(async () => {
    try {
      await checkInactiveTickets(client, guildId);
    } catch (error) {
      console.error(`[TicketInactivity] Erreur lors de la vérification des tickets inactifs pour ${guildId}:`, error);
    }
  }, 30 * 60 * 1000);

  runningIntervals.set(guildId, interval);
  console.log(`[TicketInactivity] Cron d'alertes d'inactivité démarré pour ${guildId} (toutes les 30 minutes)`);
}

export function stopInactivityAlertCron(guildId: string): void {
  const interval = runningIntervals.get(guildId);
  if (interval) {
    clearInterval(interval);
    runningIntervals.delete(guildId);
    console.log(`[TicketInactivity] Cron d'alertes d'inactivité arrêté pour ${guildId}`);
  }
}

export function stopAllInactivityAlertCrons(): void {
  for (const [guildId, interval] of runningIntervals.entries()) {
    clearInterval(interval);
    console.log(`[TicketInactivity] Cron d'alertes d'inactivité arrêté pour ${guildId}`);
  }
  runningIntervals.clear();
}

export async function initializeInactivityAlertCrons(client: Client, guildIds: string[]): Promise<void> {
  for (const guildId of guildIds) {
    try {
      const active = await isTicketsModuleActive(guildId);
      if (!active) continue;

      const settings = await getTicketSettings(guildId);
      if (settings?.enabled && settings.inactivityAlertHours > 0) {
        startInactivityAlertCron(client, guildId);
      }
    } catch (error) {
      console.error(`[TicketInactivity] Erreur lors de l'initialisation du cron d'alertes d'inactivité pour ${guildId}:`, error);
    }
  }
}
