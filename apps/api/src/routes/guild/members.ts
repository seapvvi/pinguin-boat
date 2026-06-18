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
import {
  evaluatePermissions,
  DISCORD_PERMISSIONS,
  DASHBOARD_ACCESS_FIELD_MAP,
  DASHBOARD_MODULES,
  PermissionLevel,
} from '@pinguin/shared';

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

      // Calculer le bitfield des permissions Discord du membre
      let discordPermissions = 0n;
      for (const role of roles) {
        if (memberRoleIds.includes(role.id)) {
          discordPermissions |= BigInt(role.permissions ?? 0);
        }
      }

      const settings = guild?.settings;
      let adminRoleIds: string[] = [];
      let modRoleIds: string[] = [];
      let dashboardAccessRoleIds: string[] = [];
      try {
        if (settings) {
          adminRoleIds = JSON.parse(settings.adminRoleIds);
          modRoleIds = JSON.parse(settings.modRoleIds);
          dashboardAccessRoleIds = JSON.parse(settings.dashboardAccessRoles);
        }
      } catch { /* données corrompues */ }

      const combined = evaluatePermissions({
        userId: discordId,
        guildOwnerId: guild?.ownerId ?? '',
        memberRoleIds,
        discordPermissions,
        adminRoleIds,
        modRoleIds,
        dashboardAccessRoleIds,
      });

      const isOwner = combined.isOwner;
      const isAdmin = combined.isDiscordAdmin;
      const hasDashboardAccess = combined.level >= PermissionLevel.ADMIN ||
        (discordPermissions & BigInt(0x20)) !== 0n || // MANAGE_GUILD
        dashboardAccessRoleIds.some((r: string) => memberRoleIds.includes(r));

      // Construire la map d'accès dashboard par module
      const dashboard = {} as Record<string, boolean>;
      for (const mod of DASHBOARD_MODULES) {
        const field = DASHBOARD_ACCESS_FIELD_MAP[mod.key];
        const accessRoles: string[] = settings ? JSON.parse((settings as unknown as Record<string, string>)[field] || '[]') : [];
        dashboard[mod.key] = isOwner || isAdmin ||
          accessRoles.some((r: string) => memberRoleIds.includes(r));
      }

      reply.send(success({
        isOwner,
        isAdmin,
        hasDashboardAccess,
        permissions: discordPermissions.toString(),
        can: {
          manageGuild: isAdmin || (discordPermissions & DISCORD_PERMISSIONS.MANAGE_GUILD) !== 0n,
          manageRoles: isAdmin || (discordPermissions & DISCORD_PERMISSIONS.MANAGE_ROLES) !== 0n,
          manageMessages: isAdmin || (discordPermissions & DISCORD_PERMISSIONS.MANAGE_MESSAGES) !== 0n,
        },
        dashboard,
      }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/blacklist', { preHandler: [authenticate, requireGuildAdmin, validateParams(guildIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const page = Math.max(1, parseInt((request.query as Record<string, string | undefined>).page ?? '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt((request.query as Record<string, string | undefined>).limit ?? '20', 10) || 20));
      const [entries, total] = await Promise.all([
        prisma.guildBlacklistUser.findMany({
          where: { guildId },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
        }),
        prisma.guildBlacklistUser.count({ where: { guildId } }),
      ]);
      reply.send(success({
        entries: entries.map((e: typeof entries[number]) => ({
          id: e.id, targetId: e.userId, targetType: 'USER', reason: e.reason,
          moderatorId: e.moderatorId, createdAt: e.createdAt.toISOString(),
          targetName: null,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  // ─── Membres ───
  app.get('/', { preHandler: [authenticate, requireGuildAdmin, validateParams(guildIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const q = request.query as Record<string, string | undefined>;
      const search = q.search ?? '';
      const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '20', 10) || 20));
      const where = { guildId, userId: { contains: search } };
      const [members, total] = await Promise.all([
        prisma.guildMember.findMany({
          where, orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
        }),
        prisma.guildMember.count({ where }),
      ]);
      reply.send(success({
        members: members.map((m) => ({
          id: m.id, userId: m.userId, guildId: m.guildId,
          isOwner: m.isOwner, createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString(),
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/:memberId', { preHandler: [authenticate, requireGuildAdmin, validateParams(guildIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, memberId } = request.params as { guildId: string; memberId: string };
      const body = request.body as Record<string, unknown>;
      if (typeof body.isOwner === 'boolean') {
        const adminCount = await prisma.guildMember.count({ where: { guildId, isOwner: true } });
        if (body.isOwner === false && adminCount <= 1) {
          return reply.status(400).send(error('Il doit y avoir au moins un owner sur le serveur'));
        }
      }
      const member = await prisma.guildMember.upsert({
        where: { guildId_userId: { guildId, userId: memberId } },
        update: { isOwner: typeof body.isOwner === 'boolean' ? body.isOwner : undefined },
        create: { guildId, userId: memberId, isOwner: false },
      });
      reply.send(success(member, 'Membre mis à jour'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.delete('/:memberId', { preHandler: [authenticate, requireGuildAdmin, validateParams(guildIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, memberId } = request.params as { guildId: string; memberId: string };
      const member = await prisma.guildMember.findUnique({ where: { guildId_userId: { guildId, userId: memberId } } });
      if (!member) return reply.status(404).send(error('Membre introuvable'));
      if (member.isOwner) return reply.status(400).send(error('Impossible de supprimer un owner'));
      await prisma.guildMember.delete({ where: { id: member.id } });
      reply.send(success(null, 'Membre supprimé'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });
}
