import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@pinguin/db';
import { authenticate } from '../middleware/auth';
import { requireGuildMember } from '../middleware/guild-auth';
import { success, error, sanitizeError } from '../utils/response';
import { botControl, getQueueState, botSearch, botPlay } from '../services/bot-proxy';
import { z } from 'zod';

const guildMemberGuard = { preHandler: [authenticate, requireGuildMember] };

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function musicRoutes(app: FastifyInstance) {
  app.get('/state/:guildId', guildMemberGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      try {
        const state = await getQueueState(guildId);
        return reply.send(success(state));
      } catch {
        const queue = await prisma.musicQueue.findUnique({ where: { guildId } });
        if (!queue) {
          return reply.send(success({
            tracks: [], currentTrack: null, position: 0,
            loopMode: 'NONE', autoplay: false, volume: 50,
          }));
        }
        reply.send(success({
          tracks: JSON.parse(queue.tracks),
          currentTrack: queue.currentTrack ? JSON.parse(queue.currentTrack) : null,
          position: queue.position, loopMode: queue.loopMode,
          autoplay: queue.autoplay, volume: queue.volume,
        }));
      }
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/play/:guildId', guildMemberGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as { track?: string; voiceChannelId?: string };
      if (!body.track) return reply.status(400).send(error('Track requis'));
      if (!body.voiceChannelId) return reply.status(400).send(error('voiceChannelId requis'));
      const result = await botPlay(guildId, body.track, body.voiceChannelId);
      reply.send(success(result, 'Piste ajoutée'));
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'BOT_OFFLINE') return reply.status(503).send(error('Le bot est hors ligne'));
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.post('/control/:guildId/:action', guildMemberGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, action } = request.params as { guildId: string; action: string };
      const body = request.body as { value?: string };
      const validActions = ['play', 'pause', 'resume', 'skip', 'stop', 'volume', 'shuffle', 'loop'];
      if (!validActions.includes(action)) return reply.status(400).send(error('Action invalide'));

      let botOffline = false;
      try {
        await botControl(guildId, action, body.value);
      } catch (e: unknown) {
        if (!(e instanceof Error) || e.message !== 'BOT_OFFLINE') throw e;
        botOffline = true;
      }

      if (botOffline) {
        const queue = await prisma.musicQueue.findUnique({ where: { guildId } });
        if (!queue) return reply.status(404).send(error('Aucune file active'));

        if (action === 'volume' && body.value) {
          await prisma.musicQueue.update({ where: { guildId }, data: { volume: parseInt(body.value) || 50 } });
        }
        if (action === 'loop' && body.value) {
          await prisma.musicQueue.update({ where: { guildId }, data: { loopMode: body.value as 'NONE' | 'TRACK' | 'QUEUE' } });
        }
        if (action === 'stop') {
          await prisma.musicQueue.update({
            where: { guildId },
            data: { tracks: '[]', currentTrack: null, position: 0 },
          });
        }
      }
      reply.send(success({ action }, `Action ${action} exécutée`));
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'BOT_OFFLINE') return reply.status(503).send(error('Le bot est hors ligne'));
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/search/:guildId/:query', guildMemberGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, query } = request.params as { guildId: string; query: string };
      try {
        const results = await botSearch(guildId, query);
        reply.send(success(results));
      } catch (e: unknown) {
        if (e instanceof Error && e.message === 'BOT_OFFLINE') {
          return reply.status(503).send(error('Le bot est hors ligne, la recherche est indisponible'));
        }
        throw e;
      }
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/history/:guildId', guildMemberGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const query = paginationSchema.parse(request.query);
      const [entries, total] = await Promise.all([
        prisma.musicHistoryEntry.findMany({
          where: { guildId }, orderBy: { playedAt: 'desc' },
          skip: (query.page - 1) * query.limit, take: query.limit,
        }),
        prisma.musicHistoryEntry.count({ where: { guildId } }),
      ]);
      reply.send(success({ entries, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });
}
