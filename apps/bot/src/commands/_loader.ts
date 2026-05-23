import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { Client } from 'discord.js';

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
        console.warn(`[Bot] Commande ignorée (data/execute manquant): ${category}/${file}`);
        continue;
      }

      client.commands.set(command.data.name, command);
      console.log(`[Bot] Commande chargée: ${command.data.name}`);
    }
  }
}
