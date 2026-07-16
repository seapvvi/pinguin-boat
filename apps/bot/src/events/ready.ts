import { Client, ActivityType } from 'discord.js';
import { getConfig } from '@pinguin/config';
import { prisma } from '@pinguin/db';
import { initializeInterestCrons } from '../services/economy-interests';
import { initializeNotificationCrons } from '../services/economy-notifications';
import { initializeInactivityAlertCrons } from '../services/ticket-inactivity-alert';
import { startStreamNotificationCron } from '../services/stream-notifications';
import { startPollCron } from '../services/poll-cron';
import { initializeInviteCache } from '../services/invite-cache';
import { loadQueueFromDb } from '../services/music';
import { cleanupVoiceTimers } from './voiceStateUpdate';
import { logger } from '@pinguin/shared';

export const name = 'ready';
export const once = true;

export async function execute(client: Client): Promise<void> {
  const config = getConfig();
  const user = client.user!;

  logger.info(`Connecté en tant que ${user.username}`, { app: 'bot' });
  logger.info(`${client.guilds.cache.size} serveurs`, { app: 'bot' });
  logger.info(`${client.users.cache.size} utilisateurs`, { app: 'bot' });

  user.setActivity(config.BOT_ACTIVITY_NAME || '🏔️ Pinguin BOAT | /help', {
    type: config.BOT_ACTIVITY_TYPE as ActivityType,
  });

  for (const guild of client.guilds.cache.values()) {
    try {
      const existing = await prisma.guild.findUnique({ where: { id: guild.id } });
      if (!existing) {
        await prisma.guild.create({
          data: {
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            ownerId: guild.ownerId,
            memberCount: guild.memberCount,
          },
        });
        await prisma.guildSettings.create({
          data: { guildId: guild.id },
        });
        await prisma.moduleEnabled.create({
          data: { guildId: guild.id },
        });
        logger.info(`Guild créée: ${guild.name} (${guild.id})`, { app: 'bot' });
      } else if (!existing.botPresent) {
        await prisma.guild.update({
          where: { id: guild.id },
          data: { botPresent: true, name: guild.name, icon: guild.icon, memberCount: guild.memberCount },
        });
      }
    } catch (error: unknown) {
      logger.error(`Erreur lors de la vérification de la guild ${guild.id}`, { error, app: 'bot' });
    }
  }

  // Sync memberCount périodique
  setInterval(async () => {
    for (const guild of client.guilds.cache.values()) {
      try {
        await prisma.guild.update({
          where: { id: guild.id },
          data: {
            memberCount: guild.memberCount,
            name: guild.name,
            icon: guild.icon,
          },
        });
      } catch {
        /* ignore */
      }
    }
  }, 10 * 60 * 1000);

  // Initialisation du cache d'invites
  for (const guild of client.guilds.cache.values()) {
    await initializeInviteCache(guild);
  }

  const guildIds = Array.from(client.guilds.cache.keys());

  // Nettoyage des timers vocaux orphelins (survit aux crashes)
  cleanupVoiceTimers();

  // Restauration des files d'attente musicales
  for (const guildId of guildIds) {
    await loadQueueFromDb(guildId).catch((err: unknown) => {
      logger.warn('Impossible de restaurer la file musicale', { guildId, err: err instanceof Error ? err.message : String(err) });
    });
  }

  // Initialisation des crons d'intérêts bancaires
  await initializeInterestCrons(guildIds);

  // Initialisation des crons de notifications économiques
  await initializeNotificationCrons(client, guildIds);

  // Initialisation des crons d'alertes d'inactivité de tickets
  await initializeInactivityAlertCrons(client, guildIds);

  // Démarrage du cron de vérification des lives Twitch/YouTube
  startStreamNotificationCron(client);

  // Démarrage du cron de fermeture automatique des sondages
  startPollCron(client);

  logger.info('Prêt !', { app: 'bot' });
}

