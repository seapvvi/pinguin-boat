import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import { success, error, sanitizeError } from '../utils/response';
import { botFetch } from '../services/bot-proxy';
import { prisma } from '@pinguin/db';

const auth = { preHandler: [authenticate] };

export async function systemRoutes(app: FastifyInstance) {
  app.get('/health/deep', async (_request: FastifyRequest, reply: FastifyReply) => {
    const timeout = (ms: number) =>
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms));

    const dbStart = Date.now();
    let db: { status: string; latency: number | null };
    try {
      await Promise.race([prisma.$queryRaw`SELECT 1`, timeout(3000)]);
      db = { status: 'ok', latency: Date.now() - dbStart };
    } catch {
      db = { status: 'down', latency: null };
    }

    const discordStart = Date.now();
    let discord: { status: string; latency: number | null };
    try {
      await Promise.race([fetch('https://discord.com/api/v10/gateway'), timeout(3000)]);
      discord = { status: 'ok', latency: Date.now() - discordStart };
    } catch {
      discord = { status: 'down', latency: null };
    }

    const isOk = db.status === 'ok' && discord.status === 'ok';
    const isDown = db.status === 'down' || discord.status === 'down';
    const status = isOk ? 'ok' : isDown ? 'down' : 'degraded';
    const httpStatus = isOk ? 200 : 503;

    reply.status(httpStatus).send({
      status,
      db,
      discord,
      uptime: process.uptime(),
      memory: process.memoryUsage().heapUsed,
    });
  });

  app.get('/bot/status', auth, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const start = Date.now();
      await botFetch('/internal/ping');
      const latency = Date.now() - start;
      reply.send(success({ online: true, latency }));
    } catch {
      reply.send(success({ online: false, latency: null }));
    }
  });

  app.get('/metrics/snapshots', auth, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const snapshots = await prisma.systemMetricsSnapshot.findMany({
        where: {
          timestamp: {
            gte: twentyFourHoursAgo,
          },
        },
        orderBy: {
          timestamp: 'asc',
        },
      });

      reply.send(success({ snapshots }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });
}
