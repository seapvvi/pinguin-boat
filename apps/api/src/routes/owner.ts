import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Prisma, prisma } from '@pinguin/db';
import { getConfig } from '@pinguin/config';
import { authenticate } from '../middleware/auth';
import { requireOwner, requireOwnerDiscordId } from '../middleware/owner';
import { validateBody } from '../middleware/validate';
import { success, error, sanitizeError } from '../utils/response';
import { toCsv } from '../utils/toCsv';
import { getSystemMetrics, getGlobalStats } from '../services/metrics';
import * as TwoFA from '../services/owner2fa';
import { verifyOwnerPassword, ensureOwnerPasswordHash } from '../services/ownerPassword';
import { AppServiceKey } from '../services/system';
import { get, set, invalidateCache } from '../utils/cache';
import * as SystemService from '../services/system';
import * as DeployService from '../services/deploy';
import { eventBus } from '../services/eventBus';
import { sendOwnerAlert } from '../services/discordWebhook';

const config = getConfig();
if (!config.OWNER_PASSWORD) {
  console.warn('[OWNER] OWNER_PASSWORD non configuré — la page owner dashboard sera inaccessible.');
}
const ownerPre = { preHandler: [authenticate, requireOwner] };
const ownerBasePre = [authenticate, requireOwnerDiscordId];
const VERIFY_PASSWORD_RATE = { max: 5, timeWindow: '1 minute' };
const TFA_RATE = { max: 5, timeWindow: '1 minute' };
const OWNER_RATE = { max: 30, timeWindow: '1 minute' };
const ANNOUNCEMENT_RATE = { max: 1, timeWindow: '10 minutes' };

