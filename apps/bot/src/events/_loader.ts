import { readdirSync } from 'fs';
import { join } from 'path';
import { Client } from 'discord.js';
import { logger } from '@pinguin/shared';

export function loadEvents(client: Client): void {
  const eventsPath = join(__dirname);
  const eventFiles = readdirSync(eventsPath).filter(
    (file) =>
      (file.endsWith('.ts') || file.endsWith('.js')) &&
      !file.startsWith('_')
  );

  for (const file of eventFiles) {
    const eventModule = require(join(eventsPath, file));
    const eventHandler = eventModule.default || eventModule;

    const eventName: string = eventHandler.name || file.replace(/\.(ts|js)$/, '');

    if (!eventHandler.execute) {
      logger.warn(`[Bot] Événement ignoré (execute manquant): ${file}`);
      continue;
    }

    if (eventHandler.once) {
      client.once(eventName, (...args: unknown[]) => eventHandler.execute(...args, client));
    } else {
      client.on(eventName, (...args: unknown[]) => eventHandler.execute(...args, client));
    }
    logger.info(`[Bot] Événement chargé: ${eventName}`);
  }
}
