import { FastifyRequest, FastifyReply } from 'fastify';
import { getGuildMember, canManageGuild } from '../services/discord';
import { error } from '../utils/response';

export async function requireGuildAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { guildId } = request.params as { guildId: string };
  const discordId = request.user!.discordId;
  try {
    const member = await getGuildMember(guildId, discordId);
    if (!canManageGuild(member.permissions ?? '0')) {
      reply.status(403).send(error('Permissions insuffisantes sur ce serveur'));
      return;
    }
  } catch {
    reply.status(403).send(error('Vous n\'êtes pas membre de ce serveur'));
  }
}
