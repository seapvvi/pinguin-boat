import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import { success } from '../utils/response';
import { botFetch } from '../services/bot-proxy';

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
}
