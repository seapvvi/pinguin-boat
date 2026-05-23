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
