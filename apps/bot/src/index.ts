import { getConfig } from '@pinguin/config';
import { prisma } from '@pinguin/db';
import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import { registerCommands } from './utils/register';
import { loadEvents } from './events/_loader';
import { loadCommands } from './commands/_loader';
import { startInternalBotApi } from './internal/bot-api';
import { logger } from '@pinguin/shared';

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

    loadCommands(client);
    loadEvents(client);

    await registerCommands(client);

    await client.login(config.DISCORD_TOKEN);
    logger.info('Connecté à Discord', { app: 'bot' });

    startInternalBotApi(client);
    logger.info('API interne démarrée', { app: 'bot' });
  } catch (error: unknown) {
    logger.error('Erreur de démarrage', { error, app: 'bot' });
    process.exit(1);
  }
}

start();

// Safety net: never let an unexpected async error crash the whole bot.
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled rejection', { reason, app: 'bot' });
});
process.on('uncaughtException', (err: unknown) => {
  logger.error('Uncaught exception', { err, app: 'bot' });
});

process.on('SIGTERM', async () => {
  logger.info('Arrêt...', { app: 'bot' });
  client.destroy();
  await prisma.$disconnect();
  process.exit(0);
});

