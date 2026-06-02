import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { Client } from 'discord.js';
import { logger } from '@pinguin/shared';

export function loadCommands(client: Client): void {
  const commandsPath = join(__dirname);

  const categories = readdirSync(commandsPath).filter((item) => {
    const itemPath = join(commandsPath, item);
    return statSync(itemPath).isDirectory() && item !== '_loader';
  });

  for (const category of categories) {
    const categoryPath = join(commandsPath, category);
    const commandFiles = readdirSync(categoryPath).filter(
      (file) => (file.endsWith('.ts') || file.endsWith('.js')) && !file.startsWith('_')
    );

    for (const file of commandFiles) {
      const commandModule = require(join(categoryPath, file));
      const command = commandModule.default || commandModule;

      if (!command.data || !command.execute) {
        logger.warn(`Commande ignorée (data/execute manquant): ${category}/${file}`);
        continue;
      }

      if (client.commands.has(command.data.name)) {
        logger.warn(`DOUBLON détecté : ${command.data.name} dans ${category}/${file}`);
      }
      client.commands.set(command.data.name, command);
      logger.info(`Commande chargée: ${command.data.name}`);
    }
  }
}
