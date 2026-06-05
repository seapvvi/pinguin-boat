import { StringSelectMenuInteraction, Client } from 'discord.js';
import { registry } from '../registry';

async function handleHelpSelect(interaction: StringSelectMenuInteraction, client: Client): Promise<void> {
  const { handleHelpSelect } = await import('../../commands/utility/help');
  await handleHelpSelect(interaction, client);
}

registry.registerSelect('help_category_select', 'exact', handleHelpSelect);
