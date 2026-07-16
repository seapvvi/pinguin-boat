import { getConfig } from '@pinguin/config';
import { prisma } from '@pinguin/db';
import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import { registerCommands } from './utils/register';
import { loadEvents } from './events/_loader';
import { loadCommands } from './commands/_loader';
import { startInternalBotApi } from './internal/bot-api';
import { startPublicApi } from './internal/public-api';
import { initMusicService, cleanupCookieFile } from './services/music';
import { logger } from '@pinguin/shared';
import './interactions';

const config = getConfig();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildInvites,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Collection();

async function start() {
  try {
    await prisma.$connect();
    logger.info('Connecté à PostgreSQL', { app: 'bot' });

    await loadCommands(client);
    loadEvents(client);

    await registerCommands(client);

    initMusicService().catch((err: unknown) => {
      logger.warn('Service musical indisponible', { err, app: 'bot' });
    });

    await client.login(config.DISCORD_TOKEN);
    logger.info('Connecté à Discord', { app: 'bot' });

    startInternalBotApi(client);
    logger.info('API interne démarrée', { app: 'bot' });

    startPublicApi(client, config.BOT_STATS_PORT);
    logger.info('API publique démarrée', { app: 'bot' });
  } catch (error: unknown) {
    logger.error('Erreur de démarrage', { error, app: 'bot' });
    process.exit(1);
  }
}

start();

// Safety net: never let an unexpected async error crash the whole bot.
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled rejection', { reason, app: 'bot' });
  process.exit(1);
});
process.on('uncaughtException', (err: unknown) => {
  logger.error('Uncaught exception', { err, app: 'bot' });
  process.exit(1);
});

async function shutdown(): Promise<void> {
  logger.info('Arrêt...', { app: 'bot' });
  cleanupCookieFile();
  client.destroy();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

