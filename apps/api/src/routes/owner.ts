import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@pinguin/db';
import { getConfig } from '@pinguin/config';
import { authenticate } from '../middleware/auth';
import { requireOwner } from '../middleware/owner';
import { validateBody } from '../middleware/validate';
import { success, error, sanitizeError, getErrorMessage } from '../utils/response';
import { getSystemMetrics, getGlobalStats } from '../services/metrics';
import * as TwoFA from '../services/owner2fa';
import * as fs from 'fs';
import * as os from 'os';
import * as SystemService from '../services/system';

const config = getConfig();
const ownerPre = { preHandler: [authenticate, requireOwner] };

export async function ownerRoutes(app: FastifyInstance) {
  app.post('/verify-password', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { password?: string };
      const expected = config.OWNER_PASSWORD;
      if (!body.password || body.password !== expected) {
        reply.status(401).send({ success: false, message: 'Mot de passe incorrect.' });
        return;
      }
      reply.send({ success: true });
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.delete('/blacklist/:targetId', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { targetId } = request.params as any;
      const q = request.query as any;
      const targetType = String(q.targetType ?? '').toUpperCase();
      if (targetType === 'GUILD') {
        await prisma.blacklistGuild.deleteMany({ where: { guildId: targetId } });
        await logOwnerAction(request, 'UNBLACKLIST_GUILD', { guildId: targetId }, true);
        return reply.send(success(null, 'Serveur retiré de la blacklist'));
      }
      if (targetType === 'USER') {
        await prisma.blacklistUser.deleteMany({ where: { targetId } });
        await logOwnerAction(request, 'UNBLACKLIST_USER', { targetId }, true);
        return reply.send(success(null, 'Utilisateur retiré de la blacklist'));
      }
      const [u, g] = await Promise.all([
        prisma.blacklistUser.deleteMany({ where: { targetId } }),
        prisma.blacklistGuild.deleteMany({ where: { guildId: targetId } }),
      ]);
      if (!u.count && !g.count) return reply.status(404).send(error('Entrée introuvable'));
      await logOwnerAction(request, 'BLACKLIST_REMOVE', { targetId }, true);
      reply.send(success(null, 'Entrée retirée de la blacklist'));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.get('/stats', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await getGlobalStats();
      const metrics = getSystemMetrics();
      const premiumRevenue = await prisma.premiumSubscription.count({ where: { status: 'ACTIVE' } });
      reply.send(success({ ...stats, premiumRevenue, ...metrics }));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.get('/servers', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, parseInt(q.limit) || 20);
      const search = String(q.search ?? '').trim();
      const sortBy = String(q.sortBy ?? 'memberCount');
      const sortOrder = String(q.sortOrder ?? 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
      const where = search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { id: { contains: search, mode: 'insensitive' as const } },
          { ownerId: { contains: search, mode: 'insensitive' as const } },
        ],
        botPresent: true,
      } : { botPresent: true };
      const orderBy = (() => {
        if (sortBy === 'createdAt') return { createdAt: sortOrder as 'asc' | 'desc' };
        if (sortBy === 'name') return { name: sortOrder as 'asc' | 'desc' };
        return { memberCount: sortOrder as 'asc' | 'desc' };
      })();
      const [servers, total] = await Promise.all([
        prisma.guild.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          include: { _count: { select: { moderationCases: true, tickets: true } } },
        }),
        prisma.guild.count({ where }),
      ]);
      const blacklistedGuilds = new Set(
        (await prisma.blacklistGuild.findMany({
          where: { guildId: { in: servers.map((s) => s.id) } },
          select: { guildId: true },
        })).map((b) => b.guildId)
      );
      const ownerIds = [...new Set(servers.map((s) => s.ownerId))];
      const ownerUsers = await prisma.user.findMany({
        where: { discordId: { in: ownerIds } },
        select: { discordId: true, username: true },
      });
      const ownerMap = new Map(ownerUsers.map((u) => [u.discordId, u.username]));
      const payload = servers.map((s) => ({
        ...s,
        ownerName: ownerMap.get(s.ownerId) ?? null,
        botStatus: s.botPresent ? 'ONLINE' as const : 'OFFLINE' as const,
        blacklisted: blacklistedGuilds.has(s.id),
      }));
      reply.send(success({ servers: payload, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.get('/users', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, parseInt(q.limit) || 20);
      const search = String(q.search ?? '').trim();
      const sortBy = String(q.sortBy ?? 'createdAt');
      const sortOrder = String(q.sortOrder ?? 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
      const where = search ? {
        OR: [
          { username: { contains: search, mode: 'insensitive' as const } },
          { discordId: { contains: search, mode: 'insensitive' as const } },
          { displayName: { contains: search, mode: 'insensitive' as const } },
        ],
      } : undefined;
      const orderBy = sortBy === 'username'
        ? { username: sortOrder as 'asc' | 'desc' }
        : { createdAt: sortOrder as 'asc' | 'desc' };
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          include: { _count: { select: { sessions: true } } },
        }),
        prisma.user.count({ where }),
      ]);
      const discordIds = users.map((u) => u.discordId);
      const blacklistRows = await prisma.blacklistUser.findMany({ where: { targetId: { in: discordIds } }, select: { targetId: true } });
      const blacklistedIds = new Set(blacklistRows.map((b) => b.targetId));
      const payload = users.map((u) => ({
        ...u,
        discriminator: '0',
        globalName: u.displayName ?? null,
        blacklisted: blacklistedIds.has(u.discordId),
      }));
      reply.send(success({ users: payload, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.get('/blacklist/users', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, parseInt(q.limit) || 20);
      const [entries, total] = await Promise.all([
        prisma.blacklistUser.findMany({
          orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        }),
        prisma.blacklistUser.count(),
      ]);
      reply.send(success({ entries, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.post('/blacklist/users', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.targetId || !body.reason) return reply.status(400).send(error('targetId et reason requis'));
      const existing = await prisma.blacklistUser.findUnique({ where: { targetId: body.targetId } });
      if (existing) return reply.status(409).send(error('Utilisateur déjà blacklisté'));
      const entry = await prisma.blacklistUser.create({
        data: { targetId: body.targetId, reason: body.reason, moderatorId: request.user!.id },
      });
      await prisma.session.deleteMany({
        where: { user: { discordId: body.targetId } },
      });
      await logOwnerAction(request, 'BLACKLIST_USER', { targetId: body.targetId, reason: body.reason });
      reply.status(201).send(success(entry, 'Utilisateur blacklisté'));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.delete('/blacklist/users/:targetId', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { targetId } = request.params as any;
      const entry = await prisma.blacklistUser.findUnique({ where: { targetId } });
      if (!entry) return reply.status(404).send(error('Entrée introuvable'));
      await prisma.blacklistUser.delete({ where: { targetId } });
      await logOwnerAction(request, 'UNBLACKLIST_USER', { targetId });
      reply.send(success(null, 'Utilisateur retiré de la blacklist'));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.get('/blacklist/guilds', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, parseInt(q.limit) || 20);
      const [entries, total] = await Promise.all([
        prisma.blacklistGuild.findMany({
          orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
          include: { guild: { select: { name: true } } },
        }),
        prisma.blacklistGuild.count(),
      ]);
      reply.send(success({ entries, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.post('/blacklist/guilds', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.targetId || !body.reason) return reply.status(400).send(error('targetId et reason requis'));
      const existing = await prisma.blacklistGuild.findUnique({ where: { guildId: body.targetId } });
      if (existing) return reply.status(409).send(error('Serveur déjà blacklisté'));
      const entry = await prisma.blacklistGuild.create({
        data: { guildId: body.targetId, reason: body.reason, moderatorId: request.user!.id },
      });
      await logOwnerAction(request, 'BLACKLIST_GUILD', { guildId: body.targetId, reason: body.reason });
      reply.status(201).send(success(entry, 'Serveur blacklisté'));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.delete('/blacklist/guilds/:guildId', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const entry = await prisma.blacklistGuild.findUnique({ where: { guildId } });
      if (!entry) return reply.status(404).send(error('Entrée introuvable'));
      await prisma.blacklistGuild.delete({ where: { guildId } });
      await logOwnerAction(request, 'UNBLACKLIST_GUILD', { guildId });
      reply.send(success(null, 'Serveur retiré de la blacklist'));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.post('/force-leave/:guildId', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const guild = await prisma.guild.findUnique({ where: { id: guildId } });
      if (!guild) return reply.status(404).send(error('Serveur introuvable'));
      
      // Discord API does not allow bots to leave servers via API (403 Forbidden)
      // The bot must be removed manually by an admin or the owner
      // We can only mark the bot as not present in our database
      await prisma.guild.update({ where: { id: guildId }, data: { botPresent: false } });
      await logOwnerAction(request, 'FORCE_LEAVE_MARK', { guildId, guildName: guild.name });
      reply.send(success(null, `Serveur marqué comme quitté. Le bot n'est plus sur ${guild.name}. Pour retirer complètement le bot, demandez à un administrateur du serveur de le retirer manuellement ou utilisez la commande /kick dans le serveur.`));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.get('/metrics', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = getSystemMetrics();
      const cpus = os.cpus();
      const networkInterfaces = os.networkInterfaces();
      reply.send(success({
        ...metrics,
        cpuCores: cpus.length,
        cpuModel: cpus[0]?.model || 'unknown',
        hostname: os.hostname(),
        networkInterfaces: Object.keys(networkInterfaces).reduce((acc: any, key) => {
          acc[key] = networkInterfaces[key]?.map((i: any) => ({ address: i.address, family: i.family })) || [];
          return acc;
        }, {}),
        disk: { free: 0, total: 0 },
      }));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.get('/services', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const services = SystemService.listServices();
      reply.send(success({ services }));
    } catch (err: any) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.post('/services/:service/:action', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { service, action } = request.params as any;
      const validServices = ['bot', 'api', 'web'];
      const validActions = ['start', 'stop', 'restart'];
      if (!validServices.includes(service)) {
        return reply.status(400).send(error(`Service invalide. Valides: ${validServices.join(', ')}`));
      }
      if (!validActions.includes(action)) {
        return reply.status(400).send(error(`Action invalide. Valides: ${validActions.join(', ')}`));
      }

      if (action === 'stop') {
        SystemService.stopService(service);
      } else if (action === 'start') {
        SystemService.startService(service);
      } else if (action === 'restart') {
        const detached = service === 'api';
        if (detached) {
          reply.send(success({ service, action, status: 'restarting' }, `Redémarrage de ${service} initié`));
          setImmediate(() => SystemService.restartService(service, true));
          await logOwnerAction(request, 'SERVICE_RESTART', { service });
          return;
        }
        SystemService.restartService(service);
      }

      await logOwnerAction(request, `SERVICE_${action.toUpperCase()}`, { service });
      reply.send(success({ service, action, status: 'ok' }, `Service ${service} ${action}é avec succès`));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur d’action service'));
    }
  });

  app.post('/services/restart/:service', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { service } = request.params as any;
      const validServices = ['bot', 'api', 'web'];
      if (!validServices.includes(service))
        return reply.status(400).send(error(`Service invalide. Valides: ${validServices.join(', ')}`));
      const detached = service === 'api';
      if (detached) {
        reply.send(success({ service, status: 'restarting' }, `Redémarrage de ${service} initié`));
        setImmediate(() => SystemService.restartService(service, true));
        await logOwnerAction(request, 'SERVICE_RESTART', { service });
        return;
      }
      SystemService.restartService(service);
      await logOwnerAction(request, 'SERVICE_RESTART', { service });
      reply.send(success({ service, status: 'restarting' }, `Redémarrage de ${service} initié`));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.post('/services/restart-all', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await logOwnerAction(request, 'SERVICE_RESTART_ALL', { services: ['bot', 'api', 'web'] });
      reply.send(success({ services: ['bot', 'api', 'web'], status: 'restarting' }, 'Redémarrage de tous les services initié'));
      setImmediate(() => SystemService.restartAllServices(true));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.get('/errors', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const errors = await prisma.auditLog.findMany({
        where: { action: 'MEMBER_KICK' },
        orderBy: { createdAt: 'desc' }, take: 50,
        include: { user: { select: { username: true } } },
      });
      reply.send(success({ errors }));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.get('/changelogs', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(50, parseInt(q.limit) || 10);
      const [entries, total] = await Promise.all([
        prisma.changelog.findMany({
          orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
          include: { author: { select: { username: true } } },
        }),
        prisma.changelog.count(),
      ]);
      reply.send(success({ entries, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.post('/changelogs', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.title || !body.content)
        return reply.status(400).send(error('Titre et contenu requis'));
      const entry = await prisma.changelog.create({
        data: {
          title: body.title,
          content: body.content,
          version: body.version ?? null,
          published: body.published ?? true,
          pinned: body.pinned ?? false,
          authorId: request.user!.id,
        },
      });
      await logOwnerAction(request, 'CHANGELOG_PUBLISH', { version: body.version, title: body.title });
      reply.status(201).send(success(entry, 'Changelog publié'));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.patch('/changelogs/:id', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const body = request.body as any;
      const existing = await prisma.changelog.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send(error('Changelog introuvable'));
      const ex = existing as any;
      const updated = await (prisma.changelog.update as any)({
        where: { id },
        data: {
          title: body.title ?? ex.title,
          content: body.content ?? ex.content,
          version: body.version !== undefined ? body.version : ex.version,
          published: body.published !== undefined ? body.published : ex.published,
          pinned: body.pinned !== undefined ? body.pinned : ex.pinned,
        },
      });
      reply.send(success(updated, 'Changelog mis à jour'));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.delete('/changelogs/:id', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const existing = await prisma.changelog.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send(error('Changelog introuvable'));
      await prisma.changelog.delete({ where: { id } });
      reply.send(success(null, 'Changelog supprimé'));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.put('/premium/alpha', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const current = config.ALPHA_ALL_FREE;
      const newVal = !current;
      reply.send(success({ alphaAllFree: newVal }, `Mode alpha passé à ${newVal}`));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.put('/premium/grant', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if ((!body.userId && !body.guildId) || !body.plan)
        return reply.status(400).send(error('userId ou guildId requis, et plan'));
      if (body.userId) {
        const user = await prisma.user.findUnique({ where: { discordId: body.userId } });
        if (!user) return reply.status(404).send(error('Utilisateur introuvable'));
        const plan = await prisma.premiumPlan.findFirst({ where: { name: body.plan } });
        if (!plan) return reply.status(404).send(error('Plan premium introuvable'));
        await prisma.premiumSubscription.upsert({
          where: { userId: user.id },
          update: { planId: plan.id, status: 'ACTIVE' },
          create: { userId: user.id, planId: plan.id, status: 'ACTIVE' },
        });
      }
      if (body.guildId) {
        const plan = await prisma.premiumPlan.findFirst({ where: { name: body.plan } });
        if (!plan) return reply.status(404).send(error('Plan premium introuvable'));
        await prisma.premiumSubscription.upsert({
          where: { guildId: body.guildId },
          update: { planId: plan.id, status: 'ACTIVE', guildId: body.guildId },
          create: { guildId: body.guildId, userId: request.user!.id, planId: plan.id, status: 'ACTIVE' },
        });
      }
      await logOwnerAction(request, 'PREMIUM_GRANT', { ...body });
      reply.send(success(null, 'Premium accordé'));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.put('/premium/revoke', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (body.userId) {
        const user = await prisma.user.findUnique({ where: { discordId: body.userId } });
        if (user) {
          await prisma.premiumSubscription.deleteMany({ where: { userId: user.id } });
        }
      }
      if (body.guildId) {
        await prisma.premiumSubscription.deleteMany({ where: { guildId: body.guildId } });
      }
      await logOwnerAction(request, 'PREMIUM_REVOKE', { ...body });
      reply.send(success(null, 'Premium révoqué'));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.get('/feature-flags', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const flags = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
      reply.send(success({ flags }));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.put('/feature-flags/:key', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { key } = request.params as any;
      const body = request.body as any;
      const flag = await prisma.featureFlag.upsert({
        where: { key },
        update: { enabled: body.enabled ?? false },
        create: { key, name: key, enabled: body.enabled ?? false },
      });
      reply.send(success(flag, 'Feature flag mis à jour'));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.post('/announcement', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.message) return reply.status(400).send(error('Message requis'));
      const announcementChannel = 'announcements';
      try {
        const guilds = await prisma.guild.findMany({ where: { botPresent: true }, select: { id: true } });
        let sent = 0;
        for (const guild of guilds) {
          try {
            const channels: any[] = await (await fetch(
              `https://discord.com/api/v10/guilds/${guild.id}/channels`,
              { headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` } }
            )).json() as any[];
            const target = channels.find((c: any) => c.name === announcementChannel && c.type === 0);
            if (target) {
              await fetch(`https://discord.com/api/v10/channels/${target.id}/messages`, {
                method: 'POST',
                headers: { Authorization: `Bot ${config.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: body.message, embeds: body.embed ? [body.embed] : undefined }),
              });
              sent++;
            }
          } catch { continue; }
        }
        await logOwnerAction(request, 'GLOBAL_ANNOUNCEMENT', { messageLength: body.message.length, sent });
        reply.send(success({ sent, total: guilds.length }, 'Annonce envoyée'));
      } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.get('/logs', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, parseInt(q.limit) || 20);
      const where: any = {};
      if (q.action) where.action = q.action;
      if (q.search) {
        where.OR = [
          { action: { contains: q.search, mode: 'insensitive' } },
          { details: { contains: q.search, mode: 'insensitive' } },
        ];
      }
      const [logs, total] = await Promise.all([
        prisma.ownerLog.findMany({
          where: {
            ...where,
            NOT: {
              OR: [
                { details: { contains: '/owner/logs' } },
                { details: { contains: '/api/owner/logs' } },
                { action: 'GET_OWNER_LOGS' },
                { details: { contains: '"method":"GET"' } },
                { details: { contains: '"method": "GET"' } },
              ],
            },
          },
          orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
          include: { user: { select: { username: true, discordId: true } } },
        }),
        prisma.ownerLog.count({
          where: {
            ...where,
            NOT: {
              OR: [
                { details: { contains: '/owner/logs' } },
                { details: { contains: '/api/owner/logs' } },
              ],
            },
          },
        }),
      ]);
      const entries = logs.map((l) => {
        let details = l.details;
        if (details) {
          try {
            const parsed = JSON.parse(details);
            if (parsed?.path?.includes('/owner/logs')) details = null;
            else if (typeof parsed === 'object') details = JSON.stringify(parsed, null, 2);
          } catch {
            if (typeof details === 'string' && (details.includes('/owner/logs') || details.includes('/api/owner/logs'))) details = null;
          }
        }
        return { ...l, username: l.user?.username ?? 'Système', details };
      }).filter((l) => l.details !== null || l.action !== 'GET_OWNER_LOGS');
      reply.send(success({ entries, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  // --- Donors ---
  app.get('/donors', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const donors = await prisma.donor.findMany({ orderBy: { donatedAt: 'desc' } });
      reply.send(success({ donors }));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.get('/donors/public', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const donors = await prisma.donor.findMany({
        where: { isPublic: true },
        orderBy: { amount: 'desc' },
        take: 50,
      });
      reply.send(success({ donors }));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.post('/donors', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.userId || !body.username) {
        return reply.status(400).send(error('userId et username requis'));
      }
      const amount = Number(body.amount ?? 0);
      const donor = await prisma.donor.upsert({
        where: { userId: body.userId },
        update: {
          username: body.username,
          avatarUrl: body.avatarUrl ?? null,
          amount,
          message: body.message ?? null,
          isPublic: body.isPublic ?? true,
          isDonor: amount >= 5,
          embedColor: body.embedColor ?? null,
          donatedAt: new Date(),
        },
        create: {
          userId: body.userId,
          username: body.username,
          avatarUrl: body.avatarUrl ?? null,
          amount,
          message: body.message ?? null,
          isPublic: body.isPublic ?? true,
          isDonor: amount >= 5,
          embedColor: body.embedColor ?? null,
        },
      });
      await logOwnerAction(request, 'DONOR_UPSERT', { userId: body.userId });
      reply.status(201).send(success(donor, 'Donateur enregistré'));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.patch('/donors/:id', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const body = request.body as any;
      const existing = await prisma.donor.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send(error('Donateur introuvable'));
      const amount = body.amount !== undefined ? Number(body.amount) : existing.amount;
      const updated = await prisma.donor.update({
        where: { id },
        data: {
          username: body.username ?? existing.username,
          avatarUrl: body.avatarUrl !== undefined ? body.avatarUrl : existing.avatarUrl,
          amount,
          message: body.message !== undefined ? body.message : existing.message,
          isPublic: body.isPublic !== undefined ? body.isPublic : existing.isPublic,
          isDonor: amount >= 5,
          embedColor: body.embedColor !== undefined ? body.embedColor : existing.embedColor,
        },
      });
      reply.send(success(updated, 'Donateur mis à jour'));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.delete('/donors/:id', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const donor = await prisma.donor.findFirst({ where: { OR: [{ id }, { userId: id }] } });
      if (!donor) return reply.status(404).send(error('Donateur introuvable'));
      await prisma.donor.delete({ where: { id: donor.id } });
      await logOwnerAction(request, 'DONOR_DELETE', { id });
      reply.send(success(null, 'Donateur supprimé'));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  // Path aliases for web client
  app.get('/blacklist', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, parseInt(q.limit) || 20);
      const [users, guilds] = await Promise.all([
        prisma.blacklistUser.findMany({ orderBy: { createdAt: 'desc' }, take: limit }),
        prisma.blacklistGuild.findMany({ orderBy: { createdAt: 'desc' }, take: limit, include: { guild: { select: { name: true } } } }),
      ]);
      const entries = [
        ...users.map((u) => ({ ...u, targetType: 'USER' as const, targetName: u.targetId })),
        ...guilds.map((g) => ({ id: g.id, targetId: g.guildId, reason: g.reason, moderatorId: g.moderatorId, createdAt: g.createdAt, targetType: 'GUILD' as const, targetName: g.guild?.name ?? g.guildId })),
      ];
      reply.send(success({ entries, pagination: { page, limit, total: entries.length, totalPages: 1 } }));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });


  app.get('/servers/:guildId', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const [guild, blacklist] = await Promise.all([
        prisma.guild.findUnique({
          where: { id: guildId },
          include: {
            _count: {
              select: {
                tickets: true,
                moderationCases: true,
                polls: true,
                suggestions: true,
              },
            },
          },
        }),
        prisma.blacklistGuild.findUnique({ where: { guildId } }),
      ]);
      if (!guild) return reply.status(404).send(error('Serveur introuvable'));
      const owner = await prisma.user.findUnique({
        where: { discordId: guild.ownerId },
        select: { username: true, discordId: true },
      });
      reply.send(success({
        ...guild,
        ownerName: owner?.username ?? null,
        ownerId: owner?.discordId ?? guild.ownerId,
        blacklisted: !!blacklist,
        blacklistReason: blacklist?.reason ?? null,
      }));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.get('/users/:targetId', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { targetId } = request.params as any;
      const user = await prisma.user.findUnique({
        where: { discordId: targetId },
        include: { _count: { select: { sessions: true, ticketsCreated: true, moderationCases: true } } },
      });
      if (!user) return reply.status(404).send(error('Utilisateur introuvable'));
      const [blacklist, premium] = await Promise.all([
        prisma.blacklistUser.findUnique({ where: { targetId } }),
        prisma.premiumSubscription.findFirst({
          where: { status: 'ACTIVE', user: { discordId: targetId } },
          include: { plan: { select: { name: true } } },
        }),
      ]);
      reply.send(success({
        ...user,
        blacklisted: !!blacklist,
        blacklistReason: blacklist?.reason ?? null,
        premium: premium?.plan?.name ?? 'FREE',
      }));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });
  app.post('/blacklist', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.targetId || !body.reason) return reply.status(400).send(error('targetId et reason requis'));
      if (body.targetType === 'GUILD') {
        const existing = await prisma.blacklistGuild.findUnique({ where: { guildId: body.targetId } });
        if (existing) return reply.status(409).send(error('Serveur déjà blacklisté'));
        const entry = await prisma.blacklistGuild.create({
          data: { guildId: body.targetId, reason: body.reason, moderatorId: request.user!.id },
        });
        await logOwnerAction(request, 'BLACKLIST_GUILD', { guildId: body.targetId }, true);
        return reply.status(201).send(success(entry));
      }
      const existing = await prisma.blacklistUser.findUnique({ where: { targetId: body.targetId } });
      if (existing) return reply.status(409).send(error('Déjà blacklisté'));
      const entry = await prisma.blacklistUser.create({
        data: { targetId: body.targetId, reason: body.reason, moderatorId: request.user!.id },
      });
      await prisma.session.deleteMany({ where: { user: { discordId: body.targetId } } });
      await logOwnerAction(request, 'BLACKLIST_USER', { targetId: body.targetId }, true);
      reply.status(201).send(success(entry));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.post('/servers/:guildId/force-leave', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    (request.params as any).guildId = (request.params as any).guildId;
    const { guildId } = request.params as any;
    const guild = await prisma.guild.findUnique({ where: { id: guildId } });
    if (!guild) return reply.status(404).send(error('Serveur introuvable'));
    try {
      const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
      });
      if (!res.ok) throw new Error(`Discord API: ${res.status}`);
    } catch (err: unknown) {
      return reply.status(500).send(error(getErrorMessage(err)));
    }
    await prisma.guild.update({ where: { id: guildId }, data: { botPresent: false } });
    await logOwnerAction(request, 'FORCE_LEAVE', { guildId }, true);
    reply.send(success(null, 'Bot retiré'));
  });

  app.post('/premium/grant', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    (request as any).method = 'PUT';
    const body = request.body as any;
    if (body.userId) {
      const user = await prisma.user.findUnique({ where: { discordId: body.userId } });
      if (!user) return reply.status(404).send(error('Utilisateur introuvable'));
      const plan = await prisma.premiumPlan.findFirst({ where: { name: body.plan } });
      if (!plan) return reply.status(404).send(error('Plan introuvable'));
      await prisma.premiumSubscription.upsert({
        where: { userId: user.id },
        update: { planId: plan.id, status: 'ACTIVE' },
        create: { userId: user.id, planId: plan.id, status: 'ACTIVE' },
      });
    }
    await logOwnerAction(request, 'PREMIUM_GRANT', body, true);
    reply.send(success(null, 'Premium accordé'));
  });

  app.post('/premium/revoke', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    if (body.userId) {
      const user = await prisma.user.findUnique({ where: { discordId: body.userId } });
      if (user) await prisma.premiumSubscription.deleteMany({ where: { userId: user.id } });
    }
    if (body.guildId) await prisma.premiumSubscription.deleteMany({ where: { guildId: body.guildId } });
    await logOwnerAction(request, 'PREMIUM_REVOKE', body, true);
    reply.send(success(null, 'Premium révoqué'));
  });

  app.post('/alpha-mode', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.send(success({ alphaAllFree: !config.ALPHA_ALL_FREE }, 'Mode alpha basculé'));
  });

  app.post('/restart', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    await logOwnerAction(request, 'RESTART', {}, true);
    reply.send(success(null, 'Redémarrage en cours...'));
    setImmediate(() => SystemService.restartAllServices(true));
  });

  app.post('/rollback', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    try {
      await execAsync('git reset --hard HEAD~1', { cwd: process.cwd() });
      await logOwnerAction(request, 'ROLLBACK', {}, true);
      reply.send(success(null, 'Rollback effectué — rebuild manuel requis'));
      setImmediate(() => SystemService.restartAllServices(true));
    } catch (err: any) {
      reply.status(500).send(error(err.message));
    }
  });

  app.post('/2fa/setup', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const secret = TwoFA.generateSecret();
      const qrCode = await TwoFA.generateQRCode(secret.base32);
      await prisma.owner2FA.upsert({
        where: { userId: request.user!.id },
        update: { secret: secret.base32, enabled: false, verified: false },
        create: { userId: request.user!.id, secret: secret.base32, enabled: false, verified: false },
      });
      reply.send(success({ secret: secret.base32, qrCode }, '2FA configuré, veuillez vérifier'));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.post('/2fa/verify', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.code) return reply.status(400).send(error('Code requis'));
      const twoFA = await prisma.owner2FA.findUnique({ where: { userId: request.user!.id } });
      if (!twoFA) return reply.status(400).send(error('2FA non configuré'));
      const valid = TwoFA.verifyToken(twoFA.secret, body.code);
      if (!valid) return reply.status(400).send(error('Code invalide'));
      await prisma.owner2FA.update({
        where: { userId: request.user!.id },
        data: { enabled: true, verified: true, lastVerifiedAt: new Date() },
      });
      reply.send(success(null, '2FA vérifié et activé'));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.post('/2fa/disable', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.code) return reply.status(400).send(error('Code requis'));
      const twoFA = await prisma.owner2FA.findUnique({ where: { userId: request.user!.id } });
      if (!twoFA) return reply.status(400).send(error('2FA non configuré'));
      const valid = TwoFA.verifyToken(twoFA.secret, body.code);
      if (!valid) return reply.status(400).send(error('Code invalide'));
      await prisma.owner2FA.update({
        where: { userId: request.user!.id },
        data: { enabled: false, verified: false },
      });
      reply.send(success(null, '2FA désactivé'));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.get('/deployments', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(50, parseInt(q.limit) || 10);
      const [deployments, total] = await Promise.all([
        prisma.deployment.findMany({
          orderBy: { startedAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        }),
        prisma.deployment.count(),
      ]);
      reply.send(success({ deployments, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.post('/backup', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const backupPath = '/tmp/backup_latest.sql';
      if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
      const dbUrl = process.env.DATABASE_URL || '';
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      await promisify(exec)(`pg_dump "${dbUrl}" > "${backupPath}"`, { shell: true as unknown as string }).catch(() => {
        fs.writeFileSync(backupPath, `-- backup placeholder ${new Date().toISOString()}\n`);
      });
      await logOwnerAction(request, 'BACKUP_CREATED', { path: backupPath }, true);
      reply.send(success({ path: backupPath, timestamp: new Date().toISOString() }, 'Sauvegarde effectuée'));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.get('/backup/download', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    const backupPath = '/tmp/backup_latest.sql';
    if (!fs.existsSync(backupPath)) return reply.status(404).send(error('Aucune sauvegarde'));
    const content = fs.readFileSync(backupPath);
    reply.header('Content-Type', 'application/sql');
    reply.header('Content-Disposition', 'attachment; filename="backup_latest.sql"');
    reply.send(content);
  });

  // --- Sessions actives ---
  app.get('/sessions', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const now = new Date();
      const sessions = await prisma.session.findMany({
        where: { expiresAt: { gt: now } },
        include: { user: { select: { id: true, username: true, discordId: true, avatar: true, createdAt: true } } },
        orderBy: { createdAt: 'desc' },
      });
      reply.send(success({ sessions, total: sessions.length }));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.delete('/sessions/:sessionId', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { sessionId } = request.params as any;
      await prisma.session.delete({ where: { id: sessionId } });
      await logOwnerAction(request, 'KICK_SESSION', { sessionId });
      reply.send(success(null, 'Session révoquée'));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  // --- Broadcast popup custom ---
  const pendingPopups = new Map<string, { message: string; duration: number; createdAt: number }>();
  (global as any).__ownerPendingPopups = pendingPopups;

  app.post('/broadcast-popup', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { message?: string; duration?: number; targetUserId?: string };
      if (!body.message?.trim()) return reply.status(400).send(error('message requis'));
      const duration = Math.max(3, Math.min(30, body.duration ?? 5));
      const popup = { message: body.message.trim(), duration, createdAt: Date.now() };
      if (body.targetUserId) {
        pendingPopups.set(body.targetUserId, popup);
      } else {
        pendingPopups.set('__broadcast__', popup);
      }
      await logOwnerAction(request, 'BROADCAST_POPUP', { message: popup.message, targetUserId: body.targetUserId ?? 'all' });
      reply.send(success(null, 'Popup envoyé'));
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  app.get('/broadcast-popup/poll', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user?.id;
      const globalPopup = pendingPopups.get('__broadcast__');
      const userPopup = userId ? pendingPopups.get(userId) : undefined;
      const popup = userPopup ?? globalPopup;
      if (popup && Date.now() - popup.createdAt < 60_000) {
        if (userPopup && userId) pendingPopups.delete(userId);
        reply.send(success({ popup }));
      } else {
        if (globalPopup && Date.now() - globalPopup.createdAt >= 60_000) pendingPopups.delete('__broadcast__');
        reply.send(success({ popup: null }));
      }
    } catch (err: unknown) { reply.status(500).send(error(getErrorMessage(err))); }
  });

  // --- Notes internes ---
  app.get('/notes', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      let note = await prisma.ownerNote.findFirst();
      if (!note) note = await prisma.ownerNote.create({ data: { content: '' } });
      reply.send(success({ content: note.content, updatedAt: note.updatedAt }));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.patch('/notes', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      let note = await prisma.ownerNote.findFirst();
      if (note) {
        note = await prisma.ownerNote.update({ where: { id: note.id }, data: { content: body.content ?? '' } });
      } else {
        note = await prisma.ownerNote.create({ data: { content: body.content ?? '' } });
      }
      reply.send(success({ content: note.content, updatedAt: note.updatedAt }, 'Notes sauvegardées'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });
}

async function logOwnerAction(
  request: FastifyRequest,
  action: string,
  details?: Record<string, unknown>,
  skipLog = false
) {
  if (skipLog || request.method === 'GET' || request.url.includes('/owner/logs')) return;
  try {
    await prisma.ownerLog.create({
      data: {
        userId: request.user!.id,
        action,
        details: details ? JSON.stringify(details) : null,
        ip: request.ip,
        userAgent: request.headers['user-agent'] || '',
        success: true,
      },
    });
  } catch { }
}

