import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@pinguin/db';
import { authenticate } from '../middleware/auth';
import { requireGuildMember } from '../middleware/guild-auth';
import { success, error, sanitizeError } from '../utils/response';
import { botControl, getQueueState, botSearch } from '../services/bot-proxy';

const guildMemberGuard = { preHandler: [authenticate, requireGuildMember] };

export async function musicRoutes(app: FastifyInstance) {
  app.get('/state/:guildId', guildMemberGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
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
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/play/:guildId', guildMemberGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      if (!body.track) return reply.status(400).send(error('Track requis'));
      if (!body.voiceChannelId) return reply.status(400).send(error('voiceChannelId requis'));
      const result = await botControl(guildId, 'play', { track: body.track, voiceChannelId: body.voiceChannelId });
      let queue = await prisma.musicQueue.findUnique({ where: { guildId } });
      const tracks = queue ? JSON.parse(queue.tracks) : [];
      tracks.push(body.track);
      if (!queue) {
        await prisma.musicQueue.create({
          data: { guildId, tracks: JSON.stringify(tracks), currentTrack: null, volume: 50 },
        });
      } else {
        await prisma.musicQueue.update({
          where: { guildId }, data: { tracks: JSON.stringify(tracks) },
        });
      }
      reply.send(success(result || { queue }, 'Piste ajoutée'));
    } catch (err: any) {
      if (err.message === 'BOT_OFFLINE') return reply.status(503).send(error('Le bot est hors ligne'));
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.post('/control/:guildId/:action', guildMemberGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, action } = request.params as any;
      const body = request.body as any;
      const validActions = ['play', 'pause', 'resume', 'skip', 'stop', 'volume', 'shuffle', 'loop'];
      if (!validActions.includes(action)) return reply.status(400).send(error('Action invalide'));

      try {
        await botControl(guildId, action, body.value);
      } catch (e: any) {
        if (e.message === 'BOT_OFFLINE') {
          // bot offline, persist state for when it comes back
        } else throw e;
      }

      const queue = await prisma.musicQueue.findUnique({ where: { guildId } });
      if (!queue) return reply.status(404).send(error('Aucune file active'));

      if (action === 'volume' && body.value) {
        await prisma.musicQueue.update({ where: { guildId }, data: { volume: parseInt(body.value) || 50 } });
      }
      if (action === 'loop' && body.value) {
        await prisma.musicQueue.update({ where: { guildId }, data: { loopMode: body.value } });
      }
      if (action === 'shuffle') {
        const tracks = JSON.parse(queue.tracks);
        for (let i = tracks.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
        }
        await prisma.musicQueue.update({ where: { guildId }, data: { tracks: JSON.stringify(tracks) } });
      }
      if (action === 'skip') {
        const tracks = JSON.parse(queue.tracks);
        const nextTrack = tracks.shift() || null;
        await prisma.musicQueue.update({
          where: { guildId },
          data: { tracks: JSON.stringify(tracks), currentTrack: nextTrack ? JSON.stringify(nextTrack) : null },
        });
      }
      if (action === 'stop') {
        await prisma.musicQueue.update({
          where: { guildId },
          data: { tracks: '[]', currentTrack: null, position: 0 },
        });
      }
      reply.send(success({ action }, `Action ${action} exécutée`));
    } catch (err: any) {
      if (err.message === 'BOT_OFFLINE') return reply.status(503).send(error('Le bot est hors ligne'));
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/search/:guildId/:query', guildMemberGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, query } = request.params as any;
      try {
        const results = await botSearch(guildId, query);
        reply.send(success(results));
      } catch (e: any) {
        if (e.message === 'BOT_OFFLINE') {
          return reply.status(503).send(error('Le bot est hors ligne, la recherche est indisponible'));
        }
        throw e;
      }
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/history/:guildId', guildMemberGuard, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(q.limit) || 20));
      const [entries, total] = await Promise.all([
        prisma.musicHistoryEntry.findMany({
          where: { guildId }, orderBy: { playedAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
        }),
        prisma.musicHistoryEntry.count({ where: { guildId } }),
      ]);
      reply.send(success({ entries, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });
}
