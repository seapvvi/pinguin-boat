import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import { getConfig } from '@pinguin/config';
import { prisma } from '@pinguin/db';
import { authRoutes } from './routes/auth';
import { guildRoutes } from './routes/guilds';
import { overviewRoutes } from './routes/overview';
import { ownerRoutes } from './routes/owner';
import { deployRoutes } from './routes/deploy';
import { musicRoutes } from './routes/music';
import { webhookRoutes } from './routes/webhooks';
import { authenticate } from './middleware/auth';
import { success, error, paginated, sanitizeError } from './utils/response';
import { getSystemMetrics, getGlobalStats } from './services/metrics';
import { botFetch } from './services/bot-proxy';

const config = getConfig();

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
  });

  await app.register(cookie, {
    secret: config.SESSION_SECRET,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  app.setErrorHandler((error: any, _request, reply) => {
    app.log.error(error);
    reply.status(error.statusCode || 500).send({
      success: false,
      error: error.message || 'Erreur interne du serveur',
    });
  });

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(guildRoutes, { prefix: '/api/guilds' });
  await app.register(overviewRoutes, { prefix: '/api/overview' });
  await app.register(ownerRoutes, { prefix: '/api/owner' });
  await app.register(deployRoutes, { prefix: '/api/deploy' });
  await app.register(musicRoutes, { prefix: '/api/music' });
  await app.register(webhookRoutes, { prefix: '/api/webhooks' });

  app.get('/api/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  app.get('/api/health/bot', { preHandler: [authenticate] }, async (_request, reply) => {
    try {
      await botFetch('/internal/ping');
      reply.send({ success: true, status: 'ONLINE' });
    } catch (err: any) {
      if (err.message === 'BOT_OFFLINE' || err.name === 'AbortError') {
        reply.send({ success: true, status: 'OFFLINE' });
      } else {
        reply.send({ success: true, status: 'DEGRADED', error: sanitizeError(err) });
      }
    }
  });

  app.get('/api/stats', { preHandler: [authenticate] }, async (_request, reply) => {
    try {
      const [globalStats, metrics, commandCount] = await Promise.all([
        getGlobalStats(),
        getSystemMetrics(),
        prisma.auditLog.count(),
      ]);
      reply.send(success({
        totalGuilds: globalStats.guilds,
        totalUsers: globalStats.users,
        totalCommands: commandCount,
        uptime: metrics.processUptime,
        cpuUsage: metrics.cpu,
        ramUsage: metrics.ram.percent,
        premiumRevenue: 0,
        systemStatus: 'OPERATIONAL',
      }));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur lors de la récupération des stats'));
    }
  });

  app.get('/api/changelogs', { preHandler: [authenticate] }, async (request, reply) => {
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
      reply.send({
        success: true,
        data: { entries, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      });
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur lors de la récupération des changelogs'));
    }
  });

  try {
    await app.listen({
      host: config.API_HOST,
      port: config.API_PORT,
    });
    console.log(`[API] Serveur démarré sur ${config.API_URL}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
