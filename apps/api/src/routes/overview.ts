import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma, AuditAction } from '@pinguin/db';
import { getConfig } from '@pinguin/config';
import { authenticate } from '../middleware/auth';
import { success, error, sanitizeError } from '../utils/response';
import { getSystemMetrics, getGlobalStats } from '../services/metrics';
import { botFetch } from '../services/bot-proxy';

const config = getConfig();

const paginationQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

function isOwner(discordId: string): boolean {
  return discordId === config.DISCORD_OWNER_ID;
}

export async function computePublicOverview() {
  const guilds = await prisma.guild.findMany({
    where: { botPresent: true },
    select: { id: true, memberCount: true },
  });

  let onlineMembers = 0;
  try {
    const botGuilds = await botFetch('/internal/stats');
    onlineMembers = botGuilds?.data?.onlineMembers ?? 0;
  } catch { /* bot offline */ }

  const totalMembers = guilds.reduce((s, g) => s + g.memberCount, 0);
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [activeGuilds, messagesToday] = await Promise.all([
    prisma.auditLog.groupBy({
      by: ['guildId'],
      where: { createdAt: { gte: last24h }, guildId: { not: null } },
    }).then((r) => r.length).catch(() => 0),
    prisma.auditLog.count({
      where: { createdAt: { gte: last24h }, action: AuditAction.MESSAGE_CREATE },
    }).catch(() => 0),
  ]);

  return { guildCount: guilds.length, totalMembers, onlineMembers, activeGuilds, messagesToday };
}

export async function overviewRoutes(app: FastifyInstance) {
  app.get('/public', { preHandler: [authenticate] }, async (_request, reply) => {
    try {
      reply.send(success(await computePublicOverview()));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const discordId = request.user!.discordId;
      if (!isOwner(discordId)) {
        return reply.send(success({ ...await computePublicOverview(), isOwner: false }));
      }

      const [globalStats, metrics] = await Promise.all([
        getGlobalStats(),
        getSystemMetrics(),
      ]);

      reply.send(success({
        ...globalStats,
        cpu: metrics.cpu,
        ram: metrics.ram,
        uptime: metrics.uptime,
        processUptime: metrics.processUptime,
        systemStatus: 'OPERATIONAL',
        isOwner: true,
      }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/leaderboard/global', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const grouped = await prisma.xPProfile.groupBy({
        by: ['userId'],
        _sum: { xp: true },
        orderBy: { _sum: { xp: 'desc' } },
        take: 100,
      });

      const userIds = grouped.map((g) => g.userId);
      const users = await prisma.user.findMany({
        where: { discordId: { in: userIds } },
        select: { discordId: true, username: true, avatar: true },
      });
      const userMap = new Map(users.map((u) => [u.discordId, u]));

      const entries = grouped.map((g, i) => ({
        rank: i + 1,
        userId: g.userId,
        username: userMap.get(g.userId)?.username ?? 'Inconnu',
        avatar: userMap.get(g.userId)?.avatar ?? null,
        totalXp: g._sum.xp ?? 0,
      }));

      reply.send(success({ entries }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/leaderboard', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const query = paginationQuerySchema.parse(request.query);

      const [entries, total] = await Promise.all([
        prisma.xPProfile.findMany({
          orderBy: { xp: 'desc' },
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          include: {
            user: { select: { username: true, avatar: true } },
            guild: { select: { name: true } },
          },
        }),
        prisma.xPProfile.count(),
      ]);

      const data = entries.map((e, i) => ({
        rank: (query.page - 1) * query.limit + i + 1,
        userId: e.userId,
        username: e.user?.username || 'Inconnu',
        avatar: e.user?.avatar || null,
        xp: e.xp,
        level: e.level,
        guildId: e.guildId,
        guildName: e.guild?.name || 'Inconnu',
      }));

      reply.send(success({ entries: data, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/top-guilds', { preHandler: [authenticate] }, async (_request, reply) => {
    try {
      const guilds = await prisma.guild.findMany({
        orderBy: { memberCount: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          icon: true,
          ownerId: true,
          memberCount: true,
          _count: { select: { moderationCases: true, xpProfiles: true } },
        },
      });
      reply.send(success({ guilds }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/changelogs', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const query = paginationQuerySchema.parse(request.query);

      const [entries, total] = await Promise.all([
        prisma.changelog.findMany({
          where: { published: true },
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          include: { author: { select: { username: true, avatar: true } } },
        }),
        prisma.changelog.count({ where: { published: true } }),
      ]);

      reply.send(success({ entries, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/system', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      if (!isOwner(request.user!.discordId)) {
        return reply.status(403).send(error('Réservé au propriétaire'));
      }
      const metrics = getSystemMetrics();
      const recentSnapshots = await prisma.systemMetricsSnapshot.findFirst({
        orderBy: { timestamp: 'desc' },
      });
      reply.send(
        success({
          status: 'OPERATIONAL',
          metrics,
          lastSnapshot: recentSnapshots,
          services: { api: { status: 'up' }, database: { status: 'up' }, bot: { status: 'unknown' }, web: { status: 'unknown' } },
        })
      );
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });
}
