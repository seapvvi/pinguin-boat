import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@pinguin/db';
import { getConfig } from '@pinguin/config';
import { authenticate } from '../../middleware/auth';
import { requireGuildAdmin } from '../../middleware/guild-auth';
import { validateParams } from '../../middleware/validate';
import { success, error, sanitizeError } from '../../utils/response';
import { guildIdSchema, ensureUser, transformAutoroleSettings } from '../../utils/guild-helpers';
import { getGuildMember, getGuildRoles } from '../../services/discord';

const guildParam = { preHandler: [authenticate, validateParams(guildIdSchema)] };
const config = getConfig();

export async function membersRoutes(app: FastifyInstance) {
  app.get('/my-permissions', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const discordId = request.user!.discordId;
      const member = await getGuildMember(guildId, discordId).catch(() => null);
      if (!member) return reply.status(403).send(error('Membre introuvable dans ce serveur'));
      const roles = await getGuildRoles(guildId).catch(() => [] as Array<{ id: string; permissions?: string }>);
      const guild = await prisma.guild.findUnique({ where: { id: guildId }, include: { settings: true } });
      const memberRoleIds: string[] = Array.isArray(member.roles) ? member.roles : [];
      let permissions = BigInt(0);
      for (const role of roles) {
        if (memberRoleIds.includes(role.id)) {
          permissions |= BigInt(role.permissions ?? 0);
        }
      }
      const isOwner = guild?.ownerId && guild.ownerId !== 'unknown' && guild.ownerId === discordId;
      if (isOwner) permissions = BigInt('9007199254740991');
      const ADMINISTRATOR = BigInt(0x8);
      const MANAGE_GUILD = BigInt(0x20);
      const MANAGE_ROLES = BigInt(0x10000000);
      const MANAGE_MESSAGES = BigInt(0x2000);
      const isAdmin = (permissions & ADMINISTRATOR) !== BigInt(0);

      const settings = guild?.settings;
      const dashboardAccessRoles = settings ? JSON.parse(settings.dashboardAccessRoles || '[]') : [];
      const hasDashboardAccess = isOwner || isAdmin || dashboardAccessRoles.some((r: string) => memberRoleIds.includes(r));

      const hasAccess = (accessField: string) => {
        if (isOwner || isAdmin) return true;
        const accessRoles = settings ? JSON.parse((settings as unknown as Record<string, string>)[accessField] || '[]') : [];
        return accessRoles.some((r: string) => memberRoleIds.includes(r));
      };

      reply.send(success({
        isOwner,
        isAdmin,
        hasDashboardAccess,
        permissions: permissions.toString(),
        can: {
          manageGuild: isAdmin || (permissions & MANAGE_GUILD) !== BigInt(0),
          manageRoles: isAdmin || (permissions & MANAGE_ROLES) !== BigInt(0),
          manageMessages: isAdmin || (permissions & MANAGE_MESSAGES) !== BigInt(0),
        },
        dashboard: {
          moderation: hasAccess('dashboardModerationAccess'),
          tickets: hasAccess('dashboardTicketsAccess'),
          polls: hasAccess('dashboardPollsAccess'),
          suggestions: hasAccess('dashboardSuggestionsAccess'),
          giveaways: hasAccess('dashboardGiveawaysAccess'),
          economy: hasAccess('dashboardEconomyAccess'),
          music: hasAccess('dashboardMusicAccess'),
          levels: hasAccess('dashboardLevelsAccess'),
          welcome: hasAccess('dashboardWelcomeAccess'),
          autoroles: hasAccess('dashboardAutorolesAccess'),
          logs: hasAccess('dashboardLogsAccess'),
          protection: hasAccess('dashboardProtectionAccess'),
          audit: hasAccess('dashboardAuditAccess'),
        },
      }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/blacklist', { preHandler: [authenticate, requireGuildAdmin, validateParams(guildIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '20', 10) || 20));
      const where: Record<string, unknown> = { guildId };
      if (q.search) {
        where.userId = { contains: q.search };
      }
      const [entries, total] = await Promise.all([
        prisma.guildBlacklistUser.findMany({
          where, orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
        }),
        prisma.guildBlacklistUser.count({ where }),
      ]);
      reply.send(success({
        entries,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.post('/blacklist', { preHandler: [authenticate, requireGuildAdmin] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;
      if (!body.userId || !body.reason) {
        return reply.status(400).send(error('ID utilisateur et raison requis'));
      }
      const existing = await prisma.guildBlacklistUser.findUnique({
        where: { guildId_userId: { guildId, userId: body.userId as string } },
      });
      if (existing) {
        return reply.status(400).send(error('Utilisateur déjà blacklisté'));
      }
      const entry = await prisma.guildBlacklistUser.create({
        data: {
          guildId,
          userId: body.userId as string,
          reason: body.reason as string,
          moderatorId: request.user!.discordId,
        },
      });
      await prisma.auditLog.create({
        data: {
          guildId,
          action: 'BLACKLIST_ADD',
          userId: request.user!.id,
          details: JSON.stringify({ targetUserId: body.userId, reason: body.reason }),
        },
      }).catch(() => {});
      reply.status(201).send(success(entry, 'Utilisateur ajouté à la blacklist'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.delete('/blacklist/:userId', { preHandler: [authenticate, requireGuildAdmin] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, userId } = request.params as { guildId: string; userId: string };
      const entry = await prisma.guildBlacklistUser.findUnique({
        where: { guildId_userId: { guildId, userId } },
      });
      if (!entry) {
        return reply.status(404).send(error('Entrée blacklist introuvable'));
      }
      await prisma.guildBlacklistUser.delete({
        where: { guildId_userId: { guildId, userId } },
      });
      await prisma.auditLog.create({
        data: {
          guildId,
          action: 'BLACKLIST_REMOVE',
          userId: request.user!.id,
          details: JSON.stringify({ targetUserId: userId }),
        },
      }).catch(() => {});
      reply.send(success(null, 'Utilisateur retiré de la blacklist'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/members', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const q = request.query as Record<string, string | undefined>;
      const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '50', 10) || 50));
      const after = q.after || '0';
      const members = await (await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members?limit=${limit}&after=${after}`,
        { headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` } }
      )).json() as Array<{ user: { id: string; username: string; avatar: string }; nick: string | null }>;
      reply.send(success({
        members: members.map((m) => ({
          id: m.user.id,
          username: m.user.username,
          avatar: m.user.avatar,
          nick: m.nick,
        })),
      }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/resolve-user/:userId', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, userId } = request.params as { guildId: string; userId: string };
      if (!userId) return reply.send(success({ id: userId, username: userId ?? 'Inconnu', avatar: null }));
      const member = await getGuildMember(guildId, userId).catch(() => null);
      if (member) {
        return reply.send(success({
          id: userId,
          username: member.user?.username ?? member.nick ?? 'Inconnu',
          avatar: member.user?.avatar ?? null,
        }));
      }
      const user = await prisma.user.findUnique({ where: { discordId: userId } });
      reply.send(success({
        id: userId,
        username: user?.username ?? userId,
        avatar: user?.avatar ?? null,
      }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/autoroles', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      let ar = await prisma.autoroleSettings.findUnique({ where: { guildId }, include: { entries: true } });
      if (!ar) ar = await prisma.autoroleSettings.create({ data: { guildId }, include: { entries: true } });
      reply.send(success({ settings: transformAutoroleSettings(ar) }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/autoroles', { preHandler: [authenticate, validateParams(guildIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;
      await prisma.autoroleSettings.upsert({
        where: { guildId },
        update: { enabled: body.enabled as boolean | undefined },
        create: { guildId, enabled: (body.enabled as boolean) ?? true },
      });
      if (body.roleIds || body.botRoles) {
        const settings = await prisma.autoroleSettings.findUnique({ where: { guildId } });
        if (settings) {
          await prisma.autoroleEntry.deleteMany({ where: { guildId } });
          const joinRoles: string[] = (body.roleIds as string[]) ?? [];
          const botRoles: string[] = (body.botRoles as string[]) ?? [];
          if (joinRoles.length > 0) {
            await prisma.autoroleEntry.createMany({
              data: joinRoles.map((roleId: string) => ({ settingsId: settings.id, guildId, roleId, type: 'JOIN' })),
            });
          }
          if (botRoles.length > 0) {
            await prisma.autoroleEntry.createMany({
              data: botRoles.map((roleId: string) => ({ settingsId: settings.id, guildId, roleId, type: 'BOT' })),
            });
          }
        }
      }
      reply.send(success(null, 'Paramètres d\'autorôles mis à jour'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });
}
