import { ModalSubmitInteraction, Client } from 'discord.js';
import { registry } from '../registry';

async function handleWarnModal(interaction: ModalSubmitInteraction, client: Client): Promise<void> {
  const { handleModalSubmit } = await import('../../commands/moderation/warn-context');
  await handleModalSubmit(interaction, client);
}

registry.registerModal('warn_modal_', 'prefix', handleWarnModal);
