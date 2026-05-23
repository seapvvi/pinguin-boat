import { FastifyInstance } from 'fastify';
import { prisma } from '@pinguin/db';
import { authenticate } from '../middleware/auth';
import { success, error, paginated } from '../utils/response';
import { getSystemMetrics, getGlobalStats } from '../services/metrics';

export async function overviewRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [authenticate] }, async (_request, reply) => {
    try {
      const [globalStats, guildCount, userCount, caseCount] =
        await Promise.all([
          getGlobalStats(),
          prisma.guild.count(),
          prisma.user.count(),
          prisma.moderationCase.count(),
        ]);

      const metrics = getSystemMetrics();

      reply.send(
        success({
          ...globalStats,
          cpu: metrics.cpu,
          ram: metrics.ram,
          uptime: metrics.uptime,
          processUptime: metrics.processUptime,
          systemStatus: 'OPERATIONAL',
        })
      );
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur lors de la récupération des données'));
    }
  });

  app.get('/leaderboard', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const query = request.query as any;
      const page = Math.max(1, parseInt(query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));

      const [entries, total] = await Promise.all([
        prisma.xPProfile.findMany({
          orderBy: { xp: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            user: { select: { username: true, avatar: true } },
            guild: { select: { name: true } },
          },
        }),
        prisma.xPProfile.count(),
      ]);

      const data = entries.map((e: any, i: number) => ({
        rank: (page - 1) * limit + i + 1,
        userId: e.userId,
        username: e.user?.username || 'Inconnu',
        avatar: e.user?.avatar || null,
        xp: e.xp,
        level: e.level,
        guildId: e.guildId,
        guildName: e.guild?.name || 'Inconnu',
      }));

      reply.send(paginated(data, total, page, limit));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur lors de la récupération du classement'));
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
          _count: {
            select: {
              moderationCases: true,
              xpProfiles: true,
            },
          },
        },
      });

      reply.send(success({ guilds }));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur lors de la récupération des serveurs'));
    }
  });

  app.get('/changelogs', { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const query = request.query as any;
      const page = Math.max(1, parseInt(query.page) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 10));

      const [entries, total] = await Promise.all([
        prisma.changelog.findMany({
          where: { published: true },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            author: { select: { username: true, avatar: true } },
          },
        }),
        prisma.changelog.count({ where: { published: true } }),
      ]);

      reply.send(paginated(entries, total, page, limit));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur lors de la récupération des changelogs'));
    }
  });

  app.get('/system', { preHandler: [authenticate] }, async (_request, reply) => {
    try {
      const metrics = getSystemMetrics();
      const recentSnapshots = await prisma.systemMetricsSnapshot.findFirst({
        orderBy: { timestamp: 'desc' },
      });

      const status = 'OPERATIONAL';

      reply.send(
        success({
          status,
          metrics,
          lastSnapshot: recentSnapshots,
          services: {
            api: { status: 'up' },
            database: { status: 'up' },
            bot: { status: 'unknown' },
            web: { status: 'unknown' },
          },
        })
      );
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur lors de la récupération du statut système'));
    }
  });
}
