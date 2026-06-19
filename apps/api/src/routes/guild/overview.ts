import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@pinguin/db';
import { authenticate } from '../../middleware/auth';
import { validateParams } from '../../middleware/validate';
import { success, error, sanitizeError } from '../../utils/response';
import { guildIdSchema, transformAutoroleSettings, getEconomySettings, mapLogsPayload, computeDisabledModules } from '../../utils/guild-helpers';
import { getGuildChannels, getGuildRoles, getGuildMember, getBotGuilds } from '../../services/discord';

const guildParam = { preHandler: [authenticate, validateParams(guildIdSchema)] };

const userCache = new Map<string, { data: { id: string; username: string; avatar: string | null }; ts: number }>();

export async function overviewRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userDiscordId = request.user!.discordId;

      const botGuilds = await getBotGuilds().catch(() => null as Array<{ id: string }> | null);
      const botGuildIds = botGuilds ? new Set(botGuilds.map(g => g.id)) : null;

      const [allGuilds, userMemberships] = await Promise.all([
        prisma.guild.findMany({
          select: {
            id: true, name: true, icon: true, ownerId: true, memberCount: true,
            botPresent: true, settings: true,
          },
          orderBy: [{ botPresent: 'desc' }, { memberCount: 'desc' }],
        }),
        prisma.guildMember.findMany({
          where: { userId: userDiscordId },
          select: { guildId: true, isOwner: true },
        }),
      ]);

      const membershipMap = new Map(userMemberships.map(m => [m.guildId, m.isOwner]));

      const candidateGuilds = allGuilds.filter(g => {
        if (botGuildIds && !botGuildIds.has(g.id)) return false;
        return membershipMap.has(g.id);
      });

      const needsRoleCheck = candidateGuilds.filter(g => {
        if (membershipMap.get(g.id) || g.ownerId === userDiscordId) return false;
        try {
          const roles: string[] = g.settings ? JSON.parse(g.settings.dashboardAccessRoles || '[]') : [];
          return roles.length > 0;
        } catch { return false; }
      });

      const discordMemberRoles = new Map<string, string[]>();
      for (let i = 0; i < needsRoleCheck.length; i += 10) {
        const batch = needsRoleCheck.slice(i, i + 10);
        const batchResults = await Promise.all(
          batch.map(async (g) => {
            const member = await getGuildMember(g.id, userDiscordId).catch(() => null);
            return {
              guildId: g.id,
              roles: member && Array.isArray(member.roles) ? (member.roles as string[]) : [],
            };
          })
        );
        for (const r of batchResults) discordMemberRoles.set(r.guildId, r.roles);
      }

      const results: (typeof allGuilds[0] & { isMember: boolean; hasDashboardAccess: boolean })[] = [];
      for (const g of candidateGuilds) {
        const isOwner = membershipMap.get(g.id) || g.ownerId === userDiscordId;
        if (isOwner) {
          results.push({ ...g, isMember: true, hasDashboardAccess: true });
          continue;
        }
        let dashboardRoles: string[] = [];
        try { dashboardRoles = g.settings ? JSON.parse(g.settings.dashboardAccessRoles || '[]') : []; } catch { dashboardRoles = []; }
        if (dashboardRoles.length === 0) {
          results.push({ ...g, isMember: true, hasDashboardAccess: false });
          continue;
        }
        const memberRoles = discordMemberRoles.get(g.id) ?? [];
        results.push({ ...g, isMember: true, hasDashboardAccess: dashboardRoles.some(r => memberRoles.includes(r)) });
      }

      const guilds = results.filter(g => g.hasDashboardAccess);
      guilds.sort((a, b) => {
        if (a.botPresent !== b.botPresent) return a.botPresent ? -1 : 1;
        return b.memberCount - a.memberCount;
      });
      const premiumGuildIds = new Set(
        (await prisma.premiumSubscription.findMany({
          where: { guildId: { not: null }, status: 'ACTIVE' },
          select: { guildId: true },
        })).map((s) => s.guildId).filter(Boolean)
      );
      const enriched = guilds.map((g) => ({
        ...g,
        premium: (premiumGuildIds.has(g.id) ? 'BASIC' : 'FREE') as 'BASIC' | 'FREE',
      }));
      reply.send(success({ guilds: enriched }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/:guildId', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const guild = await prisma.guild.findUnique({
        where: { id: guildId },
        include: {
          settings: true, modulesEnabled: true, logSettings: true,
          xpSettings: true, welcomeSettings: true,
          protectionSettings: true,
          autoroleSettings: { include: { entries: true } },
          savedEmbeds: true,
          xpRoleRewards: true,
        },
      });
      if (!guild) return reply.status(404).send(error('Serveur introuvable'));
      if (!guild.autoroleSettings) {
        guild.autoroleSettings = await prisma.autoroleSettings.upsert({
          where: { guildId },
          update: {},
          create: { guildId },
          include: { entries: true },
        });
      }
      if (!guild.protectionSettings) {
        guild.protectionSettings = await prisma.protectionSettings.create({
          data: { guildId },
        });
      }
      const es = await getEconomySettings(guildId);
      let channelCount = 0, roleCount = 0;
      try {
        const [channels, roles] = await Promise.all([
          getGuildChannels(guildId),
          getGuildRoles(guildId),
        ]);
        channelCount = channels.filter((c: any) => c.type !== 4).length;
        roleCount = roles.filter((r: any) => r.id !== guildId).length;
      } catch {}
      const payload = {
        ...guild,
        autoroles: transformAutoroleSettings(guild.autoroleSettings),
        protection: guild.protectionSettings || { enabled: false, emergencyMode: false, antiRaid: false, raidThreshold: 10, raidInterval: 10, antiSpam: false, spamThreshold: 5, spamInterval: 5, antiMassMention: false, mentionThreshold: 5, antiLink: false, antiAlts: false, altAccountAge: 7, verificationLevel: 'NONE', captchaVerification: false, punishment: 'KICK' },
        economy: {
          enabled: es.enabled,
          currencyName: es.currencyName,
          currencySymbol: es.currencySymbol,
          dailyAmount: es.dailyAmount,
          weeklyAmount: es.weeklyAmount,
          startupBalance: es.startupBalance,
          workMin: es.workMin,
          workMax: es.workMax,
          workCooldown: es.workCooldown,
          robberyEnabled: es.robberyEnabled,
          robberyMaxAmount: es.robberyMaxAmount,
          robberyCooldown: es.robberyCooldown,
          interestRate: es.interestRate,
          interestInterval: es.interestInterval,
          bankCapacity: es.bankCapacity,
          shopItems: (es as { shopItems?: Array<Record<string, unknown>> }).shopItems?.map((i) => ({
            id: i.id as string, name: i.name as string, description: i.description as string | null, price: i.price as number, roleId: i.roleId as string | null,
          })) ?? [],
        },
        levels: guild.xpSettings ? {
          enabled: guild.xpSettings.enabled,
          xpPerMessageMin: guild.xpSettings.xpPerMessageMin,
          xpPerMessageMax: guild.xpSettings.xpPerMessageMax,
          voiceXp: guild.xpSettings.voiceXp,
          messageCooldown: guild.xpSettings.messageCooldown,
          voiceCooldown: guild.xpSettings.voiceCooldown,
          levelFormula: guild.xpSettings.levelFormula,
          maxLevel: guild.xpSettings.maxLevel,
          ignoredChannels: JSON.parse(guild.xpSettings.ignoredChannels),
          ignoredRoles: JSON.parse(guild.xpSettings.ignoredRoles),
          announcementChannelId: guild.xpSettings.announcementChannelId,
          announcementMessage: guild.xpSettings.announcementMessage,
          roleRewards: (guild as { xpRoleRewards?: Array<Record<string, unknown>> }).xpRoleRewards?.map((rr) => ({ level: rr.levelRequired as number, roleId: rr.roleId as string, xpMultiplier: rr.xpMultiplier as number | null })) ?? [],
        } : undefined,
        welcome: guild.welcomeSettings || undefined,
        logs: mapLogsPayload(guild.logSettings, guild.modulesEnabled),
        logSettings: guild.logSettings ? {
          logChannelId: guild.logSettings.logChannelId,
          events: JSON.parse(guild.logSettings.events),
          ignoredChannels: JSON.parse(guild.logSettings.ignoredChannels),
          ignoredRoles: JSON.parse(guild.logSettings.ignoredRoles),
        } : undefined,
        embeds: (guild.savedEmbeds || []).map((e: any) => ({
          id: e.id,
          name: e.name,
          title: e.title,
          description: e.description,
          color: e.color,
          fields: JSON.parse(e.fields),
          footer: e.footer,
          image: e.image,
          thumbnail: e.thumbnail,
          timestamp: e.timestamp,
        })),
        disabledModules: computeDisabledModules(guild.modulesEnabled),
        memberCount: guild.memberCount, channelCount, roleCount,
        dashboardAccessRoles: guild.settings ? JSON.parse(guild.settings.dashboardAccessRoles || '[]') : [],
        dashboardModerationAccess: guild.settings ? JSON.parse(guild.settings.dashboardModerationAccess || '[]') : [],
        dashboardTicketsAccess: guild.settings ? JSON.parse(guild.settings.dashboardTicketsAccess || '[]') : [],
        dashboardPollsAccess: guild.settings ? JSON.parse(guild.settings.dashboardPollsAccess || '[]') : [],
        dashboardSuggestionsAccess: guild.settings ? JSON.parse(guild.settings.dashboardSuggestionsAccess || '[]') : [],
        dashboardGiveawaysAccess: guild.settings ? JSON.parse(guild.settings.dashboardGiveawaysAccess || '[]') : [],
        dashboardEconomyAccess: guild.settings ? JSON.parse(guild.settings.dashboardEconomyAccess || '[]') : [],
        dashboardMusicAccess: guild.settings ? JSON.parse(guild.settings.dashboardMusicAccess || '[]') : [],
        dashboardLevelsAccess: guild.settings ? JSON.parse(guild.settings.dashboardLevelsAccess || '[]') : [],
        dashboardWelcomeAccess: guild.settings ? JSON.parse(guild.settings.dashboardWelcomeAccess || '[]') : [],
        dashboardAutorolesAccess: guild.settings ? JSON.parse(guild.settings.dashboardAutorolesAccess || '[]') : [],
        dashboardLogsAccess: guild.settings ? JSON.parse(guild.settings.dashboardLogsAccess || '[]') : [],
        dashboardProtectionAccess: guild.settings ? JSON.parse(guild.settings.dashboardProtectionAccess || '[]') : [],
        dashboardAuditAccess: guild.settings ? JSON.parse(guild.settings.dashboardAuditAccess || '[]') : [],
      };
      reply.send(success({ guild: payload }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/:guildId/channels', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const channels = await getGuildChannels(guildId);
      reply.send(success({ channels }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/:guildId/roles', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const roles = await getGuildRoles(guildId);
      reply.send(success({ roles }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/:guildId/resolve-user/:userId', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, userId } = request.params as { guildId: string; userId: string };
      const cached = userCache.get(userId);
      if (cached && (Date.now() - cached.ts) < 300_000) {
        return reply.send(success({ data: cached.data }));
      }
      let user = await prisma.user.findUnique({ where: { discordId: userId }, select: { discordId: true, username: true, avatar: true } });
      if (user) {
        userCache.set(userId, { data: { id: user.discordId, username: user.username, avatar: user.avatar }, ts: Date.now() });
        return reply.send(success({ data: { id: user.discordId, username: user.username, avatar: user.avatar } }));
      }
      const member = await getGuildMember(guildId, userId).catch(() => null);
      if (member && member.user) {
        const upserted = await prisma.user.upsert({
          where: { discordId: userId },
          update: { username: member.user.username, avatar: member.user.avatar ?? undefined },
          create: { discordId: userId, username: member.user.username, avatar: member.user.avatar ?? undefined },
          select: { discordId: true, username: true, avatar: true },
        });
        userCache.set(userId, { data: { id: upserted.discordId, username: upserted.username, avatar: upserted.avatar }, ts: Date.now() });
        return reply.send(success({ data: { id: upserted.discordId, username: upserted.username, avatar: upserted.avatar } }));
      }
      reply.status(404).send(error('Utilisateur introuvable'));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/:guildId/leaderboard', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const q = request.query as Record<string, string | undefined>;
      const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '20', 10) || 10));
      const profiles = await prisma.xPProfile.findMany({
        where: { guildId },
        orderBy: { xp: 'desc' },
        take: limit,
        include: { user: { select: { username: true, avatar: true, discordId: true } } },
      });
      const entries = profiles.map((p, i) => ({
        rank: i + 1,
        userId: p.userId,
        username: p.user?.username ?? 'Inconnu',
        avatar: p.user?.avatar ?? null,
        xp: p.xp,
        level: p.level,
      }));
      reply.send(success({ entries }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/:guildId/invites/leaderboard', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };

      const leaderboard = await prisma.$queryRaw<Array<{
        inviter_id: string;
        total_invites: bigint;
        fake_invites: bigint;
        left_invites: bigint;
        net_invites: bigint;
      }>>`
        SELECT
          inviter_id,
          COUNT(*) as total_invites,
          SUM(CASE WHEN is_fake = true THEN 1 ELSE 0 END) as fake_invites,
          SUM(CASE WHEN has_left = true THEN 1 ELSE 0 END) as left_invites,
          COUNT(*) - SUM(CASE WHEN is_fake = true THEN 1 ELSE 0 END) - SUM(CASE WHEN has_left = true THEN 1 ELSE 0 END) as net_invites
        FROM invite_tracks
        WHERE guild_id = ${guildId}
        GROUP BY inviter_id
        ORDER BY net_invites DESC
        LIMIT 50
      `;

      const inviterIds = leaderboard.map(e => e.inviter_id);
      const users = await prisma.user.findMany({
        where: { discordId: { in: inviterIds } },
        select: { discordId: true, username: true, avatar: true },
      });

      const userMap = new Map(users.map(u => [u.discordId, u]));

      const entries = leaderboard.map((entry, index) => {
        const user = userMap.get(entry.inviter_id);
        return {
          rank: index + 1,
          userId: entry.inviter_id,
          username: user?.username ?? 'Inconnu',
          avatar: user?.avatar,
          totalInvites: Number(entry.total_invites),
          fakeInvites: Number(entry.fake_invites),
          leftInvites: Number(entry.left_invites),
          netInvites: Number(entry.net_invites),
        };
      });

      reply.send(success({ leaderboard: entries }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });
}
