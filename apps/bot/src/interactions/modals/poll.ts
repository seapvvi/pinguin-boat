import { ModalSubmitInteraction, Client } from 'discord.js';
import { registry } from '../registry';

async function handlePollCreateModal(interaction: ModalSubmitInteraction, client: Client): Promise<void> {
  const { handlePollCreateModal } = await import('../../commands/polls/poll-create-modal');
  await handlePollCreateModal(interaction, client);
}

registry.registerModal('poll_create', 'exact', handlePollCreateModal);
