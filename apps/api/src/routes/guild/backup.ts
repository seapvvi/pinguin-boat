import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@pinguin/db';
import { authenticate } from '../../middleware/auth';
import { requireGuildAdmin } from '../../middleware/guild-auth';
import { validateParams } from '../../middleware/validate';
import { success, error, sanitizeError } from '../../utils/response';
import { guildIdSchema, backupIdSchema } from '../../utils/guild-helpers';
import { getGuildChannels, getGuildRoles } from '../../services/discord';
import { botRestoreBackup } from '../../services/bot-proxy';

const guildParam = { preHandler: [authenticate, validateParams(guildIdSchema)] };
const adminParam = { preHandler: [authenticate, requireGuildAdmin, validateParams(guildIdSchema)] };

export async function backupRoutes(app: FastifyInstance) {
  // GET: List all backups for a guild
  app.get('/', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const backups = await prisma.guildBackup.findMany({
        where: { guildId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          createdAt: true,
          channelCount: true,
          roleCount: true,
          size: true,
        },
      });
      reply.send(success(backups as unknown as Record<string, unknown>[]));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  // POST: Create a new backup
  app.post('/', adminParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as { name?: string };

      // Fetch current state of channels and roles from Discord
      const [channels, roles] = await Promise.all([
        getGuildChannels(guildId),
        getGuildRoles(guildId),
      ]);

      const backupData = {
        channels: channels.map((c: any) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          position: c.position,
          parentId: c.parent_id,
          permissionOverwrites: c.permission_overwrites,
          topic: c.topic,
          nsfw: c.nsfw,
          bitrate: c.bitrate,
          userLimit: c.user_limit,
          rateLimitPerUser: c.rate_limit_per_user,
        })),
        roles: roles
          .filter((r: any) => r.id !== guildId)
          .map((r: any) => ({
            id: r.id,
            name: r.name,
            color: r.color,
            hoist: r.hoist,
            position: r.position,
            permissions: r.permissions,
            mentionable: r.mentionable,
            unicodeEmoji: r.unicode_emoji,
            icon: r.icon,
          })),
      };

      const jsonData = JSON.stringify(backupData);
      const sizeKb = Math.round((new TextEncoder().encode(jsonData).length / 1024) * 100) / 100;
      const channelCount = backupData.channels.length;
      const roleCount = backupData.roles.length;
      const name = body.name || `Backup ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

      const backup = await prisma.guildBackup.create({
        data: {
          guildId,
          name,
          data: jsonData,
          channelCount,
          roleCount,
          size: sizeKb,
        },
      });

      reply.status(201).send(success({
        id: backup.id,
        name: backup.name,
        createdAt: backup.createdAt,
        channelCount: backup.channelCount,
        roleCount: backup.roleCount,
        size: backup.size,
      }, 'Backup créé avec succès'));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  // GET: Get a specific backup by ID
  app.get('/:backupId', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, backupId } = request.params as { guildId: string; backupId: string };
      const backup = await prisma.guildBackup.findFirst({
        where: { id: backupId, guildId },
      });
      if (!backup) return reply.status(404).send(error('Backup introuvable'));
      reply.send(success(backup as unknown as Record<string, unknown>));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  // POST: Restore a backup
  app.post('/:backupId/restore', adminParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, backupId } = request.params as { guildId: string; backupId: string };
      const backup = await prisma.guildBackup.findFirst({
        where: { id: backupId, guildId },
      });
      if (!backup) return reply.status(404).send(error('Backup introuvable'));

      const backupData = JSON.parse(backup.data);
      const result = await botRestoreBackup(guildId, backupData);

      reply.send(success({
        channelsRestored: result.channelsRestored,
        rolesRestored: result.rolesRestored,
      }, 'Restauration effectuée avec succès'));
    } catch (err: any) {
      if (err.message === 'BOT_OFFLINE') {
        reply.status(503).send(error('Le bot est hors ligne. Impossible de restaurer le backup.'));
      } else {
        reply.status(500).send(error(sanitizeError(err)));
      }
    }
  });

  // DELETE: Delete a backup
  app.delete('/:backupId', adminParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, backupId } = request.params as { guildId: string; backupId: string };
      const backup = await prisma.guildBackup.findFirst({
        where: { id: backupId, guildId },
      });
      if (!backup) return reply.status(404).send(error('Backup introuvable'));

      await prisma.guildBackup.delete({ where: { id: backupId } });
      reply.send(success(null, 'Backup supprimé'));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });
}