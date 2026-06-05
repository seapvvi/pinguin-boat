import { ButtonInteraction, Client } from 'discord.js';
import { registry } from '../registry';

async function handleHelpPagination(interaction: ButtonInteraction, client: Client): Promise<void> {
  const { handleHelpPagination } = await import('../../commands/utility/help');
  const direction = interaction.customId.startsWith('help_prev_') ? 'prev' : 'next';
  await handleHelpPagination(interaction, client, direction);
}

registry.registerButton('help_prev_', 'prefix', handleHelpPagination);
registry.registerButton('help_next_', 'prefix', handleHelpPagination);
