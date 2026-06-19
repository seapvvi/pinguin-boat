import Fastify, { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import csrf from '@fastify/csrf-protection';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import { z } from 'zod';
import { getConfig } from '@pinguin/config';
import { prisma } from '@pinguin/db';
import { authRoutes } from './routes/auth';
import { guildRoutes } from './routes/guild/index';
import { overviewRoutes } from './routes/overview';
import { ownerRoutes } from './routes/owner';
import { deployRoutes } from './routes/deploy';
import { musicRoutes } from './routes/music';
import { webhookRoutes } from './routes/webhooks';
import { internalRoutes } from './routes/internal';
import { systemRoutes } from './routes/system';
import { onboardingRoutes } from './routes/onboarding';
import { notificationRoutes } from './routes/notifications';
import { blacklistRoutes } from './routes/blacklist';
import { embedRoutes } from './routes/embeds';
import { authenticate } from './middleware/auth';
import { checkMaintenance } from './middleware/maintenanceCheck';
import { success, error, paginated, sanitizeError, getErrorMessage } from './utils/response';
import { ensureOwnerPasswordHash } from './services/ownerPassword';
import { getSystemMetrics, getGlobalStats } from './services/metrics';
import { botFetch } from './services/bot-proxy';
import { startSessionCleanup } from './jobs/cleanup';

const config = getConfig();

let app: ReturnType<typeof Fastify>;
let internalApp: ReturnType<typeof Fastify>;

async function main() {
  app = Fastify({ logger: true });

  await app.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
  });

  await app.register(cookie, {
    secret: config.SESSION_SECRET,
  });

  await app.register(csrf, {
    cookieOpts: {
      signed: true,
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    },
  });

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && request.cookies?.session) {
      await new Promise<void>((resolve, reject) => {
        app.csrfProtection(request, reply, (err: Error | undefined) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  });

  app.addHook('onRequest', checkMaintenance);

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "https://cdn.discordapp.com", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameSrc: [],
        frameAncestors: ["'none'"],
      },
    },
  });

  app.setErrorHandler((error: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
    app.log.error(error);
    const statusCode = error.statusCode || 500;

    if (statusCode === 429) {
      const retryAfter = reply.getHeader('retry-after');
      reply.send({
        success: false,
        error: error.message || 'Trop de requêtes',
        retryAfter: retryAfter ? Number(retryAfter) : null,
      });
      return;
    }

    reply.status(statusCode).send({
      success: false,
      error: statusCode >= 500 ? sanitizeError(error) : (error.message || 'Erreur interne du serveur'),
    });
  });

  await ensureOwnerPasswordHash();

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(guildRoutes, { prefix: '/api/guilds' });
  await app.register(overviewRoutes, { prefix: '/api/overview' });
  await app.register(ownerRoutes, { prefix: '/api/owner' });
  await app.register(deployRoutes, { prefix: '/api/deploy' });
  await app.register(musicRoutes, { prefix: '/api/music' });
  await app.register(webhookRoutes, { prefix: '/api/webhooks' });
  await app.register(systemRoutes, { prefix: '/api/system' });
  await app.register(onboardingRoutes, { prefix: '/api' });
  await app.register(notificationRoutes, { prefix: '/api/guilds' });
  await app.register(blacklistRoutes, { prefix: '/api/guilds' });
  await app.register(embedRoutes, { prefix: '/api/guilds' });

  const inviteQuerySchema = z.object({
    guild_id: z.string().optional(),
  });

  app.get('/api/bot/invite', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = inviteQuerySchema.parse(request.query);
      const clientId = config.DISCORD_CLIENT_ID;
      if (!clientId) {
        return reply.status(500).send(error('DISCORD_CLIENT_ID non configuré'));
      }
      const permissions = '274877910496';
      const scope = encodeURIComponent('bot applications.commands');
      let url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=${scope}`;
      if (query.guild_id) url += `&guild_id=${query.guild_id}&disable_guild_select=true`;
      reply.send(success({ url }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/api/donors', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const donors = await prisma.donor.findMany({
        where: { isPublic: true, isDonor: true },
        select: { id: true, userId: true, username: true, avatarUrl: true, amount: true, message: true, donatedAt: true },
        orderBy: { amount: 'desc' },
        take: 50,
      });
      reply.send(success({ donors }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/api/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  app.get('/api/health/bot', { preHandler: [authenticate] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      await botFetch('/internal/ping');
      reply.send({ success: true, status: 'ONLINE' });
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      if (message === 'BOT_OFFLINE' || (err instanceof Error && err.name === 'AbortError')) {
        reply.send({ success: true, status: 'OFFLINE' });
      } else {
        reply.send({ success: true, status: 'DEGRADED', error: sanitizeError(err) });
      }
    }
  });

  const paginationQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  });

  app.get('/api/stats/public', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const [guildCount, memberAgg, commandCount] = await Promise.all([
        prisma.guild.count({ where: { botPresent: true } }),
        prisma.guild.aggregate({
          where: { botPresent: true },
          _sum: { memberCount: true },
        }),
        prisma.auditLog.count(),
      ]);
      reply.send(success({
        totalGuilds: guildCount,
        totalUsers: memberAgg._sum.memberCount ?? 0,
        totalCommands: commandCount,
      }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/api/stats', {
    preHandler: [authenticate],
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute',
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const discordId = request.user!.discordId;
      const isOwner = discordId === config.DISCORD_OWNER_ID;

      if (!isOwner) {
        const [guildCount, memberAgg] = await Promise.all([
          prisma.guild.count({ where: { botPresent: true } }),
          prisma.guild.aggregate({
            where: { botPresent: true },
            _sum: { memberCount: true },
          }),
        ]);
        let onlineMembers = 0;
        try {
          const botStats = await botFetch('/internal/stats');
          onlineMembers = botStats?.data?.onlineMembers ?? 0;
        } catch { /* bot offline */ }
        return reply.send(success({
          isOwner: false,
          totalGuilds: guildCount,
          totalUsers: memberAgg._sum.memberCount ?? 0,
          onlineMembers,
          activeChannels: 0,
        }));
      }

      const [globalStats, metrics, commandCount] = await Promise.all([
        getGlobalStats(),
        getSystemMetrics(),
        prisma.auditLog.count(),
      ]);
      let onlineMembers = 0;
      try {
        const botStats = await botFetch('/internal/stats');
        onlineMembers = botStats?.data?.onlineMembers ?? 0;
      } catch { /* bot offline */ }
      reply.send(success({
        isOwner: true,
        totalGuilds: globalStats.guilds,
        totalUsers: globalStats.users,
        totalCommands: commandCount,
        uptime: metrics.processUptime,
        cpuUsage: metrics.cpu,
        ramUsage: metrics.ram.percent,
        premiumRevenue: 0,
        systemStatus: 'OPERATIONAL',
        onlineMembers,
      }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/api/changelogs', {
    preHandler: [authenticate],
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute',
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = paginationQuerySchema.parse(request.query);
      const [entries, total] = await Promise.all([
        prisma.changelog.findMany({
          where: { published: true },
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          include: {
            author: { select: { username: true, avatar: true } },
          },
        }),
        prisma.changelog.count({ where: { published: true } }),
      ]);
      reply.send(paginated(entries, total, query.page, query.limit));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  try {
    await app.listen({
      host: config.API_HOST,
      port: config.API_PORT,
    });
    app.log.info(`Serveur public démarré sur ${config.API_URL}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  internalApp = Fastify({ logger: true });
  await internalApp.register(internalRoutes, { prefix: '/api/internal' });
  internalApp.setErrorHandler((error: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
    internalApp.log.error(error);
    reply.status(error.statusCode || 500).send({
      success: false,
      error: error.message || 'Erreur interne du serveur',
    });
  });

  try {
    await internalApp.listen({
      host: '127.0.0.1',
      port: config.BOT_INTERNAL_PORT,
    });
    internalApp.log.info(`Serveur interne démarré sur 127.0.0.1:${config.BOT_INTERNAL_PORT}`);
  } catch (err) {
    internalApp.log.error(err);
    process.exit(1);
  }

  startSessionCleanup();
}

main();

async function gracefulShutdown(signal: string) {
  console.log(`Signal ${signal} reçu, arrêt gracieux...`);
  try {
    await app.close();
    if (internalApp) await internalApp.close();
    await prisma.$disconnect();
    console.log('Arrêt propre effectué');
    process.exit(0);
  } catch (err) {
    console.error('Erreur lors de l\'arrêt gracieux:', err);
    process.exit(1);
  }
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
