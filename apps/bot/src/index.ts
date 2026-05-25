import { getConfig } from '@pinguin/config';
import { prisma } from '@pinguin/db';
import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import { registerCommands } from './utils/register';
import { loadEvents } from './events/_loader';
import { loadCommands } from './commands/_loader';
import { startInternalBotApi } from './internal/bot-api';

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
    console.log('[Bot] Connecté à PostgreSQL');

    loadCommands(client);
    loadEvents(client);

    await registerCommands(client);

    await client.login(config.DISCORD_TOKEN);
    console.log('[Bot] Connecté à Discord');

    startInternalBotApi(client);
    console.log('[Bot] API interne démarrée');
  } catch (error) {
    console.error('[Bot] Erreur de démarrage:', error);
    process.exit(1);
  }
}

start();

process.on('SIGTERM', async () => {
  console.log('[Bot] Arrêt...');
  client.destroy();
  await prisma.$disconnect();
  process.exit(0);
});
