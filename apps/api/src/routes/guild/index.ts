import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@pinguin/db';
import { authenticate } from '../../middleware/auth';
import { requireGuildAdmin } from '../../middleware/guild-auth';
import { validateParams } from '../../middleware/validate';
import { success, error, sanitizeError } from '../../utils/response';
import { MODULE_FIELDS, guildIdSchema, suggestionIdSchema, giveawayIdSchema, pollIdSchema, economySchema, levelsSchema, welcomeSchema, protectionSchema, transformAutoroleSettings, getEconomySettings, mapLogsPayload, computeDisabledModules } from '../../utils/guild-helpers';
import { getQueueState, botControl, notifyModuleChange } from '../../services/bot-proxy';
import { sendDM, kickMember, banMember, unbanMember, sendChannelMessage, editMessage, addMessageReaction, getGuildChannels, getGuildRoles, getGuildMember, NUMBER_EMOJIS } from '../../services/discord';

import { overviewRoutes } from './overview';
import { settingsRoutes } from './settings';
import { moderationRoutes } from './moderation';
import { ticketsRoutes } from './tickets';
import { economyRoutes } from './economy';
import { levelsRoutes } from './levels';
import { welcomeRoutes } from './welcome';
import { protectionRoutes } from './protection';
import { backupRoutes } from './backup';
import { membersRoutes } from './members';

const guildParam = { preHandler: [authenticate, validateParams(guildIdSchema)] };

