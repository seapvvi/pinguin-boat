import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@pinguin/db';
import { authenticate } from '../middleware/auth';
import { requireGuildAdmin } from '../middleware/guild-auth';
import { validateParams, validateBody } from '../middleware/validate';
import { success, error, sanitizeError } from '../utils/response';
import { z } from 'zod';

const guildIdSchema = z.object({ guildId: z.string().min(1) });
const guildIdWithUserIdSchema = z.object({ guildId: z.string().min(1), userId: z.string().min(1) });
const createBlacklistSchema = z.object({ userId: z.string().min(1), reason: z.string().min(1) });

const guildAdminGuard = { preHandler: [authenticate, validateParams(guildIdSchema), requireGuildAdmin] };
const guildAdminWithUserGuard = { preHandler: [authenticate, validateParams(guildIdWithUserIdSchema), requireGuildAdmin] };

export async function blacklistRoutes(app: FastifyInstance) {
  app.get('/guilds/:guildId/blacklist', guildAdminGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const blacklist = await prisma.guildBlacklistUser.findMany({
        where: { guildId },
        orderBy: { createdAt: 'desc' },
      });
      reply.send(success({ blacklist }));
    } catch (err: any) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.post('/guilds/:guildId/blacklist', { preHandler: [authenticate, validateParams(guildIdSchema), validateBody(createBlacklistSchema), requireGuildAdmin] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const { userId, reason } = request.body as { userId: string; reason: string };
      const moderatorId = request.user!.discordId;

      const existing = await prisma.guildBlacklistUser.findUnique({
        where: { guildId_userId: { guildId, userId } },
      });

      if (existing) {
        return reply.status(409).send(error('Cet utilisateur est déjà blacklisté sur ce serveur'));
      }

      const entry = await prisma.guildBlacklistUser.create({
        data: { guildId, userId, reason, moderatorId },
      });

      reply.send(success({ entry }, 'Utilisateur ajouté à la blacklist'));
    } catch (err: any) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.delete('/guilds/:guildId/blacklist/:userId', guildAdminWithUserGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, userId } = request.params as { guildId: string; userId: string };

      const existing = await prisma.guildBlacklistUser.findUnique({
        where: { guildId_userId: { guildId, userId } },
      });

      if (!existing) {
        return reply.status(404).send(error('Cet utilisateur n\'est pas blacklisté sur ce serveur'));
      }

      await prisma.guildBlacklistUser.delete({
        where: { guildId_userId: { guildId, userId } },
      });

      reply.send(success(null, 'Utilisateur retiré de la blacklist'));
    } catch (err: any) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });
}
