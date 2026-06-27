import { REST, Routes, Client } from 'discord.js';
import { getConfig } from '@pinguin/config';
import { logger } from '@pinguin/shared';

export async function registerCommands(client: Client): Promise<void> {
  const config = getConfig();
  const commands = [...client.commands.values()].map((cmd) => cmd.data.toJSON());

  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);

  try {
    logger.info(`[Bot] Enregistrement de ${commands.length} commandes...`);

    // Toujours enregistrer globalement (disponible sur tous les serveurs)
    await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), { body: commands });
    logger.info('[Bot] Commandes enregistrées globalement');

    // En dev, aussi enregistrer sur la guild de test pour mise à jour instantanée
    if (config.NODE_ENV === 'development' && config.DISCORD_DEV_GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_DEV_GUILD_ID), {
        body: commands,
      });
      logger.info(`[Bot] Commandes aussi enregistrées sur la guild dev ${config.DISCORD_DEV_GUILD_ID} (instantané)`);
    }
  } catch (error) {
    logger.error('[Bot] Erreur lors de l\'enregistrement des commandes', { err: error instanceof Error ? error.message : String(error) });
  }
}
