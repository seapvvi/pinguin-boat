import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@pinguin/db';
import { authenticate } from '../../middleware/auth';
import { requireGuildAdmin } from '../../middleware/guild-auth';
import { validateParams } from '../../middleware/validate';
import { success, error, sanitizeError } from '../../utils/response';
import { guildIdSchema, ensureUser } from '../../utils/guild-helpers';
import { sendDM, timeoutMember, kickMember, banMember, unbanMember } from '../../services/discord';

const guildParam = { preHandler: [authenticate, validateParams(guildIdSchema)] };

export async function moderationRoutes(app: FastifyInstance) {
  app.get('/', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '20', 10) || 20));
      const where: Record<string, unknown> = { guildId, deletedAt: null };
      if (q.search) {
        where.OR = [
          { userId: { contains: q.search } },
          { reason: { contains: q.search, mode: 'insensitive' } },
        ];
      }
      if (q.type) {
        where.type = q.type;
      }
      const [modCases, total] = await Promise.all([
        prisma.moderationCase.findMany({
          where, orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
          include: { user: { select: { username: true, avatar: true } } },
        }),
        prisma.moderationCase.count({ where }),
      ]);
      reply.send(success({
        cases: modCases,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.delete('/:caseId', { preHandler: [authenticate, requireGuildAdmin, validateParams(z.object({ guildId: z.string(), caseId: z.string() }))] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, caseId } = request.params as { guildId: string; caseId: string };
      const modCase = await prisma.moderationCase.findFirst({ where: { id: caseId, guildId } });
      if (!modCase) return reply.status(404).send(error('Cas introuvable'));
      await prisma.moderationCase.update({ where: { id: caseId }, data: { deletedAt: new Date() } });
      await prisma.auditLog.create({
        data: {
          guildId, action: 'MODERATION_CASE_DELETED',
          userId: request.user!.id,
          details: JSON.stringify({ caseId, targetUserId: modCase.userId }),
        },
      }).catch(() => {});
      reply.send(success(null, 'Cas supprimé'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;
      const type = body.type as string;
      if (!type || !body.userId || !body.reason)
        return reply.status(400).send(error('Type, utilisateur et raison requis'));
      await ensureUser(body.userId as string);

      const moderatorTag = request.user!.username || 'Dashboard';
      const reason = body.reason as string;
      const durationMs = body.duration ? (body.duration as number) * 60 * 1000 : null;

      switch (type) {
        case 'WARN':
          await sendDM(body.userId as string, {
            embeds: [{
              title: 'Avertissement',
              description: `Vous avez reçu un avertissement sur le serveur.\nRaison : ${reason}`,
              color: 0xFFA500,
              timestamp: new Date().toISOString(),
            }],
          }).catch(() => {});
          break;
        case 'MUTE':
        case 'TIMEOUT':
          await timeoutMember(guildId, body.userId as string, durationMs);
          await sendDM(body.userId as string, {
            embeds: [{
              title: 'Mute',
              description: `Vous avez été rendu muet.\nRaison : ${reason}${durationMs ? `\nDurée : ${Math.round(durationMs / 60000)} minutes` : ''}`,
              color: 0xFF0000,
              timestamp: new Date().toISOString(),
            }],
          }).catch(() => {});
          break;
        case 'UNMUTE':
          await timeoutMember(guildId, body.userId as string, null);
          break;
        case 'KICK':
          await kickMember(guildId, body.userId as string, `Expulsé par ${moderatorTag}: ${reason}`);
          await sendDM(body.userId as string, {
            embeds: [{
              title: 'Expulsion',
              description: `Vous avez été expulsé du serveur.\nRaison : ${reason}`,
              color: 0xFF0000,
              timestamp: new Date().toISOString(),
            }],
          }).catch(() => {});
          break;
        case 'BAN':
        case 'TEMPBAN':
          await banMember(guildId, body.userId as string, `Banni par ${moderatorTag}: ${reason}`);
          await sendDM(body.userId as string, {
            embeds: [{
              title: 'Bannissement',
              description: `Vous avez été banni du serveur.\nRaison : ${reason}${type === 'TEMPBAN' && durationMs ? `\nDurée : ${Math.round(durationMs / 3600000)} heures` : ''}`,
              color: 0xFF0000,
              timestamp: new Date().toISOString(),
            }],
          }).catch(() => {});
          break;
        case 'UNBAN':
          await unbanMember(guildId, body.userId as string, `Débanni par ${moderatorTag}: ${reason}`);
          break;
        default:
          return reply.status(400).send(error(`Type de modération inconnu: ${type}`));
      }

      const modCase = await prisma.moderationCase.create({
        data: {
          guildId, userId: body.userId as string, moderatorId: request.user!.discordId,
          type, reason,
          duration: body.duration ? (body.duration as number) * 60 : null,
          expiresAt: body.duration ? new Date(Date.now() + (body.duration as number) * 60 * 1000) : null,
        },
      });
      reply.status(201).send(success(modCase, 'Action exécutée sur Discord'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/:caseId/revoke', { preHandler: [authenticate, validateParams(z.object({ guildId: z.string(), caseId: z.string() }))] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, caseId } = request.params as { guildId: string; caseId: string };
      const modCase = await prisma.moderationCase.findFirst({ where: { id: caseId, guildId } });
      if (!modCase) return reply.status(404).send(error('Cas introuvable'));

      if (modCase.type === 'BAN' || modCase.type === 'TEMPBAN') {
        await unbanMember(guildId, modCase.userId, 'Révoqué via dashboard');
      } else if (modCase.type === 'TIMEOUT') {
        await timeoutMember(guildId, modCase.userId, null);
      } else {
        return reply.status(400).send(error('Ce type de sanction ne peut pas être révoqué'));
      }

      await prisma.moderationCase.update({
        where: { id: caseId },
        data: { active: false },
      });

      await prisma.auditLog.create({
        data: {
          guildId,
          action: 'MODERATION_CASE_REVOKED',
          userId: request.user!.id,
          details: JSON.stringify({ caseId, targetUserId: modCase.userId, caseType: modCase.type }),
        },
      }).catch(() => {});

      reply.send(success(null, 'Sanction révoquée'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });
}
