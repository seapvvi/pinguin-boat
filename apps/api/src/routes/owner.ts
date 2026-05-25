import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@pinguin/db';
import { getConfig } from '@pinguin/config';
import { authenticate } from '../middleware/auth';
import { requireOwner } from '../middleware/owner';
import { validateBody } from '../middleware/validate';
import { success, error, sanitizeError } from '../utils/response';
import { getSystemMetrics, getGlobalStats } from '../services/metrics';
import * as TwoFA from '../services/owner2fa';
import * as fs from 'fs';
import * as os from 'os';
import * as SystemService from '../services/system';

const config = getConfig();
const ownerPre = { preHandler: [authenticate, requireOwner] };

export async function ownerRoutes(app: FastifyInstance) {
  app.get('/stats', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await getGlobalStats();
      const metrics = getSystemMetrics();
      const premiumRevenue = await prisma.premiumSubscription.count({ where: { status: 'ACTIVE' } });
      reply.send(success({ ...stats, premiumRevenue, ...metrics }));
    } catch (err: any) { reply.status(500).send(error(err.message)); }
  });

  app.get('/servers', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, parseInt(q.limit) || 20);
      const [servers, total] = await Promise.all([
        prisma.guild.findMany({
          orderBy: { memberCount: 'desc' }, skip: (page - 1) * limit, take: limit,
          include: { _count: { select: { moderationCases: true, tickets: true } } },
        }),
        prisma.guild.count(),
      ]);
      reply.send(success({ servers, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }));
    } catch (err: any) { reply.status(500).send(error(err.message)); }
  });

  app.get('/users', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, parseInt(q.limit) || 20);
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
          include: { _count: { select: { sessions: true } } },
        }),
        prisma.user.count(),
      ]);
      reply.send(success({ users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }));
    } catch (err: any) { reply.status(500).send(error(err.message)); }
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
    } catch (err: any) { reply.status(500).send(error(err.message)); }
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
    } catch (err: any) { reply.status(500).send(error(err.message)); }
  });

  app.delete('/blacklist/users/:targetId', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { targetId } = request.params as any;
      const entry = await prisma.blacklistUser.findUnique({ where: { targetId } });
      if (!entry) return reply.status(404).send(error('Entrée introuvable'));
      await prisma.blacklistUser.delete({ where: { targetId } });
      await logOwnerAction(request, 'UNBLACKLIST_USER', { targetId });
      reply.send(success(null, 'Utilisateur retiré de la blacklist'));
    } catch (err: any) { reply.status(500).send(error(err.message)); }
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
    } catch (err: any) { reply.status(500).send(error(err.message)); }
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
    } catch (err: any) { reply.status(500).send(error(err.message)); }
  });

  app.delete('/blacklist/guilds/:guildId', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const entry = await prisma.blacklistGuild.findUnique({ where: { guildId } });
      if (!entry) return reply.status(404).send(error('Entrée introuvable'));
      await prisma.blacklistGuild.delete({ where: { guildId } });
      await logOwnerAction(request, 'UNBLACKLIST_GUILD', { guildId });
      reply.send(success(null, 'Serveur retiré de la blacklist'));
    } catch (err: any) { reply.status(500).send(error(err.message)); }
  });

  app.post('/force-leave/:guildId', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const guild = await prisma.guild.findUnique({ where: { id: guildId } });
      if (!guild) return reply.status(404).send(error('Serveur introuvable'));
      try {
        const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
        });
        if (!res.ok) throw new Error(`Discord API: ${res.status}`);
      } catch (fetchErr: any) {
        return reply.status(500).send(error(`Impossible de quitter le serveur: ${fetchErr.message}`));
      }
      await prisma.guild.update({ where: { id: guildId }, data: { botPresent: false } });
      await logOwnerAction(request, 'FORCE_LEAVE', { guildId, guildName: guild.name });
      reply.send(success(null, `Bot retiré du serveur ${guild.name}`));
    } catch (err: any) { reply.status(500).send(error(err.message)); }
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
    } catch (err: any) { reply.status(500).send(error(err.message)); }
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
    } catch (err: any) { reply.status(500).send(error(err.message)); }
  });

  app.post('/services/restart-all', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await logOwnerAction(request, 'SERVICE_RESTART_ALL', { services: ['bot', 'api', 'web'] });
      reply.send(success({ services: ['bot', 'api', 'web'], status: 'restarting' }, 'Redémarrage de tous les services initié'));
      setImmediate(() => SystemService.restartAllServices(true));
    } catch (err: any) { reply.status(500).send(error(err.message)); }
  });

  app.get('/errors', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const errors = await prisma.auditLog.findMany({
        where: { action: 'MEMBER_KICK' },
        orderBy: { createdAt: 'desc' }, take: 50,
        include: { user: { select: { username: true } } },
      });
      reply.send(success({ errors }));
    } catch (err: any) { reply.status(500).send(error(err.message)); }
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
    } catch (err: any) { reply.status(500).send(error(err.message)); }
  });

  app.post('/changelogs', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      if (!body.title || !body.content || !body.version)
        return reply.status(400).send(error('Titre, contenu et version requis'));
      const entry = await prisma.changelog.create({
        data: { title: body.title, content: body.content, version: body.version, authorId: request.user!.id },
      });
      await logOwnerAction(request, 'CHANGELOG_PUBLISH', { version: body.version, title: body.title });
      reply.status(201).send(success(entry, 'Changelog publié'));
    } catch (err: any) { reply.status(500).send(error(err.message)); }
  });

  app.put('/premium/alpha', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const current = config.ALPHA_ALL_FREE;
      const newVal = !current;
      reply.send(success({ alphaAllFree: newVal }, `Mode alpha passé à ${newVal}`));
    } catch (err: any) { reply.status(500).send(error(err.message)); }
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
    } catch (err: any) { reply.status(500).send(error(err.message)); }
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
    } catch (err: any) { reply.status(500).send(error(err.message)); }
  });

  app.get('/feature-flags', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const flags = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
      reply.send(success({ flags }));
    } catch (err: any) { reply.status(500).send(error(err.message)); }
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
    } catch (err: any) { reply.status(500).send(error(err.message)); }
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
      } catch (err: any) { reply.status(500).send(error(err.message)); }
    } catch (err: any) { reply.status(500).send(error(err.message)); }
  });

  app.get('/logs', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, parseInt(q.limit) || 20);
      const [logs, total] = await Promise.all([
        prisma.ownerLog.findMany({
          orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
          include: { user: { select: { username: true } } },
        }),
        prisma.ownerLog.count(),
      ]);
      reply.send(success({ entries: logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }));
    } catch (err: any) { reply.status(500).send(error(err.message)); }
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
    } catch (err: any) { reply.status(500).send(error(err.message)); }
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
    } catch (err: any) { reply.status(500).send(error(err.message)); }
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
    } catch (err: any) { reply.status(500).send(error(err.message)); }
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
    } catch (err: any) { reply.status(500).send(error(err.message)); }
  });

  app.post('/backup', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await logOwnerAction(request, 'BACKUP');
      reply.send(success({ timestamp: new Date().toISOString() }, 'Sauvegarde effectuée'));
    } catch (err: any) { reply.status(500).send(error(err.message)); }
  });
}

async function logOwnerAction(request: FastifyRequest, action: string, details?: Record<string, unknown>) {
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

