import { REST, Routes, Client } from 'discord.js';
import { getConfig } from '@pinguin/config';
import { logger } from '@pinguin/shared';

export async function registerCommands(client: Client): Promise<void> {
  const config = getConfig();
  const commands = [...client.commands.values()].map((cmd) => cmd.data.toJSON());

  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);
  const isDev = config.NODE_ENV === 'development';
  const devGuildId = isDev ? config.DISCORD_DEV_GUILD_ID : undefined;

  try {
    logger.info(`[Bot] Enregistrement de ${commands.length} commandes...`);

    if (devGuildId) {
      // En dev avec guild de test : on n'enregistre QUE sur la guild.
      // L'enregistrement global créérait des doublons (Discord affiche les deux sources).
      await rest.put(Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, devGuildId), {
        body: commands,
      });
      logger.info(`[Bot] Commandes enregistrées sur la guild dev ${devGuildId} (instantané, aucune globale)`);
    } else {
      // Production ou dev sans guild cible : global uniquement.
      await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), { body: commands });
      logger.info('[Bot] Commandes enregistrées globalement (propagation ~1h)');
    }
  } catch (error) {
    logger.error('[Bot] Erreur lors de l\'enregistrement des commandes', { err: error instanceof Error ? error.message : String(error) });
  }
}