export async function guildRoutes(app: FastifyInstance) {
  // ─── Overview routes ───
  await app.register(overviewRoutes);

  // ─── Guild update ───
  app.put('/:guildId', { preHandler: [authenticate, requireGuildAdmin, validateParams(guildIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;

      if (Array.isArray(body.disabledModules)) {
        const data: Record<string, boolean> = {};
        for (const f of MODULE_FIELDS) {
          data[f] = !(body.disabledModules as string[]).map((m: string) => m.toLowerCase()).includes(f);
        }
        await prisma.moduleEnabled.upsert({
          where: { guildId },
          update: data,
          create: { guildId, ...data },
        });
        try {
          await notifyModuleChange(guildId, body.disabledModules as string[]);
        } catch (e) { request.log?.warn?.('notifyModuleChange failed'); }
      }

      if (body.economy) {
        const parsed = economySchema.safeParse(body.economy);
        if (!parsed.success) {
          return reply.status(400).send(error(parsed.error.errors.map(e => e.message).join(', ')));
        }
        const ec = parsed.data;
        const { shopItems: shopItemsPayload, ...ecScalar } = ec;
        const economy = await prisma.economySettings.upsert({
          where: { guildId },
          update: {
            enabled: ecScalar.enabled ?? undefined,
            currencyName: ecScalar.currencyName ?? undefined,
            currencySymbol: ecScalar.currencySymbol ?? undefined,
            dailyAmount: ecScalar.dailyAmount ?? undefined,
            weeklyAmount: ecScalar.weeklyAmount ?? undefined,
            startupBalance: ecScalar.startupBalance ?? undefined,
            workMin: ecScalar.workMin ?? undefined,
            workMax: ecScalar.workMax ?? undefined,
            workCooldown: ecScalar.workCooldown ?? undefined,
            robberyEnabled: ecScalar.robberyEnabled ?? undefined,
            robberyMaxAmount: ecScalar.robberyMaxAmount ?? undefined,
            robberyCooldown: ecScalar.robberyCooldown ?? undefined,
            interestRate: ecScalar.interestRate ?? undefined,
            interestInterval: ecScalar.interestInterval ?? undefined,
            bankCapacity: ecScalar.bankCapacity ?? undefined,
          },
          create: { guildId, ...ecScalar },
        });
        if (Array.isArray(shopItemsPayload)) {
          await prisma.shopItem.deleteMany({ where: { economySettingsId: economy.id } });
          if (shopItemsPayload.length > 0) {
            await prisma.shopItem.createMany({
              data: shopItemsPayload.map((item: any) => ({
                economySettingsId: economy.id,
                name: item.name,
                description: item.description ?? null,
                price: item.price,
                roleId: item.roleId ?? null,
              })),
            });
          }
        }
      }

      if (body.autoroles) {
        const ar = body.autoroles as Record<string, unknown>;
        const settings = await prisma.autoroleSettings.upsert({
          where: { guildId },
          update: { enabled: ar.enabled as boolean | undefined },
          create: { guildId, enabled: (ar.enabled as boolean) ?? false },
        });
        await prisma.autoroleEntry.deleteMany({ where: { settingsId: settings.id } });
        const entries: any[] = [];
        if (Array.isArray(ar.roleIds)) {
          for (const roleId of ar.roleIds) {
            entries.push({ settingsId: settings.id, guildId, roleId, type: 'JOIN' });
          }
        }
        if (Array.isArray(ar.botRoles)) {
          for (const roleId of ar.botRoles) {
            entries.push({ settingsId: settings.id, guildId, roleId, type: 'BOT' });
          }
        }
        if (entries.length > 0) {
          await prisma.autoroleEntry.createMany({ data: entries });
        }
      }

      if (body.levels) {
        const parsed = levelsSchema.safeParse(body.levels);
        if (!parsed.success) {
          return reply.status(400).send(error(parsed.error.errors.map(e => e.message).join(', ')));
        }
        const lv = parsed.data;
        await prisma.xPSettings.upsert({
          where: { guildId },
          update: {
            enabled: lv.enabled ?? undefined,
            xpPerMessageMin: lv.xpPerMessageMin ?? undefined,
            xpPerMessageMax: lv.xpPerMessageMax ?? undefined,
            voiceXp: lv.voiceXp ?? undefined,
            messageCooldown: lv.messageCooldown ?? undefined,
            voiceCooldown: lv.voiceCooldown ?? undefined,
            levelFormula: lv.levelFormula ?? undefined,
            maxLevel: lv.maxLevel ?? undefined,
            ignoredChannels: lv.ignoredChannels ? JSON.stringify(lv.ignoredChannels) : undefined,
            ignoredRoles: lv.ignoredRoles ? JSON.stringify(lv.ignoredRoles) : undefined,
            announcementChannelId: lv.announcementChannelId ?? undefined,
            announcementMessage: lv.announcementMessage ?? undefined,
          },
          create: {
            guildId,
            enabled: lv.enabled ?? true,
            xpPerMessageMin: lv.xpPerMessageMin ?? 15,
            xpPerMessageMax: lv.xpPerMessageMax ?? 25,
            voiceXp: lv.voiceXp ?? 10,
            messageCooldown: lv.messageCooldown ?? 60,
            voiceCooldown: lv.voiceCooldown ?? 120,
            levelFormula: lv.levelFormula ?? '100 * level * 1.5',
            maxLevel: lv.maxLevel ?? 1000,
            ignoredChannels: lv.ignoredChannels ? JSON.stringify(lv.ignoredChannels) : '[]',
            ignoredRoles: lv.ignoredRoles ? JSON.stringify(lv.ignoredRoles) : '[]',
            announcementChannelId: lv.announcementChannelId ?? null,
            announcementMessage: lv.announcementMessage ?? null,
          },
        });
        if (Array.isArray(lv.roleRewards)) {
          await prisma.xPRoleReward.deleteMany({ where: { guildId } });
          const rewards = lv.roleRewards.map((rr: any) => ({
            guildId,
            levelRequired: rr.level,
            roleId: rr.roleId,
            xpMultiplier: rr.xpMultiplier ?? 1.0,
          }));
          if (rewards.length > 0) {
            await prisma.xPRoleReward.createMany({ data: rewards });
          }
        }
      }

      if (body.welcome) {
        const parsed = welcomeSchema.safeParse(body.welcome);
        if (!parsed.success) {
          return reply.status(400).send(error(parsed.error.errors.map(e => e.message).join(', ')));
        }
        const w = parsed.data;
        await prisma.welcomeSettings.upsert({
          where: { guildId },
          update: {
            enabled: w.enabled,
            welcomeChannelId: w.welcomeChannelId,
            welcomeMessage: w.welcomeMessage,
            welcomeEmbed: w.welcomeEmbed,
            welcomeEmbedColor: w.welcomeEmbedColor,
            welcomeEmbedTitle: w.welcomeEmbedTitle,
            welcomeEmbedDescription: w.welcomeEmbedDescription,
            welcomeEmbedFooter: w.welcomeEmbedFooter,
            welcomeEmbedImage: w.welcomeEmbedImage,
            welcomeDM: w.welcomeDM,
            welcomeDMMessage: w.welcomeDMMessage,
            goodbyeEnabled: w.goodbyeEnabled,
            goodbyeChannelId: w.goodbyeChannelId,
            goodbyeMessage: w.goodbyeMessage,
            goodbyeEmbed: w.goodbyeEmbed,
            goodbyeEmbedColor: w.goodbyeEmbedColor,
            cardEnabled: w.cardEnabled,
            cardBackground: w.cardBackground,
            cardBgColor: w.cardBgColor,
            cardBgImage: w.cardBgImage,
            cardTextColor: w.cardTextColor,
            cardSubtextColor: w.cardSubtextColor,
            cardAccentColor: w.cardAccentColor,
            cardBlurBackground: w.cardBlurBackground,
            cardText: w.cardText,
            cardSubtext: w.cardSubtext,
          },
          create: { guildId, ...w },
        });
      }

      const logData = body.logSettings || body.logs;
      if (logData) {
        const ls = logData as Record<string, unknown>;
        const eventsList = ls.enabledEvents ?? ls.events;
        const ignoreCh = ls.ignoreChannels ?? ls.ignoredChannels;
        const ignoreUs = ls.ignoreUsers ?? ls.ignoredRoles;
        await prisma.logSettings.upsert({
          where: { guildId },
          update: {
            logChannelId: ls.logChannelId as string | undefined,
            events: Array.isArray(eventsList) ? JSON.stringify(eventsList) : undefined,
            ignoredChannels: Array.isArray(ignoreCh) ? JSON.stringify(ignoreCh) : undefined,
            ignoredRoles: Array.isArray(ignoreUs) ? JSON.stringify(ignoreUs) : undefined,
          },
          create: {
            guildId,
            logChannelId: (ls.logChannelId as string) ?? null,
            events: Array.isArray(eventsList) ? JSON.stringify(eventsList) : '[]',
            ignoredChannels: Array.isArray(ignoreCh) ? JSON.stringify(ignoreCh) : '[]',
            ignoredRoles: Array.isArray(ignoreUs) ? JSON.stringify(ignoreUs) : '[]',
          },
        });
      }

      if (body.embeds && Array.isArray(body.embeds)) {
        await prisma.$transaction([
          prisma.savedEmbed.deleteMany({ where: { guildId } }),
          ...body.embeds.map((e: any) =>
            prisma.savedEmbed.create({
              data: {
                id: e.id ?? undefined,
                guildId,
                name: e.name,
                title: e.title ?? null,
                description: e.description ?? null,
                color: e.color ?? '#e0e0e0',
                fields: Array.isArray(e.fields) ? JSON.stringify(e.fields) : '[]',
                footer: e.footer ?? null,
                image: e.image ?? null,
                thumbnail: e.thumbnail ?? null,
                authorName: e.authorName ?? null,
                authorIcon: e.authorIcon ?? null,
                timestamp: e.timestamp ?? true,
              },
            })
          ),
        ]);
      }

      if (body.protection) {
        const parsed = protectionSchema.safeParse(body.protection);
        if (!parsed.success) {
          return reply.status(400).send(error(parsed.error.errors.map(e => e.message).join(', ')));
        }
        const p = parsed.data;
        await prisma.protectionSettings.upsert({
          where: { guildId },
          update: {
            enabled: p.enabled ?? undefined,
            antiRaid: p.antiRaid ?? undefined,
            raidThreshold: p.raidThreshold ?? undefined,
            raidInterval: p.raidInterval ?? undefined,
            antiSpam: p.antiSpam ?? undefined,
            spamThreshold: p.spamThreshold ?? undefined,
            spamInterval: p.spamInterval ?? undefined,
            antiMassMention: p.antiMassMention ?? undefined,
            mentionThreshold: p.mentionThreshold ?? undefined,
            antiLink: p.antiLink ?? undefined,
            antiAlts: p.antiAlts ?? undefined,
            altAccountAge: p.altAccountAge ?? undefined,
            verificationLevel: p.verificationLevel ?? undefined,
            captchaVerification: p.captchaVerification ?? undefined,
            punishment: p.punishment ?? undefined,
            emergencyMode: p.emergencyMode ?? undefined,
          },
          create: { guildId, ...p },
        });
      }

      const settingsPayload = body.settings || body.guild;
      if (settingsPayload) {
        const s = settingsPayload as Record<string, unknown>;
        await prisma.guildSettings.upsert({
          where: { guildId },
          update: {
            prefix: s.prefix as string | undefined,
            locale: s.locale as string | undefined,
            timezone: s.timezone as string | undefined,
            modLogChannel: s.modLogChannel as string | undefined,
            modRoleIds: Array.isArray(s.modRoleIds) ? JSON.stringify(s.modRoleIds) : undefined,
            adminRoleIds: Array.isArray(s.adminRoleIds) ? JSON.stringify(s.adminRoleIds) : undefined,
            muteRoleId: s.muteRoleId as string | undefined,
            dashboardAccessRoles: Array.isArray(s.dashboardAccessRoles) ? JSON.stringify(s.dashboardAccessRoles) : undefined,
            dashboardModerationAccess: Array.isArray(s.dashboardModerationAccess) ? JSON.stringify(s.dashboardModerationAccess) : undefined,
            dashboardTicketsAccess: Array.isArray(s.dashboardTicketsAccess) ? JSON.stringify(s.dashboardTicketsAccess) : undefined,
            dashboardPollsAccess: Array.isArray(s.dashboardPollsAccess) ? JSON.stringify(s.dashboardPollsAccess) : undefined,
            dashboardSuggestionsAccess: Array.isArray(s.dashboardSuggestionsAccess) ? JSON.stringify(s.dashboardSuggestionsAccess) : undefined,
            dashboardGiveawaysAccess: Array.isArray(s.dashboardGiveawaysAccess) ? JSON.stringify(s.dashboardGiveawaysAccess) : undefined,
            dashboardEconomyAccess: Array.isArray(s.dashboardEconomyAccess) ? JSON.stringify(s.dashboardEconomyAccess) : undefined,
            dashboardMusicAccess: Array.isArray(s.dashboardMusicAccess) ? JSON.stringify(s.dashboardMusicAccess) : undefined,
            dashboardLevelsAccess: Array.isArray(s.dashboardLevelsAccess) ? JSON.stringify(s.dashboardLevelsAccess) : undefined,
            dashboardWelcomeAccess: Array.isArray(s.dashboardWelcomeAccess) ? JSON.stringify(s.dashboardWelcomeAccess) : undefined,
            dashboardAutorolesAccess: Array.isArray(s.dashboardAutorolesAccess) ? JSON.stringify(s.dashboardAutorolesAccess) : undefined,
            dashboardLogsAccess: Array.isArray(s.dashboardLogsAccess) ? JSON.stringify(s.dashboardLogsAccess) : undefined,
            dashboardProtectionAccess: Array.isArray(s.dashboardProtectionAccess) ? JSON.stringify(s.dashboardProtectionAccess) : undefined,
            dashboardAuditAccess: Array.isArray(s.dashboardAuditAccess) ? JSON.stringify(s.dashboardAuditAccess) : undefined,
          },
          create: {
            guildId,
            prefix: (s.prefix as string) ?? null,
            locale: (s.locale as string) ?? 'fr',
            timezone: (s.timezone as string) ?? 'Europe/Paris',
            modLogChannel: (s.modLogChannel as string) ?? null,
            modRoleIds: Array.isArray(s.modRoleIds) ? JSON.stringify(s.modRoleIds) : '[]',
            adminRoleIds: Array.isArray(s.adminRoleIds) ? JSON.stringify(s.adminRoleIds) : '[]',
            muteRoleId: (s.muteRoleId as string) ?? null,
            dashboardAccessRoles: Array.isArray(s.dashboardAccessRoles) ? JSON.stringify(s.dashboardAccessRoles) : '[]',
            dashboardModerationAccess: Array.isArray(s.dashboardModerationAccess) ? JSON.stringify(s.dashboardModerationAccess) : '[]',
            dashboardTicketsAccess: Array.isArray(s.dashboardTicketsAccess) ? JSON.stringify(s.dashboardTicketsAccess) : '[]',
            dashboardPollsAccess: Array.isArray(s.dashboardPollsAccess) ? JSON.stringify(s.dashboardPollsAccess) : '[]',
            dashboardSuggestionsAccess: Array.isArray(s.dashboardSuggestionsAccess) ? JSON.stringify(s.dashboardSuggestionsAccess) : '[]',
            dashboardGiveawaysAccess: Array.isArray(s.dashboardGiveawaysAccess) ? JSON.stringify(s.dashboardGiveawaysAccess) : '[]',
            dashboardEconomyAccess: Array.isArray(s.dashboardEconomyAccess) ? JSON.stringify(s.dashboardEconomyAccess) : '[]',
            dashboardMusicAccess: Array.isArray(s.dashboardMusicAccess) ? JSON.stringify(s.dashboardMusicAccess) : '[]',
            dashboardLevelsAccess: Array.isArray(s.dashboardLevelsAccess) ? JSON.stringify(s.dashboardLevelsAccess) : '[]',
            dashboardWelcomeAccess: Array.isArray(s.dashboardWelcomeAccess) ? JSON.stringify(s.dashboardWelcomeAccess) : '[]',
            dashboardAutorolesAccess: Array.isArray(s.dashboardAutorolesAccess) ? JSON.stringify(s.dashboardAutorolesAccess) : '[]',
            dashboardLogsAccess: Array.isArray(s.dashboardLogsAccess) ? JSON.stringify(s.dashboardLogsAccess) : '[]',
            dashboardProtectionAccess: Array.isArray(s.dashboardProtectionAccess) ? JSON.stringify(s.dashboardProtectionAccess) : '[]',
            dashboardAuditAccess: Array.isArray(s.dashboardAuditAccess) ? JSON.stringify(s.dashboardAuditAccess) : '[]',
          },
        });
      }

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
        economy: {
          enabled: es.enabled, currencyName: es.currencyName, currencySymbol: es.currencySymbol,
          dailyAmount: es.dailyAmount, weeklyAmount: es.weeklyAmount, startupBalance: es.startupBalance,
          workMin: es.workMin, workMax: es.workMax, workCooldown: es.workCooldown,
          robberyEnabled: es.robberyEnabled, robberyMaxAmount: es.robberyMaxAmount,
          robberyCooldown: es.robberyCooldown, interestRate: es.interestRate,
          interestInterval: es.interestInterval, bankCapacity: es.bankCapacity,
          shopItems: (es as { shopItems?: Array<Record<string, unknown>> }).shopItems?.map((i) => ({
            id: i.id as string, name: i.name as string, description: i.description as string | null, price: i.price as number, roleId: i.roleId as string | null,
          })) ?? [],
        },
        protection: guild.protectionSettings || { enabled: false, emergencyMode: false, antiRaid: false, raidThreshold: 10, raidInterval: 10, antiSpam: false, spamThreshold: 5, spamInterval: 5, antiMassMention: false, mentionThreshold: 5, antiLink: false, antiAlts: false, altAccountAge: 7, verificationLevel: 'NONE', captchaVerification: false, punishment: 'KICK' },
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
          id: e.id, name: e.name, title: e.title, description: e.description,
          color: e.color, fields: JSON.parse(e.fields), footer: e.footer,
          image: e.image, thumbnail: e.thumbnail, timestamp: e.timestamp,
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
        suggestionChannelId: guild.settings?.suggestionChannelId ?? null,
      };
      reply.send(success({ guild: payload }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  // ─── Music ───
  app.get('/:guildId/music/queue', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const data = await getQueueState(guildId);
      reply.send(success(data));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/:guildId/music/control', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;
      await botControl(guildId, body.action as string, body.value);
      reply.send(success({ action: body.action }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/:guildId/music/history', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(q.limit ?? '20', 10) || 20));
      const [entries, total] = await Promise.all([
        prisma.musicHistoryEntry.findMany({
          where: { guildId }, orderBy: { playedAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
        }),
        prisma.musicHistoryEntry.count({ where: { guildId } }),
      ]);
      reply.send(success({ entries, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  // ─── Polls ───
  app.get('/:guildId/polls', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '20', 10) || 20));
      const [polls, total] = await Promise.all([
        prisma.poll.findMany({
          where: { guildId }, orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
          include: { votes: { select: { userId: true, optionIndex: true, user: { select: { discordId: true } } } } },
        }),
        prisma.poll.count({ where: { guildId } }),
      ]);
      const data = polls.map((p) => {
        const parsed = JSON.parse(p.options);
        const rawOptions = Array.isArray(parsed)
          ? parsed.map((o: any, i: number) => ({ id: String(i), label: typeof o === 'string' ? o : o.label, votes: 0 }))
          : [];
        const votesRecord: Record<string, string> = {};
        const voteCounts: number[] = new Array(rawOptions.length).fill(0);
        for (const v of p.votes) {
          const discordId = v.userId ? ((v as { user?: { discordId: string } }).user?.discordId ?? v.userId) : `anon_${v.optionIndex}`;
          if (p.anonymous) {
            voteCounts[v.optionIndex]++;
          } else {
            votesRecord[discordId] = String(v.optionIndex);
            voteCounts[v.optionIndex]++;
          }
        }
        return {
          id: p.id, guildId: p.guildId, channelId: p.channelId,
          question: p.question,
          options: rawOptions.map((o, i) => ({ id: String(i), label: o.label, votes: voteCounts[i] })),
          votes: votesRecord,
          status: p.status === 'OPEN' ? 'ACTIVE' : 'CLOSED' as const,
          anonymous: p.anonymous, multiChoice: p.multiChoice,
          endsAt: p.endsAt?.toISOString() ?? null,
        };
      });
      reply.send(success({
        polls: data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/:guildId/polls', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;
      if (!body.question || !(body.options as Array<unknown>)?.length)
        return reply.status(400).send(error('Question et options requises'));
      const channelId = body.channelId as string;
      if (!channelId) return reply.status(400).send(error('channelId requis pour publier le sondage sur Discord'));

      let msg: any = null;
      if (channelId) {
        const options = (body.options as string[]).map((o: string) => ({ id: o, label: o }));
        const descLines = options.map((o: any, i: number) => `${NUMBER_EMOJIS[i] || `${i + 1}.`} ${o.label}`).join('\n');
        try {
          msg = await sendChannelMessage(channelId, {
            embeds: [{
              title: `📊 ${body.question}`,
              description: descLines,
              color: 0x00AAFF,
              footer: { text: 'Réagissez pour voter' },
              timestamp: new Date().toISOString(),
            }],
          });
          const emojis = options.slice(0, 10).map((_: unknown, i: number) => NUMBER_EMOJIS[i]);
          for (const emoji of emojis) {
            await addMessageReaction(channelId, msg.id, emoji);
            await new Promise((r) => setTimeout(r, 350));
          }
        } catch {
          return reply.status(500).send(error('Impossible de poster le sondage sur Discord'));
        }
      }
      const endsAt = body.duration ? new Date(Date.now() + (body.duration as number) * 60 * 1000) : null;

      const poll = await prisma.poll.create({
        data: {
          guildId, channelId: channelId || '',
          messageId: msg?.id || null,
          question: body.question as string,
          options: JSON.stringify((body.options as string[]).map((o: string, i: number) => ({ id: String(i), label: o, votes: 0 }))),
          status: 'OPEN',
          anonymous: (body.anonymous as boolean) ?? false,
          multiChoice: (body.multiChoice as boolean) ?? false,
          endsAt,
        },
      });
      reply.status(201).send(success(poll, 'Sondage créé'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/:guildId/polls/:id', { preHandler: [authenticate, validateParams(pollIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as { guildId: string; id: string };
      const body = request.body as Record<string, unknown>;
      const p = await prisma.poll.findFirst({ where: { id, guildId }, include: { votes: true } });
      if (!p) return reply.status(404).send(error('Sondage introuvable'));
      const upd: any = {};
      if (body.status) upd.status = body.status === 'CLOSED' ? 'CLOSED' : 'OPEN';
      const updated = await prisma.poll.update({ where: { id }, data: upd });
      if (body.status === 'CLOSED' && p.messageId && !p.channelId.startsWith('pending')) {
        const parsed = JSON.parse(p.options);
        const rawOptions = Array.isArray(parsed)
          ? parsed.map((o: any, i: number) => ({ id: String(i), label: typeof o === 'string' ? o : o.label, votes: 0 }))
          : [];
        const voteCounts = new Array(rawOptions.length).fill(0);
        for (const v of (p.votes || [])) voteCounts[v.optionIndex]++;
        const descLines = rawOptions.map((o: any, i: number) =>
          `${NUMBER_EMOJIS[i] || `${i + 1}.`} ${o.label} — **${voteCounts[i]}** vote(s)`
        ).join('\n');
        await editMessage(p.channelId, p.messageId, {
          embeds: [{
            title: `📊 ${p.question} (Terminé)`,
            description: descLines,
            color: 0x808080,
            footer: { text: 'Sondage fermé' },
            timestamp: new Date().toISOString(),
          }],
        }).catch(() => {});
      }
      reply.send(success({
        ...updated,
        options: JSON.parse(updated.options),
        endsAt: updated.endsAt?.toISOString() ?? null,
      }, 'Sondage mis à jour'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.delete('/:guildId/polls/:id', { preHandler: [authenticate, validateParams(pollIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as { guildId: string; id: string };
      const p = await prisma.poll.findFirst({ where: { id, guildId } });
      if (!p) return reply.status(404).send(error('Sondage introuvable'));
      await prisma.pollVote.deleteMany({ where: { pollId: id } });
      await prisma.poll.delete({ where: { id } });
      reply.send(success(null, 'Sondage supprimé'));
    } catch (err: unknown) {
      console.error('[POLL DELETE ERROR]', err);
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  // ─── Giveaways ───
  app.get('/:guildId/giveaways', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '20', 10) || 20));
      const [giveaways, total] = await Promise.all([
        prisma.giveaway.findMany({
          where: { guildId }, orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
          include: { _count: { select: { entries: true } } },
        }),
        prisma.giveaway.count({ where: { guildId } }),
      ]);
      const data = giveaways.map((g) => ({
        ...g,
        entryCount: g._count.entries,
        entries: [] as string[],
      }));
      reply.send(success({
        giveaways: data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/:guildId/giveaways/:id/stats', { preHandler: [authenticate, validateParams(giveawayIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as { guildId: string; id: string };
      const g = await prisma.giveaway.findFirst({
        where: { id, guildId },
        include: {
          entries: { include: { user: { select: { id: true, discordId: true, username: true, avatar: true } } } },
        },
      });
      if (!g) return reply.status(404).send(error('Giveaway introuvable'));
      let winnerUsers: { id: string; username: string }[] = [];
      if (g.winners) {
        try {
          const ids = JSON.parse(g.winners) as string[];
          winnerUsers = await Promise.all(
            ids.map(async (discordId) => {
              const u = await prisma.user.findUnique({ where: { discordId } });
              return { id: discordId, username: u?.username ?? discordId };
            })
          );
        } catch { /* ignore */ }
      }
      reply.send(success({
        giveaway: g,
        entryCount: g.entries.length,
        participants: g.entries.map((e) => ({
          userId: e.user?.discordId ?? e.userId,
          username: e.user?.username ?? e.userId,
          joinedAt: e.joinedAt,
        })),
        winners: winnerUsers,
      }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/:guildId/giveaways', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;
      if (!body.prize || !body.duration) return reply.status(400).send(error('Prize et durée requis'));
      const channelId = body.channelId as string;
      if (!channelId) return reply.status(400).send(error('channelId requis'));
      const endsAt = new Date(Date.now() + (body.duration as number) * 1000);
      let msg: any;
      try {
        msg = await sendChannelMessage(channelId, {
          embeds: [{
            title: '🎉 Giveaway',
            description: `**${body.prize}**\n\n**Gagnants :** ${body.winners || 1}\n**Se termine :** <t:${Math.floor(endsAt.getTime() / 1000)}:R>`,
            color: 0xFF00FF,
            timestamp: endsAt.toISOString(),
          }],
          components: [{
            type: 1,
            components: [{ type: 2, style: 3, custom_id: 'giveaway_join', label: '🎉 Participer' }],
          }],
        });
        await addMessageReaction(channelId, msg.id, '🎉').catch(() => {});
      } catch {
        return reply.status(500).send(error('Impossible de poster le giveaway sur Discord'));
      }
      const giveaway = await prisma.giveaway.create({
        data: {
          guildId, channelId,
          messageId: msg.id,
          prize: body.prize as string, winnerCount: (body.winners as number) || 1,
          duration: body.duration as number,
          endsAt,
          requiredRoleId: ((body.requirements as Record<string, unknown>)?.requiredRoleId as string) || null,
          requiredLevel: 0, requiredAccountAge: 0,
          status: 'RUNNING',
        },
      });
      reply.status(201).send(success(giveaway, 'Giveaway créé'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/:guildId/giveaways/:id', { preHandler: [authenticate, validateParams(giveawayIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as { guildId: string; id: string };
      const body = request.body as Record<string, unknown>;
      const g = await prisma.giveaway.findFirst({ where: { id, guildId } });
      if (!g) return reply.status(404).send(error('Giveaway introuvable'));

      if ((body.status === 'ENDED' || body.reroll) && g.messageId && !g.channelId.startsWith('pending')) {
        const entries = await prisma.giveawayEntry.findMany({
          where: { giveawayId: g.id },
          include: { user: { select: { discordId: true } } },
        });
        const userIds = entries.map((e) => e.user.discordId);
        const shuffled = [...userIds];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const winners = shuffled.slice(0, g.winnerCount);
        const winnersStr = winners.length > 0 ? winners.map(w => `<@${w}>`).join(', ') : 'Aucun participant';
        await editMessage(g.channelId, g.messageId, {
          embeds: [{
            title: '🎉 Giveaway terminé',
            description: `**${g.prize}**\n\n**Gagnant(s) :** ${winnersStr}`,
            color: 0x00FF00,
          }],
          components: [],
        }).catch(() => {});
        await prisma.giveaway.update({ where: { id }, data: { status: 'ENDED', endsAt: new Date(), winners: JSON.stringify(winners) } });
        return reply.send(success({ winners }, 'Giveaway terminé'));
      }

      if (body.status === 'CANCELLED' && g.messageId && !g.channelId.startsWith('pending')) {
        await editMessage(g.channelId, g.messageId, {
          embeds: [{ title: '🎉 Giveaway annulé', description: `**${g.prize}**\nCe giveaway a été annulé.`, color: 0xFF0000 }],
          components: [],
        }).catch(() => {});
        await prisma.giveaway.update({ where: { id }, data: { status: 'CANCELLED' } });
        return reply.send(success(null, 'Giveaway annulé'));
      }

      const upd: any = {};
      if (body.prize) upd.prize = body.prize;
      if (body.winnerCount) upd.winnerCount = body.winnerCount;
      const updated = await prisma.giveaway.update({ where: { id }, data: upd });
      reply.send(success(updated, 'Giveaway mis à jour'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.delete('/:guildId/giveaways/:id', { preHandler: [authenticate, validateParams(giveawayIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as { guildId: string; id: string };
      const g = await prisma.giveaway.findFirst({ where: { id, guildId } });
      if (!g) return reply.status(404).send(error('Giveaway introuvable'));
      await prisma.giveawayEntry.deleteMany({ where: { giveawayId: id } });
      await prisma.giveaway.delete({ where: { id } });
      reply.send(success(null, 'Giveaway supprimé'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  // ─── Suggestions ───
  app.post('/:guildId/suggestions/send', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;
      if (!body.content || !body.channelId) {
        return reply.status(400).send(error('content et channelId requis'));
      }
      const msg = await sendChannelMessage(body.channelId as string, {
        embeds: [{
          title: '💡 Nouvelle suggestion',
          description: body.content as string,
          color: 0x5865f2,
          footer: { text: 'Réagissez pour voter' },
          timestamp: new Date().toISOString(),
        }],
      });
      await addMessageReaction(body.channelId as string, msg.id, '✅');
      await new Promise((r) => setTimeout(r, 350));
      await addMessageReaction(body.channelId as string, msg.id, '❌');

      const authorDiscordId = request.user!.discordId;
      const suggestion = await prisma.suggestion.create({
        data: {
          guildId,
          channelId: body.channelId as string,
          messageId: msg.id,
          authorId: authorDiscordId,
          content: body.content as string,
          status: 'PENDING',
        },
      });
      reply.status(201).send(success(suggestion, 'Suggestion envoyée'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/:guildId/suggestions', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '20', 10) || 20));
      const where: any = { guildId };
      if (q.status) where.status = q.status;
      const [rawSuggestions, total] = await Promise.all([
        prisma.suggestion.findMany({
          where, orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
          include: { author: { select: { username: true, avatar: true } } },
        }),
        prisma.suggestion.count({ where }),
      ]);
      const suggestions = rawSuggestions.map((s) => ({
        id: s.id, guildId: s.guildId, channelId: s.channelId, authorId: s.authorId,
        content: s.content,
        votes: { up: s.upvotes, down: s.downvotes },
        status: s.status,
        staffResponse: s.staffResponse ? { moderatorId: s.staffResponderId || '', response: s.staffResponse, action: s.status as string } : null,
      }));
      reply.send(success({
        suggestions,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/:guildId/suggestions/:id', { preHandler: [authenticate, validateParams(suggestionIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as { guildId: string; id: string };
      const body = request.body as Record<string, unknown>;
      const s = await prisma.suggestion.findFirst({ where: { id, guildId } });
      if (!s) return reply.status(404).send(error('Suggestion introuvable'));
      const upd: any = {};
      if (body.status) upd.status = body.status;
      if (body.staffResponse) { upd.staffResponse = body.staffResponse; upd.staffResponderId = request.user!.id; }
      const updated = await prisma.suggestion.update({ where: { id }, data: upd });
      if (body.status) {
        sendDM(s.authorId, {
          embeds: [{
            title: body.status === 'APPROVED' ? '💡 Suggestion approuvée ✅' : body.status === 'REJECTED' ? '💡 Suggestion refusée ❌' : 'Suggestion mise à jour',
            description: `Ta suggestion a été ${body.status === 'APPROVED' ? 'approuvée' : 'refusée'} :\n\n${s.content}`,
            fields: [
              { name: 'Votes', value: `👍 ${s.upvotes} | 👎 ${s.downvotes}`, inline: false },
              ...(body.staffResponse ? [{ name: 'Réponse du staff', value: body.staffResponse as string, inline: false }] : []),
            ],
            color: body.status === 'APPROVED' ? 0x00FF00 : 0xFF0000,
            timestamp: new Date().toISOString(),
          }],
        }).catch(() => {});
      }
      if (body.status && s.messageId && !s.channelId.startsWith('pending')) {
        const statusEmoji = body.status === 'APPROVED' ? '✅' : body.status === 'REJECTED' ? '❌' : '⏳';
        const statusLabel = body.status === 'APPROVED' ? 'Approuvée' : body.status === 'REJECTED' ? 'Refusée' : 'En attente';
        await editMessage(s.channelId, s.messageId, {
          embeds: [{
            title: `💡 Suggestion ${statusLabel} ${statusEmoji}`,
            description: s.content,
            fields: [
              { name: 'Statut', value: statusLabel, inline: true },
              { name: 'Réponse du staff', value: (body.staffResponse as string) || 'Aucune réponse', inline: false },
            ],
            color: body.status === 'APPROVED' ? 0x00FF00 : body.status === 'REJECTED' ? 0xFF0000 : 0xFFA500,
            timestamp: new Date().toISOString(),
          }],
        }).catch(() => {});
      }
      reply.send(success(updated, 'Suggestion mise à jour'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/:guildId/suggestions/:id/respond', { preHandler: [authenticate, validateParams(suggestionIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as { guildId: string; id: string };
      const body = request.body as Record<string, unknown>;
      const s = await prisma.suggestion.findFirst({ where: { id, guildId } });
      if (!s) return reply.status(404).send(error('Suggestion introuvable'));
      const action = body.action as string;
      const staffResponse = body.response as string;
      if (!action || !staffResponse) return reply.status(400).send(error('action et response requis'));
      const upd: any = { status: action, staffResponse, staffResponderId: request.user!.id };
      const updated = await prisma.suggestion.update({ where: { id }, data: upd });
      sendDM(s.authorId, {
        embeds: [{
          title: action === 'APPROVED' ? '💡 Suggestion approuvée ✅' : '💡 Suggestion refusée ❌',
          description: `Ta suggestion a été ${action === 'APPROVED' ? 'approuvée' : 'refusée'} :\n\n${s.content}`,
          fields: [
            { name: 'Votes', value: `👍 ${s.upvotes} | 👎 ${s.downvotes}`, inline: false },
            { name: 'Réponse du staff', value: staffResponse, inline: false },
          ],
          color: action === 'APPROVED' ? 0x00FF00 : 0xFF0000,
          timestamp: new Date().toISOString(),
        }],
      }).catch(() => {});
      if (s.messageId && !s.channelId.startsWith('pending')) {
        const statusEmoji = action === 'APPROVED' ? '✅' : action === 'REJECTED' ? '❌' : '⏳';
        const statusLabel = action === 'APPROVED' ? 'Approuvée' : action === 'REJECTED' ? 'Refusée' : 'En attente';
        await editMessage(s.channelId, s.messageId, {
          embeds: [{
            title: `💡 Suggestion ${statusLabel} ${statusEmoji}`,
            description: s.content,
            fields: [
              { name: 'Statut', value: statusLabel, inline: true },
              { name: 'Réponse du staff', value: staffResponse, inline: false },
            ],
            color: action === 'APPROVED' ? 0x00FF00 : action === 'REJECTED' ? 0xFF0000 : 0xFFA500,
            timestamp: new Date().toISOString(),
          }],
        }).catch(() => {});
      }
      reply.send(success(updated, 'Réponse enregistrée'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/:guildId/suggestions/:id/vote', { preHandler: [authenticate, validateParams(suggestionIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as { guildId: string; id: string };
      const discordId = request.user!.discordId;
      const isMember = await getGuildMember(guildId, discordId).then(() => true).catch(() => false);
      if (!isMember) return reply.status(403).send(error('Vous devez être membre du serveur pour voter'));
      const body = request.body as Record<string, unknown>;
      const vote = body.vote as string;
      if (!['up', 'down'].includes(vote)) return reply.status(400).send(error('Vote invalide'));
      const s = await prisma.suggestion.findFirst({ where: { id, guildId } });
      if (!s || s.status !== 'PENDING') return reply.status(400).send(error('Suggestion introuvable ou déjà traitée'));
      const voters: Record<string, 'up' | 'down'> = JSON.parse(s.voters || '{}');
      if (voters[discordId] === vote) {
        delete voters[discordId];
      } else {
        voters[discordId] = vote as 'up' | 'down';
      }
      const upvotes = Object.values(voters).filter((v) => v === 'up').length;
      const downvotes = Object.values(voters).filter((v) => v === 'down').length;
      const updated = await prisma.suggestion.update({
        where: { id },
        data: { upvotes, downvotes, voters: JSON.stringify(voters) },
      });
      reply.send(success(updated, 'Vote enregistré'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.delete('/:guildId/suggestions/:id', { preHandler: [authenticate, validateParams(suggestionIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as { guildId: string; id: string };
      const s = await prisma.suggestion.findFirst({ where: { id, guildId } });
      if (!s) return reply.status(404).send(error('Suggestion introuvable'));
      await prisma.suggestion.delete({ where: { id } });
      reply.send(success(null, 'Suggestion supprimée'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  // ─── Auto-modération ───
  app.get('/:guildId/automod', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      let settings = await prisma.autoModSettings.findUnique({ where: { guildId } });
      if (!settings) {
        settings = await prisma.autoModSettings.create({ data: { guildId } });
      }
      reply.send(success(settings));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.patch('/:guildId/automod', { preHandler: [authenticate, requireGuildAdmin, validateParams(guildIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;
      const arrayFields = [
        'bannedWordsList', 'forbiddenPingRoles', 'forbiddenMarkdownList',
        'whitelistRoles', 'whitelistChannels',
      ];
      const data: Record<string, unknown> = { ...body };
      for (const f of arrayFields) {
        if (Array.isArray(body[f])) data[f] = JSON.stringify(body[f]);
      }
      const settings = await prisma.autoModSettings.upsert({
        where: { guildId },
        update: data,
        create: { guildId, ...data },
      });
      const { invalidateBotAutoModCache } = await import('../../services/bot-proxy');
      await invalidateBotAutoModCache(guildId).catch(() => {});
      reply.send(success(settings, 'Auto-modération mise à jour'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/:guildId/automod/history', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
      const perPage = Math.min(100, Math.max(1, parseInt(q.perPage ?? '20', 10) || 20));
      const typeFilter = q.type as string | undefined;

      const where: Record<string, unknown> = { guildId, action: { in: ['AUTO_MOD_VIOLATION', 'AUTO_MOD_SANCTION'] } };
      if (typeFilter) {
        where.details = { contains: `"type":"${typeFilter}"` };
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * perPage,
          take: perPage,
          include: { user: { select: { username: true, avatar: true } } },
        }),
        prisma.auditLog.count({ where }),
      ]);

      const entries = logs.map((log: any) => {
        let details: Record<string, unknown> = {};
        try { details = JSON.parse(log.details || '{}'); } catch { details = {}; }
        return {
          id: log.id,
          userId: log.userId,
          username: log.user?.username || null,
          action: log.action === 'AUTO_MOD_SANCTION' ? ((details.sanction as string) || 'WARN') : 'DELETE',
          reason: (details.reason as string) || null,
          type: (details.type as string) || 'SPAM',
          channelId: (details.channelId as string) || null,
          createdAt: log.createdAt,
        };
      });

      reply.send(success({ entries, pagination: { page, limit: perPage, total, totalPages: Math.ceil(total / perPage) } }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  // ─── Forms ───
  app.get('/:guildId/forms', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      let settings = await prisma.formSettings.findUnique({
        where: { guildId },
        include: { templates: true },
      });
      if (!settings) {
        settings = await prisma.formSettings.create({
          data: { guildId, enabled: false },
          include: { templates: true },
        });
      }
      reply.send(success({ settings }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/:guildId/forms', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;
      const settings = await prisma.formSettings.upsert({
        where: { guildId },
        update: {
          enabled: body.enabled as boolean | undefined,
          channelId: body.channelId !== undefined ? (body.channelId as string) : undefined,
          logChannel: body.logChannel !== undefined ? (body.logChannel as string) : undefined,
        },
        create: {
          guildId,
          enabled: (body.enabled as boolean) ?? false,
          channelId: (body.channelId as string) ?? null,
          logChannel: (body.logChannel as string) ?? null,
        },
        include: { templates: true },
      });
      reply.send(success({ settings }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/:guildId/forms/templates', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;
      if (!body.name) return reply.status(400).send(error('Le nom du formulaire est requis'));
      await prisma.formSettings.upsert({
        where: { guildId },
        update: {},
        create: { guildId, enabled: false },
      });
      const template = await prisma.formTemplate.create({
        data: {
          guildId,
          name: body.name as string,
          description: (body.description as string) ?? null,
          fields: JSON.stringify(body.fields ?? []),
          enabled: (body.enabled as boolean) ?? true,
        },
      });
      reply.status(201).send(success({ template }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/:guildId/forms/templates/:templateId', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { templateId } = request.params as { templateId: string };
      const body = request.body as Record<string, unknown>;
      const data: Record<string, unknown> = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.description !== undefined) data.description = body.description;
      if (body.fields !== undefined) data.fields = JSON.stringify(body.fields);
      if (body.enabled !== undefined) data.enabled = body.enabled;
      const template = await prisma.formTemplate.update({
        where: { id: templateId },
        data,
      });
      reply.send(success({ template }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.delete('/:guildId/forms/templates/:templateId', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { templateId } = request.params as { templateId: string };
      await prisma.formTemplate.delete({ where: { id: templateId } });
      reply.send(success(null, 'Formulaire supprimé'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/:guildId/forms/submissions', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(q.limit ?? '20', 10) || 20));
      const status = q.status ?? undefined;
      const where: any = { guildId };
      if (status) where.status = status;
      const [submissions, total] = await Promise.all([
        prisma.formSubmission.findMany({
          where, orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
        }),
        prisma.formSubmission.count({ where }),
      ]);
      const templateIds = [...new Set(submissions.map((s) => s.templateId))];
      const templates = await prisma.formTemplate.findMany({
        where: { id: { in: templateIds } },
        select: { id: true, name: true },
      });
      const templateMap = new Map(templates.map((t) => [t.id, t.name]));
      const userIds = [...new Set(submissions.map((s) => s.userId))];
      const users = await prisma.user.findMany({
        where: { discordId: { in: userIds } },
        select: { discordId: true, username: true, avatar: true },
      });
      const userMap = new Map(users.map((u) => [u.discordId, u]));
      const enriched = submissions.map((s) => ({
        ...s,
        responses: JSON.parse(s.responses),
        templateName: templateMap.get(s.templateId) ?? 'Inconnu',
        user: userMap.get(s.userId) ?? { discordId: s.userId, username: s.userId, avatar: null },
      }));
      reply.send(success({ submissions: enriched, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.patch('/:guildId/forms/submissions/:submissionId', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { submissionId } = request.params as { submissionId: string };
      const body = request.body as Record<string, unknown>;
      const data: Record<string, unknown> = {};
      if (body.status !== undefined) data.status = body.status;
      if (body.reviewedBy !== undefined) data.reviewedBy = body.reviewedBy;
      if (body.status === 'approved' || body.status === 'rejected') {
        data.reviewedAt = new Date();
        data.reviewedBy = data.reviewedBy ?? (request as { user?: { discordId?: string } }).user?.discordId;
      }
      const submission = await prisma.formSubmission.update({
        where: { id: submissionId },
        data,
      });
      reply.send(success({ submission }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  // ─── Starboard ───
  app.get('/:guildId/starboard', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      let settings = await prisma.starboardSettings.findUnique({ where: { guildId } });
      if (!settings) {
        settings = await prisma.starboardSettings.create({
          data: { guildId, enabled: false, starEmoji: '\u2B50', minStars: 3, selfStar: false },
        });
      }
      reply.send(success({ settings }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/:guildId/starboard', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;
      const derivedEnabled =
        (body.enabled as boolean) ?? (body.channelId !== undefined ? !!body.channelId : undefined);
      const settings = await prisma.starboardSettings.upsert({
        where: { guildId },
        update: {
          enabled: derivedEnabled,
          channelId: body.channelId !== undefined ? (body.channelId as string) : undefined,
          starEmoji: body.starEmoji as string | undefined,
          minStars: body.minStars !== undefined ? parseInt(body.minStars as string, 10) : undefined,
          selfStar: body.selfStar as boolean | undefined,
        },
        create: {
          guildId,
          enabled: derivedEnabled ?? false,
          channelId: (body.channelId as string) ?? null,
          starEmoji: (body.starEmoji as string) ?? '\u2B50',
          minStars: (body.minStars as number) ?? 3,
          selfStar: (body.selfStar as boolean) ?? false,
        },
      });
      reply.send(success({ settings }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/:guildId/starboard/entries', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(q.limit ?? '20', 10) || 20));
      const [entries, total] = await Promise.all([
        prisma.starboardEntry.findMany({
          where: { guildId }, orderBy: { starCount: 'desc' },
          skip: (page - 1) * limit, take: limit,
        }),
        prisma.starboardEntry.count({ where: { guildId } }),
      ]);
      const authorIds = [...new Set(entries.map((e) => e.authorId))];
      const users = await prisma.user.findMany({
        where: { discordId: { in: authorIds } },
        select: { discordId: true, username: true, avatar: true },
      });
      const userMap = new Map(users.map((u) => [u.discordId, u]));
      const enriched = entries.map((e) => ({
        ...e,
        author: userMap.get(e.authorId) ?? { discordId: e.authorId, username: e.authorId, avatar: null },
      }));
      reply.send(success({ entries: enriched, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  // ─── Clans ───
  app.get('/:guildId/clans', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const clans = await prisma.clan.findMany({
        where: { guildId },
        include: { members: true },
        orderBy: { createdAt: 'desc' },
      });
      const enriched = await Promise.all(clans.map(async (clan) => {
        const userIds = clan.members.map((m) => m.userId);
        const profiles = userIds.length > 0
          ? await prisma.xPProfile.findMany({ where: { guildId, userId: { in: userIds } } })
          : [];
        const totalXp = profiles.reduce((s, p) => s + p.xp, 0);
        const wallets = userIds.length > 0
          ? await prisma.economyWallet.findMany({ where: { guildId, userId: { in: userIds } } })
          : [];
        const totalWallet = wallets.reduce((s, w) => s + w.wallet + w.bank, 0);
        return {
          ...clan,
          memberCount: clan.members.length,
          totalXp,
          totalWallet,
          members: clan.members.map((m) => ({ ...m, username: '', avatar: null })),
        };
      }));
      const enrichedWithUsers = await Promise.all(enriched.map(async (clan) => {
        const userIds = clan.members.map((m) => m.userId);
        const users = userIds.length > 0
          ? await prisma.user.findMany({ where: { discordId: { in: userIds } }, select: { discordId: true, username: true, avatar: true } })
          : [];
        const userMap = new Map(users.map((u) => [u.discordId, u]));
        return {
          ...clan,
          members: clan.members.map((m) => ({
            ...m,
            username: userMap.get(m.userId)?.username ?? m.userId,
            avatar: userMap.get(m.userId)?.avatar ?? null,
          })),
        };
      }));
      const sorted = enrichedWithUsers.sort((a, b) => b.totalXp - a.totalXp);
      reply.send(success({ clans: sorted }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  // ─── Minigames ───
  app.get('/:guildId/minigames', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      let settings = await prisma.minigameSettings.findUnique({ where: { guildId } });
      if (!settings) settings = await prisma.minigameSettings.create({ data: { guildId } });
      reply.send(success({ settings }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/:guildId/minigames', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;
      const toInt = (v: any) => (v === undefined || v === null || v === '' ? undefined : parseInt(v, 10));
      const data = {
        gamesChannelId: body.gamesChannelId !== undefined ? ((body.gamesChannelId as string) || null) : undefined,
        enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
        betMin: toInt(body.betMin),
        betMax: toInt(body.betMax),
        blackjackReward: toInt(body.blackjackReward),
        rpsReward: toInt(body.rpsReward),
        morpionReward: toInt(body.morpionReward),
        guessReward: toInt(body.guessReward),
        guessRange: toInt(body.guessRange),
      };
      const settings = await prisma.minigameSettings.upsert({
        where: { guildId },
        update: data,
        create: { guildId, ...data },
      });
      reply.send(success({ settings }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/:guildId/minigames/leaderboard', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const q = request.query as Record<string, string | undefined>;
      const limit = Math.min(50, Math.max(1, parseInt(q.limit ?? '20', 10) || 10));
      const grouped = await prisma.minigameSession.groupBy({
        by: ['userId'],
        where: { guildId, status: { not: 'active' } },
        _sum: { payout: true },
        _count: { _all: true },
      });
      const ranked = grouped
        .map((g) => ({ userId: g.userId, winnings: g._sum.payout ?? 0, games: g._count._all }))
        .sort((a, b) => b.winnings - a.winnings)
        .slice(0, limit);
      const userIds = ranked.map((r) => r.userId);
      const users = await prisma.user.findMany({
        where: { discordId: { in: userIds } },
        select: { discordId: true, username: true, avatar: true },
      });
      const userMap = new Map(users.map((u) => [u.discordId, u]));
      const entries = ranked.map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        username: userMap.get(r.userId)?.username ?? r.userId,
        avatar: userMap.get(r.userId)?.avatar ?? null,
        winnings: r.winnings,
        games: r.games,
      }));
      reply.send(success({ entries }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  // ─── Sub-router registrations ───
  await app.register(settingsRoutes, { prefix: '/:guildId/settings' });
  await app.register(moderationRoutes, { prefix: '/:guildId/moderation' });
  await app.register(ticketsRoutes, { prefix: '/:guildId/tickets' });
  await app.register(economyRoutes, { prefix: '/:guildId/economy' });
  await app.register(levelsRoutes, { prefix: '/:guildId/levels' });
  await app.register(welcomeRoutes, { prefix: '/:guildId/welcome' });
  await app.register(protectionRoutes, { prefix: '/:guildId/protection' });
  await app.register(backupRoutes, { prefix: '/:guildId/backup' });
  await app.register(membersRoutes, { prefix: '/:guildId' });
}