export async function ownerRoutes(app: FastifyInstance) {
  const verifyPasswordSchema = z.object({
    password: z.string().trim().min(1),
  });

  const blacklistUserSchema = z.object({
    targetId: z.string().min(1),
    reason: z.string().min(1),
  });

  const blacklistGuildSchema = z.object({
    targetId: z.string().min(1),
    reason: z.string().min(1),
  });

  const blacklistSchema = z.object({
    targetId: z.string().min(1),
    reason: z.string().min(1),
    targetType: z.string().optional(),
  });

  const premiumGrantSchema = z.object({
    userId: z.string().optional(),
    guildId: z.string().optional(),
    plan: z.string().min(1),
  });

  const premiumRevokeSchema = z.object({
    userId: z.string().optional(),
    guildId: z.string().optional(),
  });

  const announcementSchema = z.object({
    message: z.string().min(1).max(2000),
    embed: z.unknown().optional(),
  });

  const broadcastPopupSchema = z.object({
    message: z.string().min(1),
    duration: z.number().int().min(3).max(30).optional(),
    targetUserId: z.string().optional(),
  });

  const donorCreateSchema = z.object({
    userId: z.string().min(1),
    username: z.string().min(1),
    amount: z.coerce.number().optional(),
    avatarUrl: z.string().optional(),
    message: z.string().optional(),
    isPublic: z.boolean().optional(),
    embedColor: z.string().optional(),
  });

  const donorUpdateSchema = z.object({
    username: z.string().optional(),
    avatarUrl: z.string().nullable().optional(),
    amount: z.coerce.number().optional(),
    message: z.string().nullable().optional(),
    isPublic: z.boolean().optional(),
    embedColor: z.string().nullable().optional(),
  });

  const changelogCreateSchema = z.object({
    title: z.string().min(1),
    content: z.string().min(1),
    version: z.string().optional(),
    published: z.boolean().optional(),
    pinned: z.boolean().optional(),
  });

  const changelogUpdateSchema = z.object({
    title: z.string().optional(),
    content: z.string().optional(),
    version: z.string().nullable().optional(),
    published: z.boolean().optional(),
    pinned: z.boolean().optional(),
  });

  const featureFlagUpdateSchema = z.object({
    enabled: z.boolean().optional(),
  });

  const rollbackSchema = z.object({
    version: z.string().optional(),
  });

  const twoFACodeSchema = z.object({
    code: z.string().min(1),
  });

  const noteUpdateSchema = z.object({
    content: z.string().optional(),
  });

  app.post('/verify-password', {
    preHandler: [authenticate, requireOwnerDiscordId, validateBody(verifyPasswordSchema)],
    config: { rateLimit: VERIFY_PASSWORD_RATE },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!config.OWNER_PASSWORD) {
        reply.status(500).send({ success: false, message: 'Mot de passe owner non configuré.' });
        return;
      }
      const body = request.body as z.infer<typeof verifyPasswordSchema>;
      const valid = await verifyOwnerPassword(body.password);
      if (!valid) {
        await prisma.ownerLog.create({
          data: {
            userId: request.user!.id,
            action: 'VERIFY_PASSWORD_FAILED',
            details: JSON.stringify({ ip: request.ip }),
            ip: request.ip,
            userAgent: request.headers['user-agent'] || '',
            success: false,
          },
        });
        reply.status(401).send({ success: false, message: 'Mot de passe incorrect.' });
        return;
      }
      await prisma.session.update({
        where: { id: request.user!.sessionId },
        data: { ownerVerifiedAt: new Date() },
      });
      await prisma.ownerLog.create({
        data: {
          userId: request.user!.id,
          action: 'VERIFY_PASSWORD_SUCCESS',
          ip: request.ip,
          userAgent: request.headers['user-agent'] || '',
          success: true,
        },
      });
      const twoFA = await prisma.owner2FA.findUnique({ where: { userId: request.user!.id } });
      if (twoFA?.enabled) {
        reply.send({ success: true, data: { requires2FA: true } });
        return;
      }
      reply.send({ success: true });
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/status', {
    preHandler: ownerBasePre,
    config: { rateLimit: OWNER_RATE },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = await prisma.session.findUnique({ where: { id: request.user!.sessionId } });
      const twoFA = await prisma.owner2FA.findUnique({ where: { userId: request.user!.id } });
      reply.send(success({
        verified: !!session?.ownerVerifiedAt,
        twoFAEnabled: twoFA?.enabled ?? false,
        twoFAVerified: !!session?.owner2faVerifiedAt,
      }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.delete('/blacklist/:targetId', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { targetId } = request.params as { targetId: string };
      const q = request.query as Record<string, string | undefined>;
      const targetType = String(q.targetType ?? '').toUpperCase();
      if (targetType === 'GUILD') {
        await prisma.blacklistGuild.deleteMany({ where: { guildId: targetId } });
        await logOwnerAction(request, 'UNBLACKLIST_GUILD', { guildId: targetId });
        invalidateCache('owner:servers');
        return reply.send(success(null, 'Serveur retiré de la blacklist'));
      }
      if (targetType === 'USER') {
        await prisma.blacklistUser.deleteMany({ where: { targetId } });
        await logOwnerAction(request, 'UNBLACKLIST_USER', { targetId });
        invalidateCache('owner:users');
        return reply.send(success(null, 'Utilisateur retiré de la blacklist'));
      }
      const [u, g] = await Promise.all([
        prisma.blacklistUser.deleteMany({ where: { targetId } }),
        prisma.blacklistGuild.deleteMany({ where: { guildId: targetId } }),
      ]);
      if (!u.count && !g.count) return reply.status(404).send(error('Entrée introuvable'));
      await logOwnerAction(request, 'BLACKLIST_REMOVE', { targetId });
      invalidateCache('owner:servers');
      invalidateCache('owner:users');
      reply.send(success(null, 'Entrée retirée de la blacklist'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/stats', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const cached = get<object>('owner:stats');
      if (cached) return reply.send(success(cached));
      const stats = await getGlobalStats();
      const metrics = getSystemMetrics();
      const premiumRevenue = await prisma.premiumSubscription.count({ where: { status: 'ACTIVE' } });
      const data = { ...stats, premiumRevenue, ...metrics };
      set('owner:stats', data, 30);
      reply.send(success(data));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/servers', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as Record<string, string | undefined>;
      if (q.format === 'csv') {
        const servers = await prisma.guild.findMany({
          where: { botPresent: true },
          take: 10000,
          select: { id: true, name: true, memberCount: true, ownerId: true, createdAt: true },
        });
        const csv = toCsv(servers, [
          { key: 'id', label: 'ID' },
          { key: 'name', label: 'Nom' },
          { key: 'memberCount', label: 'Membres' },
          { key: 'ownerId', label: 'Propriétaire' },
          { key: 'createdAt', label: 'Créé le' },
        ]);
        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', 'attachment; filename="servers.csv"');
        reply.send(csv);
        return;
      }
      const page = Math.max(1, parseInt(q.page ?? '', 10) || 1);
      const limit = Math.min(100, parseInt(q.limit ?? '', 10) || 20);
      const search = String(q.search ?? '').trim();
      const sortBy = String(q.sortBy ?? 'memberCount');
      const sortOrder = String(q.sortOrder ?? 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
      const cursor = q.cursor || undefined;
      const cacheKey = cursor
        ? `owner:servers:cursor:${cursor}:${search}`
        : `owner:servers:${page}:${search}`;
      const cached = get<object>(cacheKey);
      if (cached) return reply.send(success(cached));
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
      const findArgs: Prisma.GuildFindManyArgs = {
        where,
        orderBy,
        take: limit,
        include: { _count: { select: { moderationCases: true, tickets: true } } },
      };
      if (cursor) {
        findArgs.cursor = { id: cursor };
        findArgs.skip = 1;
      } else {
        findArgs.skip = (page - 1) * limit;
      }
      const [servers, total] = await Promise.all([
        prisma.guild.findMany(findArgs),
        prisma.guild.count({ where }),
      ]);
      const blacklistedGuilds = new Set(
        (await prisma.blacklistGuild.findMany({
          where: { guildId: { in: servers.map((s) => s.id) } },
          select: { guildId: true },
        })).map((b) => b.guildId)
      );
      const ownerIds = [...new Set(servers.map((s) => s.ownerId).filter((id): id is string => id !== null))];
      const ownerUsers = await prisma.user.findMany({
        where: { discordId: { in: ownerIds } },
        select: { discordId: true, username: true },
      });
      const ownerMap = new Map(ownerUsers.map((u) => [u.discordId, u.username]));
      const payload = servers.map((s) => ({
        ...s,
        ownerName: s.ownerId ? (ownerMap.get(s.ownerId) ?? null) : null,
        botStatus: s.botPresent ? 'ONLINE' as const : 'OFFLINE' as const,
        blacklisted: blacklistedGuilds.has(s.id),
      }));
      const nextCursor = servers.length > 0 ? servers[servers.length - 1].id : null;
      const result = {
        servers: payload,
        pagination: {
          page, limit, total, totalPages: Math.ceil(total / limit),
          ...(nextCursor ? { nextCursor } : {}),
        },
      };
      set(cacheKey, result, 15);
      reply.send(success(result));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/users', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as Record<string, string | undefined>;
      if (q.format === 'csv') {
        const users = await prisma.user.findMany({
          take: 10000,
          select: { id: true, username: true, discordId: true, createdAt: true },
        });
        const csv = toCsv(users, [
          { key: 'id', label: 'ID' },
          { key: 'username', label: 'Nom d\'utilisateur' },
          { key: 'discordId', label: 'Discord ID' },
          { key: 'createdAt', label: 'Créé le' },
        ]);
        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', 'attachment; filename="users.csv"');
        reply.send(csv);
        return;
      }
      const page = Math.max(1, parseInt(q.page ?? '', 10) || 1);
      const limit = Math.min(100, parseInt(q.limit ?? '', 10) || 20);
      const search = String(q.search ?? '').trim();
      const sortBy = String(q.sortBy ?? 'createdAt');
      const sortOrder = String(q.sortOrder ?? 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
      const cursor = q.cursor || undefined;
      const cacheKey = cursor
        ? `owner:users:cursor:${cursor}:${search}`
        : `owner:users:${page}:${search}`;
      const cached = get<object>(cacheKey);
      if (cached) return reply.send(success(cached));
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
      const findArgs: Prisma.UserFindManyArgs = {
        where,
        orderBy,
        take: limit,
        include: { _count: { select: { sessions: true } } },
      };
      if (cursor) {
        findArgs.cursor = { id: cursor };
        findArgs.skip = 1;
      } else {
        findArgs.skip = (page - 1) * limit;
      }
      const [users, total] = await Promise.all([
        prisma.user.findMany(findArgs),
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
      const nextCursor = users.length > 0 ? users[users.length - 1].id : null;
      const result = {
        users: payload,
        pagination: {
          page, limit, total, totalPages: Math.ceil(total / limit),
          ...(nextCursor ? { nextCursor } : {}),
        },
      };
      set(cacheKey, result, 15);
      reply.send(success(result));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/blacklist/users', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(q.page ?? '', 10) || 1);
      const limit = Math.min(100, parseInt(q.limit ?? '', 10) || 20);
      const [entries, total] = await Promise.all([
        prisma.blacklistUser.findMany({
          orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        }),
        prisma.blacklistUser.count(),
      ]);
      reply.send(success({ entries, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/blacklist/users', { preHandler: [authenticate, requireOwner, validateBody(blacklistUserSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as z.infer<typeof blacklistUserSchema>;
      const existing = await prisma.blacklistUser.findUnique({ where: { targetId: body.targetId } });
      if (existing) return reply.status(409).send(error('Utilisateur déjà blacklisté'));
      const entry = await prisma.blacklistUser.create({
        data: { targetId: body.targetId, reason: body.reason, moderatorId: request.user!.id },
      });
      await prisma.session.deleteMany({
        where: { user: { discordId: body.targetId } },
      });
      await logOwnerAction(request, 'BLACKLIST_USER', { targetId: body.targetId, reason: body.reason });
      invalidateCache('owner:users');
      reply.status(201).send(success(entry, 'Utilisateur blacklisté'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.delete('/blacklist/users/:targetId', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { targetId } = request.params as { targetId: string };
      const entry = await prisma.blacklistUser.findUnique({ where: { targetId } });
      if (!entry) return reply.status(404).send(error('Entrée introuvable'));
      await prisma.blacklistUser.delete({ where: { targetId } });
      await logOwnerAction(request, 'UNBLACKLIST_USER', { targetId });
      invalidateCache('owner:users');
      reply.send(success(null, 'Utilisateur retiré de la blacklist'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/blacklist/guilds', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(q.page ?? '', 10) || 1);
      const limit = Math.min(100, parseInt(q.limit ?? '', 10) || 20);
      const [entries, total] = await Promise.all([
        prisma.blacklistGuild.findMany({
          orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
          include: { guild: { select: { name: true } } },
        }),
        prisma.blacklistGuild.count(),
      ]);
      reply.send(success({ entries, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/blacklist/guilds', { preHandler: [authenticate, requireOwner, validateBody(blacklistGuildSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as z.infer<typeof blacklistGuildSchema>;
      const existing = await prisma.blacklistGuild.findUnique({ where: { guildId: body.targetId } });
      if (existing) return reply.status(409).send(error('Serveur déjà blacklisté'));
      const entry = await prisma.blacklistGuild.create({
        data: { guildId: body.targetId, reason: body.reason, moderatorId: request.user!.id },
      });
      await logOwnerAction(request, 'BLACKLIST_GUILD', { guildId: body.targetId, reason: body.reason });
      invalidateCache('owner:servers');
      reply.status(201).send(success(entry, 'Serveur blacklisté'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.delete('/blacklist/guilds/:guildId', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const entry = await prisma.blacklistGuild.findUnique({ where: { guildId } });
      if (!entry) return reply.status(404).send(error('Entrée introuvable'));
      await prisma.blacklistGuild.delete({ where: { guildId } });
      await logOwnerAction(request, 'UNBLACKLIST_GUILD', { guildId });
      invalidateCache('owner:servers');
      reply.send(success(null, 'Serveur retiré de la blacklist'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/force-leave/:guildId', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const guild = await prisma.guild.findUnique({ where: { id: guildId } });
      if (!guild) return reply.status(404).send(error('Serveur introuvable'));
      
      // Discord API does not allow bots to leave servers via API (403 Forbidden)
      // The bot must be removed manually by an admin or the owner
      // We can only mark the bot as not present in our database
      await prisma.guild.update({ where: { id: guildId }, data: { botPresent: false } });
      await logOwnerAction(request, 'FORCE_LEAVE_MARK', { guildId, guildName: guild.name });
      reply.send(success(null, `Serveur marqué comme quitté. Le bot n'est plus sur ${guild.name}. Pour retirer complètement le bot, demandez à un administrateur du serveur de le retirer manuellement ou utilisez la commande /kick dans le serveur.`));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/metrics', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const cached = get<object>('owner:metrics');
      if (cached) return reply.send(success(cached));
      const metrics = getSystemMetrics();
      const os = await import('os');
      const cpus = os.cpus();
      const networkInterfaces = os.networkInterfaces();
      const data = {
        ...metrics,
        cpuCores: cpus.length,
        cpuModel: cpus[0]?.model || 'unknown',
        hostname: os.hostname(),
        networkInterfaces: Object.keys(networkInterfaces).reduce((acc: Record<string, { address: string; family: string }[]>, key: string) => {
          acc[key] = networkInterfaces[key]?.map((i: { address: string; family: string }) => ({ address: i.address, family: i.family })) || [];
          return acc;
        }, {}),
        disk: await (async () => {
          try {
            const fs = await import('fs');
            const stats = await fs.promises.statfs('/');
            return { total: stats.blocks * stats.bsize, free: stats.bfree * stats.bsize };
          } catch { return { free: 0, total: 0 }; }
        })(),
      };
      set('owner:metrics', data, 10);
      reply.send(success(data));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/services', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const services = SystemService.listServices();
      reply.send(success({ services }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.post('/services/:service/:action', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { service, action } = request.params as { service: string; action: string };
      const validServices = ['bot', 'api', 'web'];
      const validActions = ['start', 'stop', 'restart'];
      if (!validServices.includes(service)) {
        return reply.status(400).send(error(`Service invalide. Valides: ${validServices.join(', ')}`));
      }
      if (!validActions.includes(action)) {
        return reply.status(400).send(error(`Action invalide. Valides: ${validActions.join(', ')}`));
      }

      const svc = service as AppServiceKey;
      if (action === 'stop') {
        SystemService.stopService(svc);
      } else if (action === 'start') {
        SystemService.startService(svc);
      } else if (action === 'restart') {
        const detached = service === 'api';
        if (detached) {
          reply.send(success({ service, action, status: 'restarting' }, `Redémarrage de ${service} initié`));
          setImmediate(() => SystemService.restartService(svc, true));
          await logOwnerAction(request, 'SERVICE_RESTART', { service });
          return;
        }
        SystemService.restartService(svc);
      }

      await logOwnerAction(request, `SERVICE_${action.toUpperCase()}`, { service });
      reply.send(success({ service, action, status: 'ok' }, `Service ${service} ${action}é avec succès`));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err) || 'Erreur d’action service'));
    }
  });

  app.post('/services/restart/:service', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { service } = request.params as { service: string };
      const validServices = ['bot', 'api', 'web'] as const;
      if (!validServices.includes(service as typeof validServices[number]))
        return reply.status(400).send(error(`Service invalide. Valides: ${validServices.join(', ')}`));
      const svc = service as AppServiceKey;
      const detached = service === 'api';
      if (detached) {
        reply.send(success({ service, status: 'restarting' }, `Redémarrage de ${service} initié`));
        setImmediate(() => SystemService.restartService(svc, true));
        await logOwnerAction(request, 'SERVICE_RESTART', { service });
        return;
      }
      SystemService.restartService(svc);
      await logOwnerAction(request, 'SERVICE_RESTART', { service });
      reply.send(success({ service, status: 'restarting' }, `Redémarrage de ${service} initié`));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/services/restart-all', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await logOwnerAction(request, 'SERVICE_RESTART_ALL', { services: ['bot', 'api', 'web'] });
      reply.send(success({ services: ['bot', 'api', 'web'], status: 'restarting' }, 'Redémarrage de tous les services initié'));
      setImmediate(() => SystemService.restartAllServices(true));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/errors', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const errorLogs = await prisma.ownerLog.findMany({
        where: { success: false },
        orderBy: { createdAt: 'desc' }, take: 50,
        include: { user: { select: { username: true } } },
      });
      reply.send(success({ errorLogs }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/changelogs', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(q.page ?? '', 10) || 1);
      const limit = Math.min(50, parseInt(q.limit ?? '', 10) || 10);
      const [entries, total] = await Promise.all([
        prisma.changelog.findMany({
          orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
          include: { author: { select: { username: true } } },
        }),
        prisma.changelog.count(),
      ]);
      reply.send(success({ entries, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/changelogs', { preHandler: [authenticate, requireOwner, validateBody(changelogCreateSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as z.infer<typeof changelogCreateSchema>;
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
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.patch('/changelogs/:id', { preHandler: [authenticate, requireOwner, validateBody(changelogUpdateSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof changelogUpdateSchema>;
      const existing = await prisma.changelog.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send(error('Changelog introuvable'));
      const updated = await prisma.changelog.update({
        where: { id },
        data: {
          title: body.title ?? existing.title,
          content: body.content ?? existing.content,
          version: body.version !== undefined ? body.version : existing.version,
          published: body.published !== undefined ? body.published : existing.published,
          pinned: body.pinned !== undefined ? body.pinned : existing.pinned,
        },
      });
      reply.send(success(updated, 'Changelog mis à jour'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.delete('/changelogs/:id', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const existing = await prisma.changelog.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send(error('Changelog introuvable'));
      await prisma.changelog.delete({ where: { id } });
      reply.send(success(null, 'Changelog supprimé'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/premium/alpha', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const current = config.ALPHA_ALL_FREE;
      const newVal = !current;
      await prisma.featureFlag.upsert({
        where: { key: 'ALPHA_ALL_FREE' },
        update: { enabled: newVal },
        create: { key: 'ALPHA_ALL_FREE', name: 'Alpha All Free', enabled: newVal },
      });
      config.ALPHA_ALL_FREE = newVal;
      reply.send(success({ alphaAllFree: newVal }, `Mode alpha passé à ${newVal}`));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/premium/grant', { preHandler: [authenticate, requireOwner, validateBody(premiumGrantSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as z.infer<typeof premiumGrantSchema>;
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
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/premium/revoke', { preHandler: [authenticate, requireOwner, validateBody(premiumRevokeSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as z.infer<typeof premiumRevokeSchema>;
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
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/feature-flags', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const flags = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
      reply.send(success({ flags }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/feature-flags/:key', { preHandler: [authenticate, requireOwner, validateBody(featureFlagUpdateSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { key } = request.params as { key: string };
      const body = request.body as z.infer<typeof featureFlagUpdateSchema>;
      const flag = await prisma.featureFlag.upsert({
        where: { key },
        update: { enabled: body.enabled ?? false },
        create: { key, name: key, enabled: body.enabled ?? false },
      });
      reply.send(success(flag, 'Feature flag mis à jour'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/announcement', {
    preHandler: [authenticate, requireOwner, validateBody(announcementSchema)],
    config: { rateLimit: ANNOUNCEMENT_RATE },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as z.infer<typeof announcementSchema>;
      const announcementChannel = 'announcements';
      try {
        const guilds = await prisma.guild.findMany({ where: { botPresent: true }, select: { id: true } });
        let sent = 0;
        for (const guild of guilds) {
          try {
            interface DiscordChannel { id: string; name: string; type: number; }
            const channels = await (await fetch(
              `https://discord.com/api/v10/guilds/${guild.id}/channels`,
              { headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` } }
            )).json() as DiscordChannel[];
            const target = channels.find((c: DiscordChannel) => c.name === announcementChannel && c.type === 0);
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
      } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/logs', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as Record<string, string | undefined>;
      if (q.format === 'csv') {
        const logs = await prisma.ownerLog.findMany({
          take: 10000,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { username: true } } },
        });
        const rows = logs.map((l) => ({
          createdAt: l.createdAt,
          action: l.action,
          username: l.user?.username ?? 'Système',
          ip: l.ip,
          details: l.details ?? '',
        }));
        const csv = toCsv(rows, [
          { key: 'createdAt', label: 'Date' },
          { key: 'action', label: 'Action' },
          { key: 'username', label: 'Utilisateur' },
          { key: 'ip', label: 'IP' },
          { key: 'details', label: 'Détails' },
        ]);
        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', 'attachment; filename="logs.csv"');
        reply.send(csv);
        return;
      }
      const page = Math.max(1, parseInt(q.page ?? '', 10) || 1);
      const limit = Math.min(100, parseInt(q.limit ?? '', 10) || 20);
      const where: Prisma.OwnerLogWhereInput = {};
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
                { action: 'GET_OWNER_LOGS' },
                { details: { contains: '"method":"GET"' } },
                { details: { contains: '"method": "GET"' } },
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
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  // --- Donors ---
  app.get('/donors', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const donors = await prisma.donor.findMany({ orderBy: { donatedAt: 'desc' } });
      reply.send(success({ donors }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/donors/public', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const donors = await prisma.donor.findMany({
        where: { isPublic: true },
        orderBy: { amount: 'desc' },
        take: 50,
      });
      reply.send(success({ donors }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/donors', { preHandler: [authenticate, requireOwner, validateBody(donorCreateSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as z.infer<typeof donorCreateSchema>;
      const amount = body.amount ?? 0;
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
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.patch('/donors/:id', { preHandler: [authenticate, requireOwner, validateBody(donorUpdateSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof donorUpdateSchema>;
      const existing = await prisma.donor.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send(error('Donateur introuvable'));
      const amount = body.amount !== undefined ? body.amount : existing.amount;
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
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.delete('/donors/:id', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const donor = await prisma.donor.findFirst({ where: { OR: [{ id }, { userId: id }] } });
      if (!donor) return reply.status(404).send(error('Donateur introuvable'));
      await prisma.donor.delete({ where: { id: donor.id } });
      await logOwnerAction(request, 'DONOR_DELETE', { id });
      reply.send(success(null, 'Donateur supprimé'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  // Path aliases for web client
  app.get('/blacklist', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(q.page ?? '', 10) || 1);
      const limit = Math.min(100, parseInt(q.limit ?? '', 10) || 20);
      const [users, guilds, totalUsers, totalGuilds] = await Promise.all([
        prisma.blacklistUser.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
        prisma.blacklistGuild.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, include: { guild: { select: { name: true } } } }),
        prisma.blacklistUser.count(),
        prisma.blacklistGuild.count(),
      ]);
      const entries = [
        ...users.map((u) => ({ ...u, targetType: 'USER' as const, targetName: u.targetId })),
        ...guilds.map((g) => ({ id: g.id, targetId: g.guildId, reason: g.reason, moderatorId: g.moderatorId, createdAt: g.createdAt, targetType: 'GUILD' as const, targetName: g.guild?.name ?? g.guildId })),
      ];
      const total = totalUsers + totalGuilds;
      reply.send(success({ entries, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });


  app.get('/servers/:guildId', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
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
      const owner = guild.ownerId ? await prisma.user.findUnique({
        where: { discordId: guild.ownerId },
        select: { username: true, discordId: true },
      }) : null;
      reply.send(success({
        ...guild,
        ownerName: owner?.username ?? null,
        ownerId: owner?.discordId ?? guild.ownerId,
        blacklisted: !!blacklist,
        blacklistReason: blacklist?.reason ?? null,
      }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/users/:targetId', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { targetId } = request.params as { targetId: string };
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
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });
  app.post('/blacklist', { preHandler: [authenticate, requireOwner, validateBody(blacklistSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as z.infer<typeof blacklistSchema>;

      if (body.targetType === 'GUILD') {
        const existing = await prisma.blacklistGuild.findUnique({ where: { guildId: body.targetId } });
        if (existing) return reply.status(409).send(error('Serveur déjà blacklisté'));
        const entry = await prisma.blacklistGuild.create({
          data: { guildId: body.targetId, reason: body.reason, moderatorId: request.user!.id },
        });
        await logOwnerAction(request, 'BLACKLIST_GUILD', { guildId: body.targetId });
        invalidateCache('owner:servers');
        return reply.status(201).send(success(entry));
      }
      const existing = await prisma.blacklistUser.findUnique({ where: { targetId: body.targetId } });
      if (existing) return reply.status(409).send(error('Déjà blacklisté'));
      const entry = await prisma.blacklistUser.create({
        data: { targetId: body.targetId, reason: body.reason, moderatorId: request.user!.id },
      });
      await prisma.session.deleteMany({ where: { user: { discordId: body.targetId } } });
      await logOwnerAction(request, 'BLACKLIST_USER', { targetId: body.targetId });
      invalidateCache('owner:users');
      reply.status(201).send(success(entry));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/servers/:guildId/force-leave', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const guild = await prisma.guild.findUnique({ where: { id: guildId } });
      if (!guild) return reply.status(404).send(error('Serveur introuvable'));
      try {
        const { leaveGuildViaBot } = await import('../services/bot-proxy');
        await leaveGuildViaBot(guildId);
      } catch (err: unknown) {
        return reply.status(500).send(error(sanitizeError(err)));
      }
      await prisma.guild.update({ where: { id: guildId }, data: { botPresent: false } });
      await logOwnerAction(request, 'FORCE_LEAVE', { guildId });
      reply.send(success(null, 'Bot retiré'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  
;

  app.post('/alpha-mode', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const newVal = !config.ALPHA_ALL_FREE;
      await prisma.featureFlag.upsert({
        where: { key: 'ALPHA_ALL_FREE' },
        update: { enabled: newVal },
        create: { key: 'ALPHA_ALL_FREE', name: 'Alpha All Free', enabled: newVal },
      });
      config.ALPHA_ALL_FREE = newVal;
      reply.send(success({ alphaAllFree: newVal }, 'Mode alpha basculé'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/restart', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    await logOwnerAction(request, 'RESTART', {});
    reply.send(success(null, 'Redémarrage en cours...'));
    setImmediate(() => SystemService.restartAllServices(true));
  });

  app.post('/rollback', { preHandler: [authenticate, requireOwner, validateBody(rollbackSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as z.infer<typeof rollbackSchema>;
      await DeployService.rollback(request.user!.id, body?.version);
      await logOwnerAction(request, 'ROLLBACK', { version: body?.version || 'previous' });
      reply.send(success(null, 'Rollback effectué — services redémarrés'));
      setImmediate(() => SystemService.restartAllServices(true));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  async function requireOwnerVerified(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const session = await prisma.session.findUnique({ where: { id: request.user!.sessionId } });
    if (!session?.ownerVerifiedAt) {
      reply.status(401).send({ success: false, error: 'Veuillez d\'abord vérifier le mot de passe propriétaire', data: { requiresPassword: true } });
      return;
    }
  }

  app.post('/2fa/setup', {
    preHandler: [authenticate, requireOwnerDiscordId, requireOwnerVerified],
    config: { rateLimit: TFA_RATE },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const secret = TwoFA.generateSecret();
      const qrCode = await TwoFA.generateQRCode(secret.base32);
      await prisma.owner2FA.upsert({
        where: { userId: request.user!.id },
        update: { secret: secret.base32, enabled: false, verified: false },
        create: { userId: request.user!.id, secret: secret.base32, enabled: false, verified: false },
      });
      reply.send(success({ secret: secret.base32, qrCode }, '2FA configuré, veuillez vérifier'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/2fa/verify', {
    preHandler: [authenticate, requireOwnerDiscordId, requireOwnerVerified, validateBody(twoFACodeSchema)],
    config: { rateLimit: TFA_RATE },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as z.infer<typeof twoFACodeSchema>;
      const twoFA = await prisma.owner2FA.findUnique({ where: { userId: request.user!.id } });
      if (!twoFA) return reply.status(400).send(error('2FA non configuré'));
      const valid = TwoFA.verifyToken(twoFA.secret, body.code);
      if (!valid) return reply.status(400).send(error('Code invalide'));
      await prisma.$transaction([
        prisma.owner2FA.update({
          where: { userId: request.user!.id },
          data: { enabled: true, verified: true, lastVerifiedAt: new Date() },
        }),
        prisma.session.update({
          where: { id: request.user!.sessionId },
          data: { owner2faVerifiedAt: new Date() },
        }),
      ]);
      reply.send(success(null, '2FA vérifié et activé'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/2fa/disable', {
    preHandler: [authenticate, requireOwnerDiscordId, requireOwnerVerified, validateBody(twoFACodeSchema)],
    config: { rateLimit: TFA_RATE },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as z.infer<typeof twoFACodeSchema>;
      const twoFA = await prisma.owner2FA.findUnique({ where: { userId: request.user!.id } });
      if (!twoFA) return reply.status(400).send(error('2FA non configuré'));
      const valid = TwoFA.verifyToken(twoFA.secret, body.code);
      if (!valid) return reply.status(400).send(error('Code invalide'));
      await prisma.$transaction([
        prisma.owner2FA.update({
          where: { userId: request.user!.id },
          data: { enabled: false, verified: false },
        }),
        prisma.session.update({
          where: { id: request.user!.sessionId },
          data: { owner2faVerifiedAt: null },
        }),
      ]);
      reply.send(success(null, '2FA désactivé'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/deployments', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(q.page ?? '', 10) || 1);
      const limit = Math.min(50, parseInt(q.limit ?? '', 10) || 10);
      const [deployments, total] = await Promise.all([
        prisma.deployment.findMany({
          orderBy: { startedAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        }),
        prisma.deployment.count(),
      ]);
      reply.send(success({ deployments, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/backup', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const fs = await import('fs');
      const backupPath = '/tmp/backup_latest.sql';
      if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
      const dbUrl = process.env.DATABASE_URL || '';
      const { execFile } = await import('child_process');
      await new Promise<void>((resolve, reject) => {
        const child = execFile('pg_dump', [dbUrl], { timeout: 30000 });
        const writeStream = fs.createWriteStream(backupPath);
        child.stdout!.pipe(writeStream);
        child.on('error', reject);
        child.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`pg_dump a échoué avec le code ${code}`));
        });
      });
      await logOwnerAction(request, 'BACKUP_CREATED', { path: backupPath });
      reply.send(success({ path: backupPath, timestamp: new Date().toISOString() }, 'Sauvegarde effectuée'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/backup/download', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    const fs = await import('fs');
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
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.delete('/sessions/:sessionId', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { sessionId } = request.params as { sessionId: string };
      await prisma.session.delete({ where: { id: sessionId } });
      await logOwnerAction(request, 'KICK_SESSION', { sessionId });
      reply.send(success(null, 'Session révoquée'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  // --- SSE events ---
  app.get('/events', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const listener = (data: Record<string, unknown>) => {
      if (data.targetUserId && data.targetUserId !== request.user?.id) return;
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    eventBus.on('popup', listener);

    request.raw.on('close', () => {
      eventBus.off('popup', listener);
    });
  });

  // --- Broadcast popup custom ---
  app.post('/broadcast-popup', { preHandler: [authenticate, requireOwner, validateBody(broadcastPopupSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as z.infer<typeof broadcastPopupSchema>;
      const duration = Math.max(3, Math.min(30, body.duration ?? 5));
      const now = new Date();
      await prisma.pendingPopup.create({
        data: {
          targetUserId: body.targetUserId ?? null,
          message: body.message.trim(),
          duration,
          expiresAt: new Date(now.getTime() + 60_000),
        },
      });
      eventBus.emit('popup', {
        message: body.message.trim(),
        duration,
        targetUserId: body.targetUserId ?? null,
        createdAt: now.getTime(),
      });
      await logOwnerAction(request, 'BROADCAST_POPUP', { message: body.message.trim(), targetUserId: body.targetUserId ?? 'all' });
      reply.send(success(null, 'Popup envoyé'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/broadcast-popup/poll', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Nettoie les entrées expirées
      await prisma.pendingPopup.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });

      const discordId = request.user?.id;
      if (!discordId) {
        reply.send(success({ popup: null }));
        return;
      }

      // Cherche une popup ciblée pour cet utilisateur
      const userPopup = await prisma.pendingPopup.findFirst({
        where: { targetUserId: discordId, expiresAt: { gt: new Date() } },
      });

      if (userPopup) {
        await prisma.pendingPopup.delete({ where: { id: userPopup.id } });
        reply.send(success({
          popup: {
            message: userPopup.message,
            duration: userPopup.duration,
            createdAt: userPopup.createdAt.getTime(),
          },
        }));
        return;
      }

      // Cherche une popup globale
      const globalPopup = await prisma.pendingPopup.findFirst({
        where: { targetUserId: null, expiresAt: { gt: new Date() } },
      });

      if (globalPopup) {
        reply.send(success({
          popup: {
            message: globalPopup.message,
            duration: globalPopup.duration,
            createdAt: globalPopup.createdAt.getTime(),
          },
        }));
      } else {
        reply.send(success({ popup: null }));
      }
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  // --- Notes internes ---
  app.get('/notes', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      let note = await prisma.ownerNote.findFirst();
      if (!note) note = await prisma.ownerNote.create({ data: { content: '' } });
      reply.send(success({ content: note.content, updatedAt: note.updatedAt }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.patch('/notes', { preHandler: [authenticate, requireOwner, validateBody(noteUpdateSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as z.infer<typeof noteUpdateSchema>;
      let note = await prisma.ownerNote.findFirst();
      if (note) {
        note = await prisma.ownerNote.update({ where: { id: note.id }, data: { content: body.content ?? '' } });
      } else {
        note = await prisma.ownerNote.create({ data: { content: body.content ?? '' } });
      }
      reply.send(success({ content: note.content, updatedAt: note.updatedAt }, 'Notes sauvegardées'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  // --- Maintenance planifiée ---
  const maintenanceCreateSchema = z.object({
    message: z.string().min(1),
    startsAt: z.string().min(1),
    endsAt: z.string().min(1),
  });

  const maintenanceUpdateSchema = z.object({
    message: z.string().optional(),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
    active: z.boolean().optional(),
  });

  app.get('/maintenance', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const windows = await prisma.maintenanceWindow.findMany({
        orderBy: { startsAt: 'desc' },
      });
      reply.send(success({ windows }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/maintenance', { preHandler: [authenticate, requireOwner, validateBody(maintenanceCreateSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as z.infer<typeof maintenanceCreateSchema>;
      const window = await prisma.maintenanceWindow.create({
        data: {
          message: body.message,
          startsAt: new Date(body.startsAt),
          endsAt: new Date(body.endsAt),
        },
      });
      await logOwnerAction(request, 'MAINTENANCE_CREATE', { id: window.id, message: body.message });
      reply.status(201).send(success(window, 'Fenêtre de maintenance créée'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.patch('/maintenance/:id', { preHandler: [authenticate, requireOwner, validateBody(maintenanceUpdateSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as z.infer<typeof maintenanceUpdateSchema>;
      const existing = await prisma.maintenanceWindow.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send(error('Fenêtre introuvable'));
      const updated = await prisma.maintenanceWindow.update({
        where: { id },
        data: {
          ...(body.message !== undefined ? { message: body.message } : {}),
          ...(body.startsAt !== undefined ? { startsAt: new Date(body.startsAt) } : {}),
          ...(body.endsAt !== undefined ? { endsAt: new Date(body.endsAt) } : {}),
          ...(body.active !== undefined ? { active: body.active } : {}),
        },
      });
      await logOwnerAction(request, 'MAINTENANCE_UPDATE', { id, ...body });
      reply.send(success(updated, 'Fenêtre de maintenance mise à jour'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.delete('/maintenance/:id', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const existing = await prisma.maintenanceWindow.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send(error('Fenêtre introuvable'));
      await prisma.maintenanceWindow.delete({ where: { id } });
      await logOwnerAction(request, 'MAINTENANCE_DELETE', { id });
      reply.send(success(null, 'Fenêtre de maintenance supprimée'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });
}

async function logOwnerAction(
  request: FastifyRequest,
  action: string,
  details?: Record<string, unknown>
) {
  if (request.method === 'GET' || request.url.includes('/owner/logs')) return;
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

  const criticalActions = ['RESTART', 'ROLLBACK', 'BLACKLIST_USER', 'BLACKLIST_GUILD', 'SERVICE_RESTART'];
  if (criticalActions.includes(action)) {
    sendOwnerAlert(action, { ...details, userId: request.user!.id });
  }
}

