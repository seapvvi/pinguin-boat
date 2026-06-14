import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import { success, error, sanitizeError } from '../utils/response';
import { botFetch } from '../services/bot-proxy';
import { prisma } from '@pinguin/db';

const auth = { preHandler: [authenticate] };

export async function systemRoutes(app: FastifyInstance) {
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
