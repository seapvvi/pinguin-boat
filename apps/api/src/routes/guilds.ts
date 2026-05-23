import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@pinguin/db';
import { getConfig } from '@pinguin/config';
import { authenticate } from '../middleware/auth';
import { validateParams } from '../middleware/validate';
import { success, error, paginated } from '../utils/response';
import { z } from 'zod';

const config = getConfig();

const guildIdSchema = z.object({ guildId: z.string().min(1) });
const ticketIdSchema = z.object({ guildId: z.string().min(1), ticketId: z.string().min(1) });
const embedIdSchema = z.object({ guildId: z.string().min(1), id: z.string().min(1) });
const suggestionIdSchema = z.object({ guildId: z.string().min(1), id: z.string().min(1) });
const giveawayIdSchema = z.object({ guildId: z.string().min(1), id: z.string().min(1) });
const pollIdSchema = z.object({ guildId: z.string().min(1), id: z.string().min(1) });

const guildParam = { preHandler: [authenticate, validateParams(guildIdSchema)] };

export async function guildRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const guilds = await prisma.guild.findMany({
        where: { botPresent: true },
        select: {
          id: true, name: true, icon: true, ownerId: true, memberCount: true,
          modulesEnabled: true,
        },
        orderBy: { memberCount: 'desc' },
      });
      reply.send(success({ guilds }));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur lors de la récupération'));
    }
  });

  app.get('/:guildId', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const guild = await prisma.guild.findUnique({
        where: { id: guildId },
        include: {
          settings: true, modulesEnabled: true, logSettings: true,
          xpSettings: true, welcomeSettings: true,
          autoroleSettings: { include: { entries: true } },
        },
      });
      if (!guild) return reply.status(404).send(error('Serveur introuvable'));
      reply.send(success({ guild }));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur'));
    }
  });

  app.get('/:guildId/settings', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      let settings = await prisma.guildSettings.findUnique({ where: { guildId } });
      if (!settings) {
        settings = await prisma.guildSettings.create({ data: { guildId } });
      }
      reply.send(success({ settings }));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur'));
    }
  });

  app.put('/:guildId/settings', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      await prisma.guildSettings.upsert({
        where: { guildId },
        update: {
          prefix: body.prefix ?? undefined,
          locale: body.locale ?? undefined,
          timezone: body.timezone ?? undefined,
          modLogChannel: body.modLogChannel ?? undefined,
          modRoleIds: body.modRoleIds ? JSON.stringify(body.modRoleIds) : undefined,
          adminRoleIds: body.adminRoleIds ? JSON.stringify(body.adminRoleIds) : undefined,
          muteRoleId: body.muteRoleId ?? undefined,
        },
        create: {
          guildId,
          prefix: body.prefix ?? '/',
          locale: body.locale ?? 'fr',
          modRoleIds: body.modRoleIds ? JSON.stringify(body.modRoleIds) : '[]',
          adminRoleIds: body.adminRoleIds ? JSON.stringify(body.adminRoleIds) : '[]',
        },
      });
      reply.send(success(null, 'Paramètres mis à jour'));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur de mise à jour'));
    }
  });

  app.get('/:guildId/modules', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      let modules = await prisma.moduleEnabled.findUnique({ where: { guildId } });
      if (!modules) modules = await prisma.moduleEnabled.create({ data: { guildId } });
      reply.send(success({ modules }));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur'));
    }
  });

  app.put('/:guildId/modules', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      const fields = ['moderation','protection','tickets','logs','levels','economy','music','giveaways','polls','suggestions','welcome','autoroles','embeds'];
      const data: any = {};
      for (const f of fields) { if (typeof body[f] === 'boolean') data[f] = body[f]; }
      if (Object.keys(data).length > 0) {
        await prisma.moduleEnabled.upsert({ where: { guildId }, update: data, create: { guildId, ...data } });
      }
      reply.send(success(null, 'Modules mis à jour'));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur'));
    }
  });

  app.get('/:guildId/moderation', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
      const [cases, total] = await Promise.all([
        prisma.moderationCase.findMany({
          where: { guildId }, orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
          include: { user: { select: { username: true, avatar: true } } },
        }),
        prisma.moderationCase.count({ where: { guildId } }),
      ]);
      reply.send(paginated(cases, total, page, limit));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur'));
    }
  });

  app.post('/:guildId/moderation', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      if (!body.type || !body.userId || !body.reason)
        return reply.status(400).send(error('Type, utilisateur et raison requis'));
      const modCase = await prisma.moderationCase.create({
        data: {
          guildId, userId: body.userId, moderatorId: request.user!.id,
          type: body.type, reason: body.reason,
          duration: body.duration || null,
          expiresAt: body.duration ? new Date(Date.now() + body.duration * 1000) : null,
        },
      });
      reply.status(201).send(success(modCase, 'Cas créé'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/tickets', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
      const where: any = { guildId };
      if (q.status) where.status = q.status;
      const [tickets, total] = await Promise.all([
        prisma.ticket.findMany({
          where, orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
          include: { creator: { select: { username: true, avatar: true } }, claimedBy: { select: { username: true } } },
        }),
        prisma.ticket.count({ where }),
      ]);
      reply.send(paginated(tickets, total, page, limit));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.post('/:guildId/tickets', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      if (!body.subject) return reply.status(400).send(error('Sujet requis'));
      const ticket = await prisma.ticket.create({
        data: {
          guildId, channelId: `pending-${Date.now()}`, creatorId: request.user!.id,
          subject: body.subject, description: body.description || null,
          categoryId: body.categoryId || null, status: 'OPEN',
        },
      });
      reply.status(201).send(success(ticket, 'Ticket créé'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.put('/:guildId/tickets/:ticketId', { preHandler: [authenticate, validateParams(ticketIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, ticketId } = request.params as any;
      const body = request.body as any;
      const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, guildId } });
      if (!ticket) return reply.status(404).send(error('Ticket introuvable'));
      const upd: any = {};
      if (body.status) upd.status = body.status;
      if (body.claimedById !== undefined) upd.claimedById = body.claimedById;
      if (body.status === 'CLOSED') { upd.closedAt = new Date(); upd.closedById = request.user!.id; }
      const updated = await prisma.ticket.update({ where: { id: ticketId }, data: upd });
      reply.send(success(updated, 'Ticket mis à jour'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/logs', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      let ls = await prisma.logSettings.findUnique({ where: { guildId } });
      if (!ls) ls = await prisma.logSettings.create({ data: { guildId } });
      reply.send(success({
        logChannelId: ls.logChannelId,
        events: JSON.parse(ls.events),
        ignoredChannels: JSON.parse(ls.ignoredChannels),
        ignoredRoles: JSON.parse(ls.ignoredRoles),
      }));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.put('/:guildId/logs', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      await prisma.logSettings.upsert({
        where: { guildId },
        update: {
          logChannelId: body.logChannelId ?? undefined,
          events: body.events ? JSON.stringify(body.events) : undefined,
          ignoredChannels: body.ignoredChannels ? JSON.stringify(body.ignoredChannels) : undefined,
          ignoredRoles: body.ignoredRoles ? JSON.stringify(body.ignoredRoles) : undefined,
        },
        create: { guildId, logChannelId: body.logChannelId || null, events: body.events ? JSON.stringify(body.events) : '[]', ignoredChannels: '[]', ignoredRoles: '[]' },
      });
      reply.send(success(null, 'Logs mis à jour'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/levels', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      let xp = await prisma.xPSettings.findUnique({ where: { guildId } });
      if (!xp) xp = await prisma.xPSettings.create({ data: { guildId } });
      const rewards = await prisma.xPRoleReward.findMany({ where: { guildId }, orderBy: { levelRequired: 'asc' } });
      reply.send(success({ settings: xp, roleRewards: rewards }));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.put('/:guildId/levels', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      await prisma.xPSettings.upsert({
        where: { guildId },
        update: {
          enabled: body.enabled ?? undefined,
          messageXp: body.messageXp ?? undefined,
          voiceXp: body.voiceXp ?? undefined,
          messageCooldown: body.messageCooldown ?? undefined,
          voiceCooldown: body.voiceCooldown ?? undefined,
          announcementChannelId: body.announcementChannelId ?? undefined,
          announcementMessage: body.announcementMessage ?? undefined,
          ignoredChannels: body.ignoredChannels ? JSON.stringify(body.ignoredChannels) : undefined,
          ignoredRoles: body.ignoredRoles ? JSON.stringify(body.ignoredRoles) : undefined,
        },
        create: { guildId, ...body },
      });
      if (body.roleRewards) {
        await prisma.xPRoleReward.deleteMany({ where: { guildId } });
        for (const r of body.roleRewards) {
          await prisma.xPRoleReward.create({ data: { guildId, roleId: r.roleId, levelRequired: r.level } });
        }
      }
      reply.send(success(null, 'Paramètres XP mis à jour'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/levels/leaderboard', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
      const [profiles, total] = await Promise.all([
        prisma.xPProfile.findMany({
          where: { guildId }, orderBy: { xp: 'desc' },
          skip: (page - 1) * limit, take: limit,
          include: { user: { select: { username: true, avatar: true } } },
        }),
        prisma.xPProfile.count({ where: { guildId } }),
      ]);
      const entries = profiles.map((p, i) => ({
        rank: (page - 1) * limit + i + 1, userId: p.userId,
        username: p.user.username, avatar: p.user.avatar,
        xp: p.xp, level: p.level, guildId,
      }));
      reply.send(paginated(entries, total, page, limit));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/economy', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const wallets = await prisma.economyWallet.findMany({
        where: { guildId }, orderBy: { wallet: 'desc' }, take: 10,
        include: { user: { select: { username: true, avatar: true } } },
      });
      const totalEconomy = await prisma.economyWallet.aggregate({
        where: { guildId },
        _sum: { wallet: true, bank: true },
      });
      reply.send(success({
        wallets,
        totalWallet: totalEconomy._sum.wallet || 0,
        totalBank: totalEconomy._sum.bank || 0,
        currencyName: 'pièces',
        currencySymbol: '🪙',
      }));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.put('/:guildId/economy', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      reply.send(success(null, 'Non implémenté côté API'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/economy/leaderboard', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
      const [wallets, total] = await Promise.all([
        prisma.economyWallet.findMany({
          where: { guildId }, orderBy: { wallet: 'desc' },
          skip: (page - 1) * limit, take: limit,
          include: { user: { select: { username: true, avatar: true } } },
        }),
        prisma.economyWallet.count({ where: { guildId } }),
      ]);
      const entries = wallets.map((w, i) => ({
        rank: (page - 1) * limit + i + 1, userId: w.userId,
        username: w.user.username, avatar: w.user.avatar,
        wallet: w.wallet, bank: w.bank, totalEarned: w.totalEarned,
        guildId,
      }));
      reply.send(paginated(entries, total, page, limit));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/giveaways', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
      const [giveaways, total] = await Promise.all([
        prisma.giveaway.findMany({
          where: { guildId }, orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
          include: { _count: { select: { entries: true } } },
        }),
        prisma.giveaway.count({ where: { guildId } }),
      ]);
      reply.send(paginated(giveaways, total, page, limit));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.post('/:guildId/giveaways', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      if (!body.prize || !body.duration) return reply.status(400).send(error('Prize et durée requis'));
      const giveaway = await prisma.giveaway.create({
        data: {
          guildId, channelId: body.channelId || 'pending',
          prize: body.prize, winnerCount: body.winners || 1,
          duration: body.duration,
          endsAt: new Date(Date.now() + body.duration * 1000),
          requiredRoleId: body.requirements?.requiredRoleId || null,
          requiredLevel: 0, requiredAccountAge: 0,
          status: 'RUNNING',
        },
      });
      reply.status(201).send(success(giveaway, 'Giveaway créé'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.put('/:guildId/giveaways/:id', { preHandler: [authenticate, validateParams(giveawayIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as any;
      const body = request.body as any;
      const g = await prisma.giveaway.findFirst({ where: { id, guildId } });
      if (!g) return reply.status(404).send(error('Giveaway introuvable'));
      const upd: any = {};
      if (body.status) upd.status = body.status;
      if (body.prize) upd.prize = body.prize;
      if (body.winnerCount) upd.winnerCount = body.winnerCount;
      const updated = await prisma.giveaway.update({ where: { id }, data: upd });
      reply.send(success(updated, 'Giveaway mis à jour'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/polls', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
      const [polls, total] = await Promise.all([
        prisma.poll.findMany({
          where: { guildId }, orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
          include: { _count: { select: { votes: true } } },
        }),
        prisma.poll.count({ where: { guildId } }),
      ]);
      const data = polls.map((p) => ({ ...p, options: JSON.parse(p.options) }));
      reply.send(paginated(data, total, page, limit));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.post('/:guildId/polls', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      if (!body.question || !body.options?.length)
        return reply.status(400).send(error('Question et options requises'));
      const poll = await prisma.poll.create({
        data: {
          guildId, channelId: body.channelId || 'pending',
          question: body.question,
          options: JSON.stringify(body.options.map((o: string, i: number) => ({ id: String(i), label: o, votes: 0 }))),
          status: 'OPEN',
        },
      });
      reply.status(201).send(success(poll, 'Sondage créé'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.put('/:guildId/polls/:id', { preHandler: [authenticate, validateParams(pollIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as any;
      const body = request.body as any;
      const p = await prisma.poll.findFirst({ where: { id, guildId } });
      if (!p) return reply.status(404).send(error('Sondage introuvable'));
      const upd: any = {};
      if (body.status) upd.status = body.status === 'CLOSED' ? 'CLOSED' : 'OPEN';
      const updated = await prisma.poll.update({ where: { id }, data: upd });
      reply.send(success({ ...updated, options: JSON.parse(updated.options) }, 'Sondage mis à jour'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/suggestions', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
      const where: any = { guildId };
      if (q.status) where.status = q.status;
      const [suggestions, total] = await Promise.all([
        prisma.suggestion.findMany({
          where, orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
          include: { author: { select: { username: true, avatar: true } } },
        }),
        prisma.suggestion.count({ where }),
      ]);
      reply.send(paginated(suggestions, total, page, limit));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.put('/:guildId/suggestions/:id', { preHandler: [authenticate, validateParams(suggestionIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as any;
      const body = request.body as any;
      const s = await prisma.suggestion.findFirst({ where: { id, guildId } });
      if (!s) return reply.status(404).send(error('Suggestion introuvable'));
      const upd: any = {};
      if (body.status) upd.status = body.status;
      if (body.staffResponse) { upd.staffResponse = body.staffResponse; upd.staffResponderId = request.user!.id; }
      const updated = await prisma.suggestion.update({ where: { id }, data: upd });
      reply.send(success(updated, 'Suggestion mise à jour'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/welcome', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      let welcome = await prisma.welcomeSettings.findUnique({ where: { guildId } });
      if (!welcome) welcome = await prisma.welcomeSettings.create({ data: { guildId } });
      reply.send(success({ settings: welcome }));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.put('/:guildId/welcome', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      await prisma.welcomeSettings.upsert({
        where: { guildId },
        update: {
          enabled: body.enabled ?? undefined,
          welcomeChannelId: body.welcomeChannelId ?? undefined,
          welcomeMessage: body.welcomeMessage ?? undefined,
          welcomeEmbed: body.welcomeEmbed ?? undefined,
          goodbyeEnabled: body.goodbyeEnabled ?? undefined,
          goodbyeChannelId: body.goodbyeChannelId ?? undefined,
          goodbyeMessage: body.goodbyeMessage ?? undefined,
          goodbyeEmbed: body.goodbyeEmbed ?? undefined,
          welcomeDM: body.welcomeDM ?? undefined,
          welcomeDMMessage: body.welcomeDMMessage ?? undefined,
        },
        create: { guildId, ...body },
      });
      reply.send(success(null, 'Paramètres de bienvenue mis à jour'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/autoroles', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      let ar = await prisma.autoroleSettings.findUnique({ where: { guildId }, include: { entries: true } });
      if (!ar) ar = await prisma.autoroleSettings.create({ data: { guildId }, include: { entries: true } });
      reply.send(success({ settings: ar }));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.put('/:guildId/autoroles', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      await prisma.autoroleSettings.upsert({
        where: { guildId },
        update: {
          enabled: body.enabled ?? undefined,
          onJoin: body.onJoin ?? undefined,
          onLevelUp: body.onLevelUp ?? undefined,
          onReaction: body.onReaction ?? undefined,
        },
        create: { guildId, ...body },
      });
      if (body.entries) {
        await prisma.autoroleEntry.deleteMany({ where: { guildId } });
        const settings = await prisma.autoroleSettings.findUnique({ where: { guildId } });
        if (settings) {
          for (const e of body.entries) {
            await prisma.autoroleEntry.create({
              data: {
                settingsId: settings.id, guildId,
                roleId: e.roleId, type: e.type || 'JOIN',
                levelRequired: e.levelRequired || null,
              },
            });
          }
        }
      }
      reply.send(success(null, 'Paramètres d\'autorôles mis à jour'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/embeds', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const embeds = await prisma.savedEmbed.findMany({ where: { guildId }, orderBy: { createdAt: 'desc' } });
      const data = embeds.map((e) => ({ ...e, fields: JSON.parse(e.fields) }));
      reply.send(success({ embeds: data }));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.post('/:guildId/embeds', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      if (!body.name) return reply.status(400).send(error('Nom requis'));
      const embed = await prisma.savedEmbed.create({
        data: {
          guildId, name: body.name,
          title: body.title || null, description: body.description || null,
          color: body.color || '#e0e0e0',
          fields: body.fields ? JSON.stringify(body.fields) : '[]',
          footer: body.footer || null, image: body.image || null,
          thumbnail: body.thumbnail || null, timestamp: body.timestamp ?? true,
        },
      });
      reply.status(201).send(success(embed, 'Embed créé'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.put('/:guildId/embeds/:id', { preHandler: [authenticate, validateParams(embedIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as any;
      const body = request.body as any;
      const embed = await prisma.savedEmbed.findFirst({ where: { id, guildId } });
      if (!embed) return reply.status(404).send(error('Embed introuvable'));
      const upd: any = {};
      if (body.name) upd.name = body.name;
      if (body.title !== undefined) upd.title = body.title;
      if (body.description !== undefined) upd.description = body.description;
      if (body.color) upd.color = body.color;
      if (body.fields) upd.fields = JSON.stringify(body.fields);
      if (body.footer !== undefined) upd.footer = body.footer;
      if (body.image !== undefined) upd.image = body.image;
      if (body.thumbnail !== undefined) upd.thumbnail = body.thumbnail;
      if (body.timestamp !== undefined) upd.timestamp = body.timestamp;
      const updated = await prisma.savedEmbed.update({ where: { id }, data: upd });
      reply.send(success(updated, 'Embed mis à jour'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.delete('/:guildId/embeds/:id', { preHandler: [authenticate, validateParams(embedIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as any;
      const embed = await prisma.savedEmbed.findFirst({ where: { id, guildId } });
      if (!embed) return reply.status(404).send(error('Embed introuvable'));
      await prisma.savedEmbed.delete({ where: { id } });
      reply.send(success(null, 'Embed supprimé'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/audit', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where: { guildId }, orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
          include: { user: { select: { username: true, avatar: true } } },
        }),
        prisma.auditLog.count({ where: { guildId } }),
      ]);
      reply.send(paginated(logs, total, page, limit));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });
}
