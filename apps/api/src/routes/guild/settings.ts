import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@pinguin/db';
import { authenticate } from '../../middleware/auth';
import { requireGuildAdmin } from '../../middleware/guild-auth';
import { validateParams, validateBody } from '../../middleware/validate';
import { success, error, sanitizeError } from '../../utils/response';
import { ItemType, AutoroleType } from '@pinguin/db';
import { guildIdSchema, mapLogsPayload, importSchema, importModulesEnum } from '../../utils/guild-helpers';
import { notifyModuleChange, invalidateBotAutoModCache, leaveGuildViaBot } from '../../services/bot-proxy';
import { getGuildMember, getGuildRoles } from '../../services/discord';

const guildParam = { preHandler: [authenticate, validateParams(guildIdSchema)] };

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      let settings = await prisma.guildSettings.findUnique({ where: { guildId } });
      if (!settings) {
        settings = await prisma.guildSettings.create({ data: { guildId } });
      }
      reply.send(success({ settings }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.put('/', { preHandler: [authenticate, requireGuildAdmin, validateParams(guildIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;
      await prisma.guildSettings.upsert({
        where: { guildId },
        update: {
          prefix: body.prefix as string | undefined,
          locale: body.locale as string | undefined,
          timezone: body.timezone as string | undefined,
          modLogChannel: body.modLogChannel as string | undefined,
          modRoleIds: body.modRoleIds ? JSON.stringify(body.modRoleIds) : undefined,
          adminRoleIds: body.adminRoleIds ? JSON.stringify(body.adminRoleIds) : undefined,
          muteRoleId: body.muteRoleId as string | undefined,
          suggestionChannelId: body.suggestionChannelId as string | undefined,
        },
        create: {
          guildId,
          prefix: (body.prefix as string) ?? '/',
          locale: (body.locale as string) ?? 'fr',
          modRoleIds: body.modRoleIds ? JSON.stringify(body.modRoleIds) : '[]',
          adminRoleIds: body.adminRoleIds ? JSON.stringify(body.adminRoleIds) : '[]',
        },
      });
      reply.send(success(null, 'Paramètres mis à jour'));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/modules', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      let modules = await prisma.moduleEnabled.findUnique({ where: { guildId } });
      if (!modules) modules = await prisma.moduleEnabled.create({ data: { guildId } });
      reply.send(success({ modules }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.patch('/modules', {
    preHandler: [authenticate, requireGuildAdmin],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, boolean>;
      const validModules = ['moderation','protection','tickets','logs','levels','economy','music','giveaways','polls','suggestions','welcome','autoroles','embeds','minigames','starboard','forms','clans','notifications'];
      const updates: Record<string, boolean> = {};
      for (const [key, val] of Object.entries(body)) {
        if (validModules.includes(key) && typeof val === 'boolean') {
          updates[key] = val;
        }
      }
      if (Object.keys(updates).length === 0) {
        return reply.status(400).send(error('Aucun module valide à mettre à jour'));
      }
      const result = await prisma.moduleEnabled.upsert({
        where: { guildId },
        update: updates,
        create: { guildId, ...updates },
      });
      try { await notifyModuleChange(guildId, validModules.filter((m) => !result[m as keyof typeof result])); } catch (e) { request.log?.warn?.('notifyModuleChange failed'); }
      reply.send(success(result, 'Modules mis à jour'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.patch('/modules/:moduleKey', { preHandler: [authenticate, requireGuildAdmin, validateParams(guildIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, moduleKey } = request.params as { guildId: string; moduleKey: string };
      const { enabled } = request.body as { enabled?: boolean };
      const validModules = ['moderation','protection','tickets','logs','levels','economy','music','giveaways','polls','suggestions','welcome','autoroles','embeds','minigames','starboard','forms','clans','notifications'];
      if (!validModules.includes(moduleKey)) return reply.status(400).send(error('Module inconnu'));
      await prisma.moduleEnabled.upsert({
        where: { guildId },
        update: { [moduleKey]: enabled },
        create: { guildId, [moduleKey]: enabled },
      });
      const allModules = await prisma.moduleEnabled.findUnique({ where: { guildId } });
      const disabled = allModules ? validModules.filter((m) => !allModules[m as keyof typeof allModules]) : [];
      try { await notifyModuleChange(guildId, disabled); } catch (e) { request.log?.warn?.('notifyModuleChange failed'); }
      reply.send(success({ moduleKey, enabled }, 'Module mis à jour'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/logs', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      let ls = await prisma.logSettings.findUnique({ where: { guildId } });
      if (!ls) ls = await prisma.logSettings.create({ data: { guildId } });
      const modules = await prisma.moduleEnabled.findUnique({ where: { guildId } });
      reply.send(success(mapLogsPayload(ls, modules)));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/logs', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;
      const eventsList = body.enabledEvents ?? body.events;
      const ignoreCh = body.ignoreChannels ?? body.ignoredChannels;
      await prisma.logSettings.upsert({
        where: { guildId },
        update: {
          logChannelId: body.logChannelId as string | undefined,
          events: Array.isArray(eventsList) ? JSON.stringify(eventsList) : undefined,
          ignoredChannels: Array.isArray(ignoreCh) ? JSON.stringify(ignoreCh) : undefined,
          ignoredRoles: Array.isArray(body.ignoredRoles) ? JSON.stringify(body.ignoredRoles) : undefined,
        },
        create: {
          guildId,
          logChannelId: (body.logChannelId as string) || null,
          events: Array.isArray(eventsList) ? JSON.stringify(eventsList) : '[]',
          ignoredChannels: Array.isArray(ignoreCh) ? JSON.stringify(ignoreCh) : '[]',
          ignoredRoles: Array.isArray(body.ignoredRoles) ? JSON.stringify(body.ignoredRoles) : '[]',
        },
      });
      reply.send(success(null, 'Logs mis à jour'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/audit', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '20', 10) || 20));
      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where: { guildId }, orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
          include: { user: { select: { username: true, avatar: true } } },
        }),
        prisma.auditLog.count({ where: { guildId } }),
      ]);
      reply.send(success({ entries: logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/embeds', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as { embeds?: Record<string, unknown>[] };
      if (!Array.isArray(body.embeds)) {
        return reply.status(400).send(error('embeds (tableau) requis'));
      }
      await prisma.$transaction([
        prisma.savedEmbed.deleteMany({ where: { guildId } }),
        ...body.embeds.map((e: Record<string, unknown>) =>
          prisma.savedEmbed.create({
            data: {
              id: (e.id as string | undefined) ?? undefined,
              guildId,
              name: e.name as string,
              title: (e.title as string | null) ?? null,
              description: (e.description as string | null) ?? null,
              color: (e.color as string) ?? '#e0e0e0',
              fields: Array.isArray(e.fields) ? JSON.stringify(e.fields) : '[]',
              footer: (e.footer as string | null) ?? null,
              image: (e.image as string | null) ?? null,
              thumbnail: (e.thumbnail as string | null) ?? null,
              authorName: (e.authorName as string | null) ?? null,
              authorIcon: (e.authorIcon as string | null) ?? null,
              timestamp: (e.timestamp as boolean | undefined) ?? true,
            },
          })
        ),
      ]);
      reply.send(success(null, 'Embeds mis à jour'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/reset', { preHandler: [authenticate, requireGuildAdmin, validateParams(guildIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;
      const guild = await prisma.guild.findUnique({ where: { id: guildId } });
      if (!guild) return reply.status(404).send(error('Serveur introuvable'));
      if (body.confirmName !== guild.name) {
        return reply.status(400).send(error('Nom du serveur incorrect'));
      }
      await prisma.$transaction([
        prisma.economySettings.deleteMany({ where: { guildId } }),
        prisma.protectionSettings.deleteMany({ where: { guildId } }),
        prisma.welcomeSettings.deleteMany({ where: { guildId } }),
        prisma.logSettings.deleteMany({ where: { guildId } }),
        prisma.xPSettings.deleteMany({ where: { guildId } }),
        prisma.autoModSettings.deleteMany({ where: { guildId } }),
        prisma.ticketSettings.deleteMany({ where: { guildId } }),
        prisma.autoroleSettings.deleteMany({ where: { guildId } }),
      ]);
      await prisma.moduleEnabled.upsert({
        where: { guildId },
        update: {},
        create: { guildId },
      });
      reply.send(success(null, 'Paramètres réinitialisés'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/leave', { preHandler: [authenticate, requireGuildAdmin, validateParams(guildIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      await leaveGuildViaBot(guildId);
      await prisma.guild.update({ where: { id: guildId }, data: { botPresent: false } });
      reply.send(success(null, 'Bot retiré du serveur'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/delete-data', { preHandler: [authenticate, requireGuildAdmin, validateParams(guildIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;
      const guild = await prisma.guild.findUnique({ where: { id: guildId } });
      if (!guild) return reply.status(404).send(error('Serveur introuvable'));
      if (body.confirmName !== guild.name) {
        return reply.status(400).send(error('Nom du serveur incorrect'));
      }
      await prisma.$transaction([
        prisma.ticket.deleteMany({ where: { guildId } }),
        prisma.moderationCase.deleteMany({ where: { guildId } }),
        prisma.poll.deleteMany({ where: { guildId } }),
        prisma.giveaway.deleteMany({ where: { guildId } }),
        prisma.suggestion.deleteMany({ where: { guildId } }),
        prisma.xPProfile.deleteMany({ where: { guildId } }),
        prisma.economyWallet.deleteMany({ where: { guildId } }),
        prisma.auditLog.deleteMany({ where: { guildId } }),
        prisma.guild.delete({ where: { id: guildId } }),
      ]);
      reply.send(success(null, 'Données supprimées'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/export', { preHandler: [authenticate, requireGuildAdmin, validateParams(guildIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const guild = await prisma.guild.findUnique({
        where: { id: guildId },
        include: {
          settings: true,
          modulesEnabled: true,
          logSettings: true,
          xpSettings: true,
          welcomeSettings: true,
          economySettings: { include: { shopItems: true } },
          protectionSettings: true,
          autoroleSettings: { include: { entries: true } },
          autoModSettings: true,
          ticketSettings: true,
        },
      });
      if (!guild) return reply.status(404).send(error('Serveur introuvable'));

      const ticketCategories = await prisma.ticketCategory.findMany({ where: { guildId } });

      const exportPayload: Record<string, unknown> = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        guildId: guild.id,
        guildName: guild.name,
      };

      if (guild.settings) {
        const s = guild.settings;
        exportPayload.settings = {
          prefix: s.prefix,
          locale: s.locale,
          timezone: s.timezone,
          modLogChannel: s.modLogChannel,
          modRoleIds: JSON.parse(s.modRoleIds),
          adminRoleIds: JSON.parse(s.adminRoleIds),
          muteRoleId: s.muteRoleId,
          dashboardAccessRoles: JSON.parse(s.dashboardAccessRoles),
          dashboardModerationAccess: JSON.parse(s.dashboardModerationAccess),
          dashboardTicketsAccess: JSON.parse(s.dashboardTicketsAccess),
          dashboardPollsAccess: JSON.parse(s.dashboardPollsAccess),
          dashboardSuggestionsAccess: JSON.parse(s.dashboardSuggestionsAccess),
          dashboardGiveawaysAccess: JSON.parse(s.dashboardGiveawaysAccess),
          dashboardEconomyAccess: JSON.parse(s.dashboardEconomyAccess),
          dashboardMusicAccess: JSON.parse(s.dashboardMusicAccess),
          dashboardLevelsAccess: JSON.parse(s.dashboardLevelsAccess),
          dashboardWelcomeAccess: JSON.parse(s.dashboardWelcomeAccess),
          dashboardAutorolesAccess: JSON.parse(s.dashboardAutorolesAccess),
          dashboardLogsAccess: JSON.parse(s.dashboardLogsAccess),
          dashboardProtectionAccess: JSON.parse(s.dashboardProtectionAccess),
          dashboardAuditAccess: JSON.parse(s.dashboardAuditAccess),
          changelogChannel: s.changelogChannel,
          suggestionChannelId: s.suggestionChannelId,
          onboardingDone: s.onboardingDone,
        };
      }

      if (guild.modulesEnabled) {
        const m = guild.modulesEnabled;
        exportPayload.modulesEnabled = {
          moderation: m.moderation,
          protection: m.protection,
          tickets: m.tickets,
          logs: m.logs,
          levels: m.levels,
          economy: m.economy,
          music: m.music,
          giveaways: m.giveaways,
          polls: m.polls,
          suggestions: m.suggestions,
          welcome: m.welcome,
          autoroles: m.autoroles,
          embeds: m.embeds,
          minigames: m.minigames,
          starboard: m.starboard,
          forms: m.forms,
          clans: m.clans,
          notifications: m.notifications,
        };
      }

      if (guild.logSettings) {
        const l = guild.logSettings;
        exportPayload.logSettings = {
          logChannelId: l.logChannelId,
          events: JSON.parse(l.events),
          ignoredChannels: JSON.parse(l.ignoredChannels),
          ignoredRoles: JSON.parse(l.ignoredRoles),
        };
      }

      if (guild.xpSettings) {
        const x = guild.xpSettings;
        exportPayload.xpSettings = {
          enabled: x.enabled,
          xpPerMessageMin: x.xpPerMessageMin,
          xpPerMessageMax: x.xpPerMessageMax,
          voiceXp: x.voiceXp,
          messageCooldown: x.messageCooldown,
          voiceCooldown: x.voiceCooldown,
          levelFormula: x.levelFormula,
          maxLevel: x.maxLevel,
          ignoredChannels: JSON.parse(x.ignoredChannels),
          ignoredRoles: JSON.parse(x.ignoredRoles),
          announcementChannelId: x.announcementChannelId,
          announcementMessage: x.announcementMessage,
          xpCurve: x.xpCurve,
          xpMultiplier: x.xpMultiplier,
          noXpRoles: JSON.parse(x.noXpRoles),
          noXpChannels: JSON.parse(x.noXpChannels),
          boosterRoles: JSON.parse(x.boosterRoles),
          boosterChannels: JSON.parse(x.boosterChannels),
          xpInThreads: x.xpInThreads,
          xpInForumPosts: x.xpInForumPosts,
          xpVocalMessages: x.xpVocalMessages,
          showOtherLevels: x.showOtherLevels,
          resetOnLeave: x.resetOnLeave,
          resetOnBan: x.resetOnBan,
          doubleXpLongMessages: x.doubleXpLongMessages,
          onlineLeaderboard: x.onlineLeaderboard,
          discordLeaderboard: x.discordLeaderboard,
          levelColor: x.levelColor,
          rewardAnnounce: x.rewardAnnounce,
          rewardMessage: x.rewardMessage,
        };
      }

      if (guild.welcomeSettings) {
        const w = guild.welcomeSettings as Record<string, unknown>;
        exportPayload.welcomeSettings = {
          enabled: w.enabled, welcomeChannelId: w.welcomeChannelId,
          welcomeMessage: w.welcomeMessage, welcomeEmbed: w.welcomeEmbed,
          welcomeEmbedColor: w.welcomeEmbedColor, welcomeEmbedTitle: w.welcomeEmbedTitle,
          welcomeEmbedDescription: w.welcomeEmbedDescription, welcomeEmbedFooter: w.welcomeEmbedFooter,
          welcomeEmbedImage: w.welcomeEmbedImage, welcomeDM: w.welcomeDM,
          welcomeDMMessage: w.welcomeDMMessage, mentionMember: w.mentionMember,
          goodbyeEnabled: w.goodbyeEnabled, goodbyeChannelId: w.goodbyeChannelId,
          goodbyeMessage: w.goodbyeMessage, goodbyeEmbed: w.goodbyeEmbed,
          goodbyeEmbedColor: w.goodbyeEmbedColor, cardEnabled: w.cardEnabled,
          cardBackground: w.cardBackground, cardBgColor: w.cardBgColor,
          cardBgImage: w.cardBgImage, cardTextColor: w.cardTextColor,
          cardSubtextColor: w.cardSubtextColor, cardAccentColor: w.cardAccentColor,
          cardBlurBackground: w.cardBlurBackground, cardText: w.cardText,
          cardSubtext: w.cardSubtext,
        };
      }

      if (guild.economySettings) {
        const e = guild.economySettings;
        exportPayload.economySettings = {
          enabled: e.enabled, currencyName: e.currencyName, currencySymbol: e.currencySymbol,
          dailyAmount: e.dailyAmount, weeklyAmount: e.weeklyAmount, startupBalance: e.startupBalance,
          workMin: e.workMin, workMax: e.workMax, workCooldown: e.workCooldown,
          robberyEnabled: e.robberyEnabled, robberyMaxAmount: e.robberyMaxAmount,
          robberyCooldown: e.robberyCooldown, interestRate: e.interestRate,
          interestInterval: e.interestInterval, bankCapacity: e.bankCapacity,
          shopItems: e.shopItems.map((i) => ({
            id: i.id, name: i.name, description: i.description, price: i.price,
            type: i.type, roleId: i.roleId, duration: i.duration, effectValue: i.effectValue,
          })),
        };
      }

      if (guild.protectionSettings) {
        const p = guild.protectionSettings;
        exportPayload.protectionSettings = {
          enabled: p.enabled, antiRaid: p.antiRaid, raidThreshold: p.raidThreshold,
          raidInterval: p.raidInterval, antiSpam: p.antiSpam, spamThreshold: p.spamThreshold,
          spamInterval: p.spamInterval, antiMassMention: p.antiMassMention,
          mentionThreshold: p.mentionThreshold, antiLink: p.antiLink, antiAlts: p.antiAlts,
          altAccountAge: p.altAccountAge, verificationLevel: p.verificationLevel,
          captchaVerification: p.captchaVerification, verifiedRoleId: p.verifiedRoleId,
          punishment: p.punishment,
        };
      }

      if (guild.autoroleSettings) {
        const a = guild.autoroleSettings;
        exportPayload.autoroleSettings = {
          enabled: a.enabled, onJoin: a.onJoin, onLevelUp: a.onLevelUp, onReaction: a.onReaction,
          entries: a.entries.map((e) => ({
            roleId: e.roleId, type: e.type, levelRequired: e.levelRequired,
            reactionChannelId: e.reactionChannelId, reactionEmoji: e.reactionEmoji,
          })),
        };
      }

      if (guild.autoModSettings) {
        const am = guild.autoModSettings;
        exportPayload.autoModSettings = {
          bannedWords: am.bannedWords, bannedWordsList: JSON.parse(am.bannedWordsList),
          discordInvites: am.discordInvites, externalLinks: am.externalLinks,
          excessiveCaps: am.excessiveCaps, capsThreshold: am.capsThreshold,
          excessiveEmojis: am.excessiveEmojis, emojisThreshold: am.emojisThreshold,
          excessiveMentions: am.excessiveMentions, mentionsThreshold: am.mentionsThreshold,
          forbiddenPings: am.forbiddenPings, forbiddenPingRoles: JSON.parse(am.forbiddenPingRoles),
          messageSpam: am.messageSpam, spamThreshold: am.spamThreshold, spamInterval: am.spamInterval,
          forbiddenMarkdown: am.forbiddenMarkdown, forbiddenMarkdownList: JSON.parse(am.forbiddenMarkdownList),
          warnEnabled: am.warnEnabled, muteEnabled: am.muteEnabled, muteDuration: am.muteDuration,
          kickEnabled: am.kickEnabled, banEnabled: am.banEnabled,
          autoSanctionThreshold: am.autoSanctionThreshold,
          autoWarnMuteThreshold: am.autoWarnMuteThreshold, autoWarnBanThreshold: am.autoWarnBanThreshold,
          autoWarnMuteDuration: am.autoWarnMuteDuration,
          whitelistRoles: JSON.parse(am.whitelistRoles), whitelistChannels: JSON.parse(am.whitelistChannels),
          logChannelId: am.logChannelId,
        };
      }

      if (guild.ticketSettings) {
        const t = guild.ticketSettings;
        exportPayload.ticketSettings = {
          enabled: t.enabled, categoryId: t.categoryId, logChannelId: t.logChannelId,
          validationChannelId: t.validationChannelId, transcriptChannelId: t.transcriptChannelId,
          requireValidation: t.requireValidation, requireOpenReason: t.requireOpenReason,
          requireCloseReason: t.requireCloseReason, channelFormat: t.channelFormat,
          moderatorRoles: JSON.parse(t.moderatorRoles), accessRoles: JSON.parse(t.accessRoles),
          mentionModerators: t.mentionModerators, maxOpenPerUser: t.maxOpenPerUser,
          autoDelete: t.autoDelete, inactivityAlertHours: t.inactivityAlertHours,
          welcomeMessageNoReason: t.welcomeMessageNoReason, transcriptFormat: t.transcriptFormat,
          openMessage: t.openMessage, panelMessage: t.panelMessage, panelButtonText: t.panelButtonText,
          categories: ticketCategories.map((c) => ({
            name: c.name, description: c.description, staffRoleIds: JSON.parse(c.staffRoleIds),
            maxTicketsPerUser: c.maxTicketsPerUser, openingMode: c.openingMode, formId: c.formId,
            welcomeMessage: c.welcomeMessage, color: c.color, emoji: c.emoji, position: c.position,
          })),
        };
      }

      reply.send(success(exportPayload));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/import', {
    preHandler: [authenticate, requireGuildAdmin, validateParams(guildIdSchema), validateBody(importSchema)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as z.infer<typeof importSchema>;
      const { exportData, modules } = body;

      if (exportData.version !== '1.0') {
        return reply.status(400).send(error('Version de configuration incompatible. Attendu: 1.0'));
      }

      if (exportData.guildId === guildId) {
        return reply.status(400).send(error('L\'import sur le même serveur n\'est pas supporté. Utilisez les paramètres directement.'));
      }

      const userDiscordId = request.user!.discordId;
      const guild = await prisma.guild.findUnique({ where: { id: guildId }, select: { ownerId: true } });
      const isOwner = guild?.ownerId === userDiscordId;

      if (!isOwner && modules.includes('settings')) {
        const importedSettings = exportData.settings as Record<string, unknown> | undefined;
        if (importedSettings) {
          const importedDashboardRoles = (importedSettings.dashboardAccessRoles as string[]) ?? [];
          const member = await getGuildMember(guildId, userDiscordId).catch(() => null);
          if (member) {
            const roles = await getGuildRoles(guildId).catch(() => [] as Array<{ id: string; permissions?: string }>);
            const memberRoleIds: string[] = Array.isArray(member.roles) ? member.roles : [];

            let permissions = BigInt(0);
            for (const role of roles) {
              if (memberRoleIds.includes(role.id)) {
                permissions |= BigInt(role.permissions ?? 0);
              }
            }
            const ADMINISTRATOR = BigInt(0x8);
            const isDiscordAdmin = (permissions & ADMINISTRATOR) !== BigInt(0);

            if (!isDiscordAdmin) {
              const wouldLockout =
                (!importedDashboardRoles || importedDashboardRoles.length === 0) ||
                !importedDashboardRoles.some((r: string) => memberRoleIds.includes(r));

              if (wouldLockout) {
                return reply.status(400).send(error(
                  'Cet import vous retirerait l\'accès au dashboard (aucun de vos rôles n\'est dans la liste des accès). ' +
                  'Ajoutez un de vos rôles à "dashboardAccessRoles" dans la config importée ou demandez à un administrateur Discord de le faire.'
                ));
              }
            }
          }
        }
      }

      const operations: Promise<unknown>[] = [];

      for (const mod of modules) {
        switch (mod) {
          case 'settings': {
            const s = exportData.settings as Record<string, unknown> | undefined;
            if (s) {
              const updateData: Record<string, unknown> = {};
              const createData: Record<string, unknown> = { guildId };

              const scalarFields = ['prefix', 'locale', 'timezone', 'modLogChannel', 'muteRoleId',
                'changelogChannel', 'suggestionChannelId', 'onboardingDone'];
              for (const f of scalarFields) {
                if (s[f] !== undefined) { updateData[f] = s[f]; createData[f] = s[f]; }
              }

              const arrayFields = ['modRoleIds', 'adminRoleIds', 'dashboardAccessRoles',
                'dashboardModerationAccess', 'dashboardTicketsAccess', 'dashboardPollsAccess',
                'dashboardSuggestionsAccess', 'dashboardGiveawaysAccess', 'dashboardEconomyAccess',
                'dashboardMusicAccess', 'dashboardLevelsAccess', 'dashboardWelcomeAccess',
                'dashboardAutorolesAccess', 'dashboardLogsAccess', 'dashboardProtectionAccess',
                'dashboardAuditAccess'];
              for (const f of arrayFields) {
                if (Array.isArray(s[f])) {
                  updateData[f] = JSON.stringify(s[f]);
                  createData[f] = JSON.stringify(s[f]);
                }
              }

              operations.push(
                prisma.guildSettings.upsert({
                  where: { guildId },
                  update: updateData as any,
                  create: { guildId, ...createData } as any,
                })
              );
            }
            break;
          }
          case 'modulesEnabled': {
            const m = exportData.modulesEnabled as Record<string, unknown> | undefined;
            if (m) {
              const moduleFields = ['moderation', 'protection', 'tickets', 'logs', 'levels', 'economy',
                'music', 'giveaways', 'polls', 'suggestions', 'welcome', 'autoroles', 'embeds',
                'minigames', 'starboard', 'forms', 'clans', 'notifications'];
              const data: Record<string, boolean> = {};
              for (const f of moduleFields) {
                if (typeof m[f] === 'boolean') data[f] = m[f];
              }
              if (Object.keys(data).length > 0) {
                operations.push(
                  prisma.moduleEnabled.upsert({
                    where: { guildId },
                    update: data,
                    create: { guildId, ...data },
                  })
                );
              }
            }
            break;
          }
          case 'logSettings': {
            const ls = exportData.logSettings as Record<string, unknown> | undefined;
            if (ls) {
              const data: Record<string, unknown> = {};
              if (ls.logChannelId !== undefined) data.logChannelId = ls.logChannelId as string | null;
              if (Array.isArray(ls.events)) data.events = JSON.stringify(ls.events);
              if (Array.isArray(ls.ignoredChannels)) data.ignoredChannels = JSON.stringify(ls.ignoredChannels);
              if (Array.isArray(ls.ignoredRoles)) data.ignoredRoles = JSON.stringify(ls.ignoredRoles);
              operations.push(
                prisma.logSettings.upsert({
                  where: { guildId },
                  update: data,
                  create: { guildId, ...data },
                })
              );
            }
            break;
          }
          case 'xpSettings': {
            const x = exportData.xpSettings as Record<string, unknown> | undefined;
            if (x) {
              const data: Record<string, unknown> = {};
              const scalarFields = ['enabled', 'xpPerMessageMin', 'xpPerMessageMax', 'voiceXp',
                'messageCooldown', 'voiceCooldown', 'levelFormula', 'maxLevel',
                'announcementChannelId', 'announcementMessage', 'xpCurve', 'xpMultiplier',
                'xpInThreads', 'xpInForumPosts', 'xpVocalMessages', 'showOtherLevels',
                'resetOnLeave', 'resetOnBan', 'doubleXpLongMessages', 'onlineLeaderboard',
                'discordLeaderboard', 'levelColor', 'rewardAnnounce', 'rewardMessage'];
              for (const f of scalarFields) {
                if (x[f] !== undefined) data[f] = x[f];
              }
              const arrayFields = ['ignoredChannels', 'ignoredRoles', 'noXpRoles', 'noXpChannels', 'boosterRoles', 'boosterChannels'];
              for (const f of arrayFields) {
                if (Array.isArray(x[f])) data[f] = JSON.stringify(x[f]);
              }
              operations.push(
                prisma.xPSettings.upsert({
                  where: { guildId },
                  update: data,
                  create: { guildId, ...data },
                })
              );
            }
            break;
          }
          case 'welcomeSettings': {
            const w = exportData.welcomeSettings as Record<string, unknown> | undefined;
            if (w) {
              const data: Record<string, unknown> = {};
              const scalarFields = ['enabled', 'welcomeChannelId', 'welcomeMessage', 'welcomeEmbed',
                'welcomeEmbedColor', 'welcomeEmbedTitle', 'welcomeEmbedDescription',
                'welcomeEmbedFooter', 'welcomeEmbedImage', 'welcomeDM', 'welcomeDMMessage',
                'mentionMember', 'goodbyeEnabled', 'goodbyeChannelId', 'goodbyeMessage',
                'goodbyeEmbed', 'goodbyeEmbedColor', 'cardEnabled', 'cardBackground',
                'cardBgColor', 'cardBgImage', 'cardTextColor', 'cardSubtextColor',
                'cardAccentColor', 'cardBlurBackground', 'cardText', 'cardSubtext'];
              for (const f of scalarFields) {
                if (w[f] !== undefined) data[f] = w[f];
              }
              operations.push(
                prisma.welcomeSettings.upsert({
                  where: { guildId },
                  update: data,
                  create: { guildId, ...data },
                })
              );
            }
            break;
          }
          case 'economySettings': {
            const ec = exportData.economySettings as Record<string, unknown> | undefined;
            if (ec) {
              const { shopItems: shopItemsPayload, ...ecScalar } = ec;
              operations.push(
                prisma.$transaction(async (tx) => {
                  const economy = await tx.economySettings.upsert({
                    where: { guildId },
                    update: ecScalar,
                    create: { guildId, ...ecScalar },
                  });
                  if (Array.isArray(shopItemsPayload)) {
                    await tx.shopItem.deleteMany({ where: { economySettingsId: economy.id } });
                    for (const item of shopItemsPayload) {
                      const i = item as Record<string, unknown>;
                      await tx.shopItem.create({
                        data: {
                          economySettingsId: economy.id,
                          name: i.name as string,
                          description: (i.description as string | null) ?? null,
                          price: i.price as number,
                          type: (i.type as ItemType) ?? 'ROLE',
                          roleId: (i.roleId as string | null) ?? null,
                          duration: (i.duration as number | null) ?? null,
                          effectValue: (i.effectValue as number | null) ?? null,
                        },
                      });
                    }
                  }
                })
              );
            }
            break;
          }
          case 'protectionSettings': {
            const p = exportData.protectionSettings as Record<string, unknown> | undefined;
            if (p) {
              const data: Record<string, unknown> = {};
              const scalarFields = ['enabled', 'antiRaid', 'raidThreshold', 'raidInterval',
                'antiSpam', 'spamThreshold', 'spamInterval', 'antiMassMention',
                'mentionThreshold', 'antiLink', 'antiAlts', 'altAccountAge',
                'verificationLevel', 'captchaVerification', 'verifiedRoleId',
                'punishment', 'emergencyMode'];
              for (const f of scalarFields) {
                if (p[f] !== undefined) data[f] = p[f];
              }
              operations.push(
                prisma.protectionSettings.upsert({
                  where: { guildId },
                  update: data,
                  create: { guildId, ...data },
                })
              );
            }
            break;
          }
          case 'autoroleSettings': {
            const ar = exportData.autoroleSettings as Record<string, unknown> | undefined;
            if (ar) {
              const { entries: entriesPayload, ...arScalar } = ar;
              const settings = await prisma.autoroleSettings.upsert({
                where: { guildId },
                update: arScalar,
                create: { guildId, ...arScalar },
              });
              operations.push(prisma.autoroleEntry.deleteMany({ where: { settingsId: settings.id } }));
              if (Array.isArray(entriesPayload)) {
                for (const entry of entriesPayload) {
                  const e = entry as Record<string, unknown>;
                  operations.push(prisma.autoroleEntry.create({
                    data: {
                      settingsId: settings.id,
                      guildId,
                      roleId: e.roleId as string,
                      type: e.type as AutoroleType,
                      levelRequired: (e.levelRequired as number | null) ?? null,
                      reactionChannelId: (e.reactionChannelId as string | null) ?? null,
                      reactionEmoji: (e.reactionEmoji as string | null) ?? null,
                    },
                  }));
                }
              }
            }
            break;
          }
          case 'autoModSettings': {
            const am = exportData.autoModSettings as Record<string, unknown> | undefined;
            if (am) {
              const data: Record<string, unknown> = { ...am };
              const arrayFields = ['bannedWordsList', 'forbiddenPingRoles', 'forbiddenMarkdownList', 'whitelistRoles', 'whitelistChannels'];
              for (const f of arrayFields) {
                if (Array.isArray(data[f])) data[f] = JSON.stringify(data[f]);
              }
              operations.push(
                prisma.autoModSettings.upsert({
                  where: { guildId },
                  update: data,
                  create: { guildId, ...data },
                })
              );
            }
            break;
          }
          case 'ticketSettings': {
            const t = exportData.ticketSettings as Record<string, unknown> | undefined;
            if (t) {
              const { categories: categoriesPayload, ...tScalar } = t;
              const data: Record<string, unknown> = { ...tScalar };
              if (Array.isArray(data.moderatorRoles)) data.moderatorRoles = JSON.stringify(data.moderatorRoles);
              if (Array.isArray(data.accessRoles)) data.accessRoles = JSON.stringify(data.accessRoles);
              operations.push(
                prisma.ticketSettings.upsert({
                  where: { guildId },
                  update: data,
                  create: { guildId, ...data },
                })
              );
              if (Array.isArray(categoriesPayload)) {
                operations.push(prisma.ticketCategory.deleteMany({ where: { guildId } }));
                for (const cat of categoriesPayload) {
                  const c = cat as Record<string, unknown>;
                  operations.push(prisma.ticketCategory.create({
                    data: {
                      guildId,
                      name: c.name as string,
                      description: (c.description as string | null) ?? null,
                      staffRoleIds: JSON.stringify((c.staffRoleIds as string[] | null) ?? []),
                      maxTicketsPerUser: (c.maxTicketsPerUser as number) ?? 5,
                      openingMode: (c.openingMode as string) ?? 'BUTTON',
                      formId: (c.formId as string | null) ?? null,
                      welcomeMessage: (c.welcomeMessage as string | null) ?? null,
                      color: (c.color as string) ?? '#5865F2',
                      emoji: (c.emoji as string | null) ?? null,
                      position: (c.position as number) ?? 0,
                    },
                  }));
                }
              }
            }
            break;
          }
        }
      }

      if (operations.length > 0) {
        await prisma.$transaction(operations as any);
      }

      reply.send(success({ importedModules: modules }, 'Configuration importée avec succès. Vérifiez les IDs de rôles et salons.'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });
}
