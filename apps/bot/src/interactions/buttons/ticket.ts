import { ButtonInteraction, Client } from 'discord.js';
import { registry } from '../registry';
import { requireModule } from '../../guards/module';
import { errorEmbed } from '../../services/embed';

async function handleTicketButton(interaction: ButtonInteraction, client: Client): Promise<void> {
  const moduleCheck = await requireModule(interaction.guildId!, 'tickets');
  if (!moduleCheck.enabled) {
    await interaction.reply({ embeds: [errorEmbed('Module désactivé', moduleCheck.message!)], ephemeral: true });
    return;
  }

  const { handleTicketButton } = await import('../../commands/tickets/ticket-button');
  await handleTicketButton(interaction, client);
}

registry.registerButton('ticket_', 'prefix', handleTicketButton);
