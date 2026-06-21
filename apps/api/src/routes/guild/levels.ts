import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@pinguin/db';
import { authenticate } from '../../middleware/auth';
import { validateParams } from '../../middleware/validate';
import { success, error, sanitizeError } from '../../utils/response';
import { guildIdSchema } from '../../utils/guild-helpers';

const guildParam = { preHandler: [authenticate, validateParams(guildIdSchema)] };

export async function levelsRoutes(app: FastifyInstance) {
  app.get('/', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      let xp = await prisma.xPSettings.findUnique({ where: { guildId } });
      if (!xp) {
        await prisma.guild.upsert({
          where: { id: guildId },
          update: {},
          create: { id: guildId, name: guildId, ownerId: null, memberCount: 0 },
        });
        xp = await prisma.xPSettings.create({ data: { guildId } });
      }
      const rewards = await prisma.xPRoleReward.findMany({ where: { guildId }, orderBy: { levelRequired: 'asc' } });
      reply.send(success({ settings: xp, roleRewards: rewards }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;
      await prisma.xPSettings.upsert({
        where: { guildId },
        update: {
          enabled: body.enabled as boolean | undefined,
          xpPerMessageMin: body.xpPerMessageMin as number | undefined,
          xpPerMessageMax: body.xpPerMessageMax as number | undefined,
          voiceXp: body.voiceXp as number | undefined,
          messageCooldown: body.messageCooldown as number | undefined,
          voiceCooldown: body.voiceCooldown as number | undefined,
          announcementChannelId: body.announcementChannelId as string | undefined,
          announcementMessage: body.announcementMessage as string | undefined,
          ignoredChannels: body.ignoredChannels ? JSON.stringify(body.ignoredChannels) : undefined,
          ignoredRoles: body.ignoredRoles ? JSON.stringify(body.ignoredRoles) : undefined,
        },
        create: { guildId, ...body },
      });
      if (body.roleRewards) {
        await prisma.xPRoleReward.deleteMany({ where: { guildId } });
        for (const r of body.roleRewards as Array<{ roleId: string; level: number; xpMultiplier?: number }>) {
          await prisma.xPRoleReward.create({ data: { guildId, roleId: r.roleId, levelRequired: r.level, xpMultiplier: r.xpMultiplier ?? 1.0 } });
        }
      }
      reply.send(success(null, 'Paramètres XP mis à jour'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/rank-card', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      let settings = await prisma.rankCardSettings.findUnique({ where: { guildId } });
      if (!settings) {
        settings = await prisma.rankCardSettings.create({ data: { guildId } });
      }
      reply.send(success({ settings }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/rank-card', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;
      const settings = await prisma.rankCardSettings.upsert({
        where: { guildId },
        update: {
          backgroundType: body.backgroundType as string | undefined,
          backgroundColor: body.backgroundColor as string | undefined,
          backgroundImage: body.backgroundImage as string | undefined,
          gradientFrom: body.gradientFrom as string | undefined,
          gradientTo: body.gradientTo as string | undefined,
          xpBarColor: body.xpBarColor as string | undefined,
          xpBarBackground: body.xpBarBackground as string | undefined,
          textColor: body.textColor as string | undefined,
          avatarBorder: body.avatarBorder as boolean | undefined,
          avatarBorderColor: body.avatarBorderColor as string | undefined,
          fontFamily: body.fontFamily as string | undefined,
        },
        create: { guildId, ...body },
      });
      reply.send(success({ settings }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/leaderboard', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '20', 10) || 20));
      const [profiles, total] = await Promise.all([
        prisma.xPProfile.findMany({
          where: { guildId }, orderBy: { xp: 'desc' },
          skip: (page - 1) * limit, take: limit,
          include: { user: { select: { username: true, avatar: true } } },
        }),
        prisma.xPProfile.count({ where: { guildId } }),
      ]);
      const entries = profiles.map((p, i) => ({
        rank: (page - 1) * limit + i + 1, userId: p.userId,
        username: p.user.username, avatar: p.user.avatar,
        xp: p.xp, level: p.level, guildId,
      }));
      reply.send(success({
        entries,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });
}
