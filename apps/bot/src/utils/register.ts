import { REST, Routes, Client } from 'discord.js';
import { getConfig } from '@pinguin/config';
import { logger } from '@pinguin/shared';

export async function registerCommands(client: Client): Promise<void> {
  const config = getConfig();
  const commands = [...client.commands.values()].map((cmd) => cmd.data.toJSON());

  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);

  try {
    logger.info(`[Bot] Enregistrement de ${commands.length} commandes...`);

    if (config.NODE_ENV === 'development') {
      const guildId = config.DISCORD_DEV_GUILD_ID;
      if (guildId) {
        await rest.put(Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, guildId), {
          body: commands,
        });
        logger.info(`[Bot] Commandes enregistrées sur la guild dev ${guildId}`);
      } else {
        console.warn('[WARN] DISCORD_DEV_GUILD_ID non défini — enregistrement global (peut prendre jusqu\'à 1h)');
        await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), { body: commands });
      }
    } else {
      await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), { body: commands });
      logger.info('[Bot] Commandes enregistrées globalement');
    }
  } catch (error) {
    logger.error('[Bot] Erreur lors de l\'enregistrement des commandes', { err: error instanceof Error ? error.message : String(error) });
  }
}
