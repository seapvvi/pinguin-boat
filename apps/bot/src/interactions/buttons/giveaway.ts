import { ButtonInteraction, Client } from 'discord.js';
import { registry } from '../registry';

async function handleGiveawayJoin(interaction: ButtonInteraction, client: Client): Promise<void> {
  const { handleGiveawayJoin } = await import('../../commands/giveaways/giveaway-join');
  await handleGiveawayJoin(interaction, client);
}

registry.registerButton('giveaway_join', 'exact', handleGiveawayJoin);
registry.registerButton('giveaway_join_api', 'exact', handleGiveawayJoin);
