import { ModalSubmitInteraction, Client } from 'discord.js';
import { registry } from '../registry';

async function handleKickModal(interaction: ModalSubmitInteraction, client: Client): Promise<void> {
  const { handleModalSubmit } = await import('../../commands/moderation/kick-context');
  await handleModalSubmit(interaction, client);
}

registry.registerModal('kick_modal_', 'prefix', handleKickModal);
