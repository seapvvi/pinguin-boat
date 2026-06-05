import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@pinguin/db';
import { authenticate } from '../middleware/auth';
import { requireGuildAdmin } from '../middleware/guild-auth';
import { validateParams, validateBody } from '../middleware/validate';
import { success, error, sanitizeError } from '../utils/response';
import { z } from 'zod';

const guildIdSchema = z.object({ guildId: z.string().min(1) });
const notificationIdSchema = z.object({ guildId: z.string().min(1), id: z.string().min(1) });

const createNotificationSchema = z.object({
  platform: z.enum(['TWITCH', 'YOUTUBE']),
  channelName: z.string().min(1),
  discordChannelId: z.string().min(1),
  channelId: z.string().optional(),
});

const updateNotificationSchema = z.object({
  discordChannelId: z.string().min(1).optional(),
  channelId: z.string().optional(),
});

const guildAdminGuard = { preHandler: [authenticate, requireGuildAdmin, validateParams(guildIdSchema)] };
const notificationAdminGuard = { preHandler: [authenticate, requireGuildAdmin, validateParams(notificationIdSchema)] };

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/:guildId/notifications', guildAdminGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const notifications = await prisma.streamNotification.findMany({
        where: { guildId },
        orderBy: { createdAt: 'desc' },
      });
      reply.send(success({ notifications }));
    } catch (err: any) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.post('/:guildId/notifications', {
    preHandler: [authenticate, requireGuildAdmin, validateParams(guildIdSchema), validateBody(createNotificationSchema)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as z.infer<typeof createNotificationSchema>;

      const notification = await prisma.streamNotification.create({
        data: {
          guildId,
          platform: body.platform,
          channelName: body.channelName,
          discordChannelId: body.discordChannelId,
          channelId: body.channelId || null,
        },
      });

      reply.send(success({ notification }, 'Notification de stream créée'));
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.status(409).send(error('Cette notification existe déjà pour ce serveur'));
      }
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.patch('/:guildId/notifications/:id', {
    preHandler: [authenticate, requireGuildAdmin, validateParams(notificationIdSchema), validateBody(updateNotificationSchema)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as { guildId: string; id: string };
      const body = request.body as z.infer<typeof updateNotificationSchema>;

      const existing = await prisma.streamNotification.findUnique({
        where: { id },
      });

      if (!existing) {
        return reply.status(404).send(error('Notification introuvable'));
      }

      if (existing.guildId !== guildId) {
        return reply.status(403).send(error('Cette notification n\'appartient pas à ce serveur'));
      }

      const notification = await prisma.streamNotification.update({
        where: { id },
        data: {
          ...(body.discordChannelId && { discordChannelId: body.discordChannelId }),
          ...(body.channelId !== undefined && { channelId: body.channelId || null }),
        },
      });

      reply.send(success({ notification }, 'Notification mise à jour'));
    } catch (err: any) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.delete('/:guildId/notifications/:id', notificationAdminGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as { guildId: string; id: string };

      const existing = await prisma.streamNotification.findUnique({
        where: { id },
      });

      if (!existing) {
        return reply.status(404).send(error('Notification introuvable'));
      }

      if (existing.guildId !== guildId) {
        return reply.status(403).send(error('Cette notification n\'appartient pas à ce serveur'));
      }

      await prisma.streamNotification.delete({
        where: { id },
      });

      reply.send(success(null, 'Notification supprimée'));
    } catch (err: any) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });
}
