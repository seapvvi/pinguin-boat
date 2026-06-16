import { Invite, Client } from 'discord.js';
import { addInvite } from '../services/invite-cache';
import { logger } from '@pinguin/shared';

export async function execute(invite: Invite, _client: Client): Promise<void> {
  const guild = invite.guild;
  if (!guild) return;

  try {
    addInvite(guild.id, invite.code, {
      uses: invite.uses ?? 0,
      inviterId: invite.inviterId,
    });
    logger.debug(`Invite créée: ${invite.code} dans ${guild.name}`, { app: 'bot' });
  } catch (error) {
    logger.error(`Erreur lors de l'ajout de l'invite ${invite.code} au cache`, { error, app: 'bot' });
  }
}
