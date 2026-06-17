import { FastifyRequest, FastifyReply } from 'fastify';
import { getGuildMember, getGuild } from '../services/discord';
import { canManageGuild } from '@pinguin/shared';
import { prisma } from '@pinguin/db';
import { error } from '../utils/response';

export async function requireGuildAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { guildId } = request.params as { guildId: string };
  const discordId = request.user!.discordId;
  try {
    const dbGuild = await prisma.guild.findUnique({ where: { id: guildId }, select: { ownerId: true } });
    if (dbGuild?.ownerId === discordId) return;

    try {
      const guild = await getGuild(guildId);
      if (guild.owner_id === discordId) return;
    } catch {
      // Discord indisponible — on continue avec les permissions membre
    }

    const member = await getGuildMember(guildId, discordId);
    if (!canManageGuild(member.permissions ?? '0')) {
      reply.status(403).send(error('Permissions insuffisantes sur ce serveur'));
      return;
    }
  } catch {
    reply.status(403).send(error('Vous n\'êtes pas membre de ce serveur'));
  }
}

export async function requireGuildMember(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { guildId } = request.params as { guildId: string };
  const discordId = request.user!.discordId;
  try {
    await getGuildMember(guildId, discordId);
  } catch {
    reply.status(403).send(error('Vous n\'êtes pas membre de ce serveur'));
  }
}
