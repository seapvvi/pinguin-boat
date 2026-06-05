import { ButtonInteraction, Client } from 'discord.js';
import { registry } from '../registry';

async function handleChangelogPagination(interaction: ButtonInteraction, client: Client): Promise<void> {
  const { handleChangelogPagination } = await import('../../commands/utility/changelog');
  await handleChangelogPagination(interaction, client);
}

registry.registerButton('changelog_prev_', 'prefix', handleChangelogPagination);
registry.registerButton('changelog_next_', 'prefix', handleChangelogPagination);
