import { Invite, Client } from 'discord.js';
import { removeInvite } from '../services/invite-cache';
import { logger } from '@pinguin/shared';

export const name = 'inviteDelete';

export async function execute(invite: Invite, _client: Client): Promise<void> {
  const guild = invite.guild;
  if (!guild) return;

  try {
    removeInvite(guild.id, invite.code);
    logger.debug(`Invite supprimée: ${invite.code} dans ${guild.name}`, { app: 'bot' });
  } catch (error) {
    logger.error(`Erreur lors de la suppression de l'invite ${invite.code} du cache`, { error, app: 'bot' });
  }
}
