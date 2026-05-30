import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@pinguin/db';
import { getConfig } from '@pinguin/config';
import { authenticate } from '../middleware/auth';
import { requireGuildAdmin } from '../middleware/guild-auth';
import { validateParams, validateBody } from '../middleware/validate';
import { success, error, sanitizeError } from '../utils/response';
import { getQueueState, botControl, botPlay, notifyModuleChange, createTicketChannel, leaveGuildViaBot, invalidateBotAutoModCache } from '../services/bot-proxy';
import { closeTicketWithTranscript } from '../services/ticket-close';
import { sendDM, timeoutMember, kickMember, banMember, unbanMember, sendChannelMessage, editMessage, addMessageReaction, createGuildChannel, deleteChannel, editChannel, getGuildChannels, getGuildRoles, getChannelMessages, getGuildMember, getBotUserId, PERM_VIEW_CHANNEL, PERM_SEND_MESSAGES, PERM_READ_HISTORY, PERM_MANAGE_CHANNELS, NUMBER_EMOJIS } from '../services/discord';
import { z } from 'zod';

const config = getConfig();

const guildIdSchema = z.object({ guildId: z.string().min(1) });
const ticketIdSchema = z.object({ guildId: z.string().min(1), ticketId: z.string().min(1) });
const embedIdSchema = z.object({ guildId: z.string().min(1), id: z.string().min(1) });
const suggestionIdSchema = z.object({ guildId: z.string().min(1), id: z.string().min(1) });
const giveawayIdSchema = z.object({ guildId: z.string().min(1), id: z.string().min(1) });
const pollIdSchema = z.object({ guildId: z.string().min(1), id: z.string().min(1) });

const autoroleSchema = z.object({
  enabled: z.boolean().optional(),
  roleIds: z.array(z.string()).optional(),
  botRoles: z.array(z.string()).optional(),
});

const guildParam = { preHandler: [authenticate, validateParams(guildIdSchema)] };

export async function guildRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const allGuilds = await prisma.guild.findMany({
        select: {
          id: true, name: true, icon: true, ownerId: true, memberCount: true,
          botPresent: true, settings: true,
        },
        orderBy: [{ botPresent: 'desc' }, { memberCount: 'desc' }],
      });
      const userDiscordId = request.user!.discordId;
      // Concurrency-limited checks (max 10 simultaneous Discord API calls)
      const concurrency = 10;
      const results: (typeof allGuilds[0] & { isMember: boolean; hasDashboardAccess: boolean })[] = [];
      for (let i = 0; i < allGuilds.length; i += concurrency) {
        const batch = allGuilds.slice(i, i + concurrency);
        const batchResults = await Promise.all(
          batch.map(async (g) => {
            const member = await getGuildMember(g.id, userDiscordId).catch(() => null);
            if (!member) return { ...g, isMember: false, hasDashboardAccess: false };
            
            const isOwner = g.ownerId === userDiscordId;
            const roles = await getGuildRoles(g.id).catch(() => [] as any[]);
            const memberRoleIds: string[] = Array.isArray(member.roles) ? member.roles : [];
            let permissions = BigInt(0);
            for (const role of roles) {
              if (memberRoleIds.includes(role.id)) {
                permissions |= BigInt(role.permissions ?? 0);
              }
            }
            const ADMINISTRATOR = BigInt(0x8);
            const isAdmin = (permissions & ADMINISTRATOR) !== BigInt(0);
            
            // Check role-based dashboard access
            const dashboardAccessRoles = g.settings ? JSON.parse(g.settings.dashboardAccessRoles || '[]') : [];
            const hasDashboardAccess = isOwner || isAdmin || dashboardAccessRoles.some((r: string) => memberRoleIds.includes(r));
            
            return { ...g, isMember: true, hasDashboardAccess };
          })
        );
        results.push(...batchResults);
      }
      const guilds = results.filter(g => g.isMember && g.hasDashboardAccess);
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
    } catch (err: any) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  const MODULE_FIELDS = ['moderation','protection','tickets','logs','levels','economy','music','giveaways','polls','suggestions','welcome','autoroles','embeds','minigames','starboard','forms'] as const;
  const MODULE_DEFAULTS: Record<string, boolean> = {
    moderation: true, protection: true, tickets: true, logs: true,
    levels: true, economy: false, music: true, giveaways: true,
    polls: true, suggestions: true, welcome: true, autoroles: true, embeds: true,
    minigames: true, starboard: false, forms: false,
  };

  function computeDisabledModules(modulesEnabled: any): string[] {
    return MODULE_FIELDS
      .filter(f => modulesEnabled ? !modulesEnabled[f] : !MODULE_DEFAULTS[f])
      .map(f => f.toUpperCase());
  }

  const defaultEconomy = () => ({
    enabled: false, currencyName: 'pièces', currencySymbol: '🪙',
    dailyAmount: 200, weeklyAmount: 1000, startupBalance: 100,
    workMin: 10, workMax: 50, workCooldown: 60,
    robberyEnabled: false, robberyMaxAmount: 500, robberyCooldown: 3600,
    interestRate: 5, interestInterval: 86400, bankCapacity: 50000,
    shopItems: [],
  });

  function mapLogsPayload(logSettings: { logChannelId: string | null; events: string; ignoredChannels: string; ignoredRoles: string } | null, modules?: { logs?: boolean } | null) {
    const events = logSettings ? JSON.parse(logSettings.events || '[]') : [];
    return {
      enabled: modules?.logs ?? true,
      logChannelId: logSettings?.logChannelId ?? null,
      enabledEvents: events,
      ignoreChannels: logSettings ? JSON.parse(logSettings.ignoredChannels || '[]') : [],
      ignoreUsers: logSettings ? JSON.parse(logSettings.ignoredRoles || '[]') : [],
    };
  }

  async function getEconomySettings(guildId: string) {
    let es = await prisma.economySettings.findUnique({
      where: { guildId },
      include: { shopItems: true },
    });
    if (!es) {
      es = await prisma.economySettings.create({
        data: { guildId },
        include: { shopItems: true },
      });
    }
    return es;
  }

  app.get('/:guildId', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
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
          shopItems: (es as any).shopItems?.map((i: any) => ({
            id: i.id, name: i.name, description: i.description, price: i.price, roleId: i.roleId,
          })) ?? [],
        },
        levels: guild.xpSettings ? {
          enabled: guild.xpSettings.enabled,
          messageXp: guild.xpSettings.messageXp,
          voiceXp: guild.xpSettings.voiceXp,
          messageCooldown: guild.xpSettings.messageCooldown,
          voiceCooldown: guild.xpSettings.voiceCooldown,
          levelFormula: guild.xpSettings.levelFormula,
          maxLevel: guild.xpSettings.maxLevel,
          ignoredChannels: JSON.parse(guild.xpSettings.ignoredChannels),
          ignoredRoles: JSON.parse(guild.xpSettings.ignoredRoles),
          announcementChannelId: guild.xpSettings.announcementChannelId,
          announcementMessage: guild.xpSettings.announcementMessage,
          roleRewards: [],
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
      };
      reply.send(success({ guild: payload }));
    } catch (err: any) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/:guildId/channels', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const channels = await getGuildChannels(guildId);
      reply.send(success({ channels }));
    } catch (err: any) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/:guildId/roles', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const roles = await getGuildRoles(guildId);
      reply.send(success({ roles }));
    } catch (err: any) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.put('/:guildId', { preHandler: [authenticate, requireGuildAdmin, validateParams(guildIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;

      // -- disabledModules --
      if (Array.isArray(body.disabledModules)) {
        const data: Record<string, boolean> = {};
        for (const f of MODULE_FIELDS) {
          data[f] = !body.disabledModules.map((m: string) => m.toLowerCase()).includes(f);
        }
        await prisma.moduleEnabled.upsert({
          where: { guildId },
          update: data,
          create: { guildId, ...data },
        });
        try {
          await notifyModuleChange(guildId, body.disabledModules);
        } catch {
          // bot offline, DB already updated, bot will reload on next restart
        }
      }

      // -- economy --
      if (body.economy) {
        const ec = body.economy;
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

      // -- autoroles --
      if (body.autoroles) {
        const ar = body.autoroles;
        const settings = await prisma.autoroleSettings.upsert({
          where: { guildId },
          update: { enabled: ar.enabled ?? undefined },
          create: { guildId, enabled: ar.enabled ?? false },
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

      // -- levels --
      if (body.levels) {
        const lv = body.levels;
        await prisma.xPSettings.upsert({
          where: { guildId },
          update: {
            enabled: lv.enabled ?? undefined,
            messageXp: lv.messageXp ?? undefined,
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
            messageXp: lv.messageXp ?? 15,
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
          }));
          if (rewards.length > 0) {
            await prisma.xPRoleReward.createMany({ data: rewards });
          }
        }
      }

      // -- welcome --
      if (body.welcome) {
        const w = body.welcome;
        await prisma.welcomeSettings.upsert({
          where: { guildId },
          update: {
            enabled: w.enabled ?? undefined,
            welcomeChannelId: w.welcomeChannelId ?? undefined,
            welcomeMessage: w.welcomeMessage ?? undefined,
            welcomeEmbed: w.welcomeEmbed ?? undefined,
            welcomeEmbedColor: w.welcomeEmbedColor ?? undefined,
            welcomeEmbedTitle: w.welcomeEmbedTitle ?? undefined,
            welcomeEmbedDescription: w.welcomeEmbedDescription ?? undefined,
            welcomeEmbedFooter: w.welcomeEmbedFooter ?? undefined,
            welcomeEmbedImage: w.welcomeEmbedImage ?? undefined,
            welcomeDM: w.welcomeDM ?? w.dmWelcome ?? undefined,
            welcomeDMMessage: w.welcomeDMMessage ?? w.dmWelcomeMessage ?? undefined,
            goodbyeEnabled: w.goodbyeEnabled ?? undefined,
            goodbyeChannelId: w.goodbyeChannelId ?? undefined,
            goodbyeMessage: w.goodbyeMessage ?? undefined,
            goodbyeEmbed: w.goodbyeEmbed ?? undefined,
            goodbyeEmbedColor: w.goodbyeEmbedColor ?? undefined,
          },
          create: { guildId, ...w },
        });
      }

      // -- logSettings (also accepts body.logs) --
      const logData = body.logSettings || body.logs;
      if (logData) {
        const ls = logData;
        const eventsList = ls.enabledEvents ?? ls.events;
        const ignoreCh = ls.ignoreChannels ?? ls.ignoredChannels;
        const ignoreUs = ls.ignoreUsers ?? ls.ignoredRoles;
        await prisma.logSettings.upsert({
          where: { guildId },
          update: {
            logChannelId: ls.logChannelId ?? undefined,
            events: Array.isArray(eventsList) ? JSON.stringify(eventsList) : undefined,
            ignoredChannels: Array.isArray(ignoreCh) ? JSON.stringify(ignoreCh) : undefined,
            ignoredRoles: Array.isArray(ignoreUs) ? JSON.stringify(ignoreUs) : undefined,
          },
          create: {
            guildId,
            logChannelId: ls.logChannelId ?? null,
            events: Array.isArray(eventsList) ? JSON.stringify(eventsList) : '[]',
            ignoredChannels: Array.isArray(ignoreCh) ? JSON.stringify(ignoreCh) : '[]',
            ignoredRoles: Array.isArray(ignoreUs) ? JSON.stringify(ignoreUs) : '[]',
          },
        });
      }

      // -- embeds --
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

      // -- protection --
      if (body.protection) {
        const p = body.protection;
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

      // -- settings (general guild settings) --
      if (body.settings) {
        const s = body.settings;
        await prisma.guildSettings.upsert({
          where: { guildId },
          update: {
            prefix: s.prefix ?? undefined,
            locale: s.locale ?? undefined,
            timezone: s.timezone ?? undefined,
            modLogChannel: s.modLogChannel ?? undefined,
            modRoleIds: Array.isArray(s.modRoleIds) ? JSON.stringify(s.modRoleIds) : undefined,
            adminRoleIds: Array.isArray(s.adminRoleIds) ? JSON.stringify(s.adminRoleIds) : undefined,
            muteRoleId: s.muteRoleId ?? undefined,
            dashboardAccessRoles: Array.isArray(s.dashboardAccessRoles) ? JSON.stringify(s.dashboardAccessRoles) : undefined,
          },
          create: {
            guildId,
            prefix: s.prefix ?? null,
            locale: s.locale ?? 'fr',
            timezone: s.timezone ?? 'Europe/Paris',
            modLogChannel: s.modLogChannel ?? null,
            modRoleIds: Array.isArray(s.modRoleIds) ? JSON.stringify(s.modRoleIds) : '[]',
            adminRoleIds: Array.isArray(s.adminRoleIds) ? JSON.stringify(s.adminRoleIds) : '[]',
            muteRoleId: s.muteRoleId ?? null,
            dashboardAccessRoles: Array.isArray(s.dashboardAccessRoles) ? JSON.stringify(s.dashboardAccessRoles) : '[]',
          },
        });
      }

      // -- re-fetch and return --
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
          shopItems: (es as any).shopItems?.map((i: any) => ({
            id: i.id, name: i.name, description: i.description, price: i.price, roleId: i.roleId,
          })) ?? [],
        },
        protection: guild.protectionSettings || { enabled: false, emergencyMode: false, antiRaid: false, raidThreshold: 10, raidInterval: 10, antiSpam: false, spamThreshold: 5, spamInterval: 5, antiMassMention: false, mentionThreshold: 5, antiLink: false, antiAlts: false, altAccountAge: 7, verificationLevel: 'NONE', captchaVerification: false, punishment: 'KICK' },
        levels: guild.xpSettings ? {
          enabled: guild.xpSettings.enabled, messageXp: guild.xpSettings.messageXp,
          voiceXp: guild.xpSettings.voiceXp, messageCooldown: guild.xpSettings.messageCooldown,
          voiceCooldown: guild.xpSettings.voiceCooldown, levelFormula: guild.xpSettings.levelFormula,
          maxLevel: guild.xpSettings.maxLevel, ignoredChannels: JSON.parse(guild.xpSettings.ignoredChannels),
          ignoredRoles: JSON.parse(guild.xpSettings.ignoredRoles),
          announcementChannelId: guild.xpSettings.announcementChannelId,
          announcementMessage: guild.xpSettings.announcementMessage,
          roleRewards: (guild as any).xpRoleRewards?.map((rr: any) => ({ level: rr.levelRequired, roleId: rr.roleId })) ?? [],
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
      };
      reply.send(success({ guild: payload }));
    } catch (err: any) {
      reply.status(500).send(error(sanitizeError(err)));
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
      reply.status(500).send(error(sanitizeError(err)));
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
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/:guildId/modules', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      let modules = await prisma.moduleEnabled.findUnique({ where: { guildId } });
      if (!modules) modules = await prisma.moduleEnabled.create({ data: { guildId } });
      reply.send(success({ modules }));
    } catch (err: any) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.put('/:guildId/modules', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      const fields = ['moderation','protection','tickets','logs','levels','economy','music','giveaways','polls','suggestions','welcome','autoroles','embeds','minigames','starboard','forms'];
      const data: any = {};
      for (const f of fields) { if (typeof body[f] === 'boolean') data[f] = body[f]; }
      if (Object.keys(data).length > 0) {
        await prisma.moduleEnabled.upsert({ where: { guildId }, update: data, create: { guildId, ...data } });
      }
      reply.send(success(null, 'Modules mis à jour'));
    } catch (err: any) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.patch('/:guildId/modules/:moduleKey', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, moduleKey } = request.params as any;
      const { enabled } = request.body as any;
      const validModules = ['moderation','protection','tickets','logs','levels','economy','music','giveaways','polls','suggestions','welcome','autoroles','embeds','minigames','starboard','forms'];
      if (!validModules.includes(moduleKey)) return reply.status(400).send(error('Module inconnu'));
      await prisma.moduleEnabled.upsert({
        where: { guildId },
        update: { [moduleKey]: enabled },
        create: { guildId, [moduleKey]: enabled },
      });
      // Notify the bot of the module change
      const allModules = await prisma.moduleEnabled.findUnique({ where: { guildId } });
      const disabled = allModules ? validModules.filter((m) => !(allModules as any)[m]) : [];
      try { await notifyModuleChange(guildId, disabled); } catch {}
      reply.send(success({ moduleKey, enabled }, 'Module mis à jour'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/:guildId/my-permissions', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const discordId = request.user!.discordId;
      const member = await getGuildMember(guildId, discordId).catch(() => null);
      if (!member) return reply.status(403).send(error('Membre introuvable dans ce serveur'));
      const roles = await getGuildRoles(guildId).catch(() => [] as any[]);
      const guild = await prisma.guild.findUnique({ where: { id: guildId }, include: { settings: true } });
      const memberRoleIds: string[] = Array.isArray(member.roles) ? member.roles : [];
      let permissions = BigInt(0);
      for (const role of roles) {
        if (memberRoleIds.includes(role.id)) {
          permissions |= BigInt(role.permissions ?? 0);
        }
      }
      const isOwner = guild?.ownerId === discordId;
      if (isOwner) permissions = BigInt('9007199254740991');
      const ADMINISTRATOR = BigInt(0x8);
      const MANAGE_GUILD = BigInt(0x20);
      const MANAGE_ROLES = BigInt(0x10000000);
      const MANAGE_MESSAGES = BigInt(0x2000);
      const isAdmin = (permissions & ADMINISTRATOR) !== BigInt(0);
      
      // Check role-based dashboard access
      const settings = guild?.settings;
      const dashboardAccessRoles = settings ? JSON.parse(settings.dashboardAccessRoles || '[]') : [];
      const hasDashboardAccess = isOwner || isAdmin || dashboardAccessRoles.some((r: string) => memberRoleIds.includes(r));
      
      // Module-specific access
      const hasAccess = (accessField: string) => {
        if (isOwner || isAdmin) return true;
        const accessRoles = settings ? JSON.parse((settings as any)[accessField] || '[]') : [];
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
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/:guildId/moderation', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
      const where = { guildId, deletedAt: null } as any;
      const [modCases, total] = await Promise.all([
        prisma.moderationCase.findMany({
          where, orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
          include: { user: { select: { username: true, avatar: true } } },
        }),
        prisma.moderationCase.count({ where }),
      ]);
      reply.send(success({
        cases: modCases,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
    } catch (err: any) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  async function ensureUser(discordId: string) {
    const existing = await prisma.user.findUnique({ where: { discordId } });
    if (existing) return existing;
    return prisma.user.create({ data: { discordId, username: discordId } });
  }

  app.delete('/:guildId/moderation/:caseId', { preHandler: [authenticate, validateParams(z.object({ guildId: z.string(), caseId: z.string() }))] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, caseId } = request.params as any;
      const modCase = await prisma.moderationCase.findFirst({ where: { id: caseId, guildId } });
      if (!modCase) return reply.status(404).send(error('Cas introuvable'));
      await prisma.moderationCase.update({ where: { id: caseId }, data: { deletedAt: new Date() } });
      await prisma.auditLog.create({
        data: {
          guildId, action: 'MODERATION_CASE_DELETED',
          userId: request.user!.id,
          details: JSON.stringify({ caseId, targetUserId: modCase.userId }),
        },
      }).catch(() => {});
      reply.send(success(null, 'Cas supprimé'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/:guildId/moderation', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      const type = body.type as string;
      if (!type || !body.userId || !body.reason)
        return reply.status(400).send(error('Type, utilisateur et raison requis'));
      await ensureUser(body.userId);

      const moderatorTag = request.user!.username || 'Dashboard';
      const reason = body.reason;
      const durationMs = body.duration ? body.duration * 1000 : null;

      switch (type) {
        case 'WARN':
          await sendDM(body.userId, {
            embeds: [{
              title: 'Avertissement',
              description: `Vous avez reçu un avertissement sur le serveur.\nRaison : ${reason}`,
              color: 0xFFA500,
              timestamp: new Date().toISOString(),
            }],
          }).catch(() => {});
          break;
        case 'MUTE':
        case 'TIMEOUT':
          await timeoutMember(guildId, body.userId, durationMs);
          await sendDM(body.userId, {
            embeds: [{
              title: 'Mute',
              description: `Vous avez été rendu muet.\nRaison : ${reason}${durationMs ? `\nDurée : ${Math.round(durationMs / 60000)} minutes` : ''}`,
              color: 0xFF0000,
              timestamp: new Date().toISOString(),
            }],
          }).catch(() => {});
          break;
        case 'UNMUTE':
          await timeoutMember(guildId, body.userId, null);
          break;
        case 'KICK':
          await kickMember(guildId, body.userId, `Expulsé par ${moderatorTag}: ${reason}`);
          await sendDM(body.userId, {
            embeds: [{
              title: 'Expulsion',
              description: `Vous avez été expulsé du serveur.\nRaison : ${reason}`,
              color: 0xFF0000,
              timestamp: new Date().toISOString(),
            }],
          }).catch(() => {});
          break;
        case 'BAN':
        case 'TEMPBAN':
          await banMember(guildId, body.userId, `Banni par ${moderatorTag}: ${reason}`);
          await sendDM(body.userId, {
            embeds: [{
              title: 'Bannissement',
              description: `Vous avez été banni du serveur.\nRaison : ${reason}${type === 'TEMPBAN' && durationMs ? `\nDurée : ${Math.round(durationMs / 3600000)} heures` : ''}`,
              color: 0xFF0000,
              timestamp: new Date().toISOString(),
            }],
          }).catch(() => {});
          break;
        case 'UNBAN':
          await unbanMember(guildId, body.userId, `Débanni par ${moderatorTag}: ${reason}`);
          break;
        default:
          return reply.status(400).send(error(`Type de modération inconnu: ${type}`));
      }

      const modCase = await prisma.moderationCase.create({
        data: {
          guildId, userId: body.userId, moderatorId: request.user!.discordId,
          type, reason,
          duration: body.duration ? body.duration * 60 : null, // web sends minutes → store as seconds
          expiresAt: body.duration ? new Date(Date.now() + body.duration * 60 * 1000) : null,
        },
      });
      reply.status(201).send(success(modCase, 'Action exécutée sur Discord'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
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
      reply.send(success({
        tickets,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/:guildId/tickets', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      if (!body.subject) return reply.status(400).send(error('Sujet requis'));
      const creatorId = body.creatorId || request.user!.discordId;
      await ensureUser(creatorId);
      const catId = body.categoryId || undefined;
      const botUserId = await getBotUserId();
      const memberPerms = `${PERM_VIEW_CHANNEL}|${PERM_SEND_MESSAGES}|${PERM_READ_HISTORY}`;
      const botPerms = `${PERM_VIEW_CHANNEL}|${PERM_SEND_MESSAGES}|${PERM_READ_HISTORY}|${PERM_MANAGE_CHANNELS}`;
      let channel: any;
      try {
        channel = await createGuildChannel(guildId, {
          name: `ticket-${body.subject.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 32)}`,
          type: 0,
          parent_id: catId,
          permission_overwrites: [
            { id: guildId, type: 0, deny: PERM_VIEW_CHANNEL },
            { id: creatorId, type: 1, allow: memberPerms },
            { id: botUserId, type: 1, allow: botPerms },
          ],
          topic: `Ticket: ${body.subject}`,
        });
      } catch {
        return reply.status(500).send(error('Impossible de créer le channel ticket sur Discord'));
      }
      await sendChannelMessage(channel.id, {
        content: `<@${creatorId}>`,
        embeds: [{
          title: '🎫 Ticket — Support',
          description: `**Sujet :** ${body.subject}${body.description ? `\n**Description :** ${body.description}` : ''}\nUn membre de l'équipe va vous répondre sous peu.`,
          color: 0x00AAFF,
          timestamp: new Date().toISOString(),
        }],
        components: [{
          type: 1,
          components: [
            { type: 2, style: 4, custom_id: 'ticket_close', label: 'Fermer', emoji: { name: '🔒' } },
            { type: 2, style: 3, custom_id: 'ticket_claim', label: 'Claim', emoji: { name: '🤚' } },
          ],
        }],
      });
      const ticket = await prisma.ticket.create({
        data: {
          guildId, channelId: channel.id, creatorId,
          subject: body.subject, description: body.description || null,
          categoryId: body.categoryId || null, status: 'OPEN',
        },
      });
      reply.status(201).send(success(ticket, 'Ticket créé'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/:guildId/tickets/:ticketId', { preHandler: [authenticate, validateParams(ticketIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, ticketId } = request.params as any;
      const body = request.body as any;
      const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, guildId } });
      if (!ticket) return reply.status(404).send(error('Ticket introuvable'));
      const upd: any = {};
      const action = body.action || (body.status ? 'status' : null);
      if (action === 'close' || action === 'CLOSED') {
        upd.status = 'CLOSED'; upd.closedAt = new Date(); upd.closedById = request.user!.discordId;
      } else if (action === 'claim' || action === 'CLAIMED') {
        upd.status = 'CLAIMED'; upd.claimedById = body.claimedById || request.user!.discordId;
      } else if (action === 'unclaim') {
        upd.status = 'OPEN'; upd.claimedById = null;
      } else if (body.status) {
        upd.status = body.status;
      }
      if (body.claimedById !== undefined && !upd.claimedById) upd.claimedById = body.claimedById;
      const updated = await prisma.ticket.update({ where: { id: ticketId }, data: upd });
      if (upd.status === 'CLOSED') {
        const guild = await prisma.guild.findUnique({ where: { id: guildId }, select: { name: true } });
        await closeTicketWithTranscript(ticketId, request.user!.discordId, {
          guildName: guild?.name,
        }).catch(() => {});
      }
      if (upd.claimedById && ticket.channelId && !ticket.channelId.startsWith('pending-')) {
        await editChannel(ticket.channelId, { name: `claimed-${ticket.subject.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 24)}` }).catch(() => {});
        await sendChannelMessage(ticket.channelId, {
          embeds: [{ title: 'Ticket réclamé', description: `Ce ticket a été réclamé par <@${upd.claimedById}>.`, color: 0x00FF00, timestamp: new Date().toISOString() }],
        }).catch(() => {});
      }
      if (upd.claimedById === null && ticket.channelId && !ticket.channelId.startsWith('pending-')) {
        await editChannel(ticket.channelId, { name: `ticket-${ticket.subject.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 24)}` }).catch(() => {});
        await sendChannelMessage(ticket.channelId, {
          embeds: [{ title: 'Ticket non réclamé', description: `Ce ticket n'est plus réclamé.`, color: 0xFFA500, timestamp: new Date().toISOString() }],
        }).catch(() => {});
      }
      reply.send(success(updated, 'Ticket mis à jour'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/:guildId/logs', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      let ls = await prisma.logSettings.findUnique({ where: { guildId } });
      if (!ls) ls = await prisma.logSettings.create({ data: { guildId } });
      const modules = await prisma.moduleEnabled.findUnique({ where: { guildId } });
      reply.send(success(mapLogsPayload(ls, modules)));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/:guildId/logs', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      const eventsList = body.enabledEvents ?? body.events;
      const ignoreCh = body.ignoreChannels ?? body.ignoredChannels;
      const ignoreUs = body.ignoreUsers ?? body.ignoredRoles;
      await prisma.logSettings.upsert({
        where: { guildId },
        update: {
          logChannelId: body.logChannelId ?? undefined,
          events: Array.isArray(eventsList) ? JSON.stringify(eventsList) : undefined,
          ignoredChannels: Array.isArray(ignoreCh) ? JSON.stringify(ignoreCh) : undefined,
          ignoredRoles: Array.isArray(ignoreUs) ? JSON.stringify(ignoreUs) : undefined,
        },
        create: {
          guildId,
          logChannelId: body.logChannelId || null,
          events: Array.isArray(eventsList) ? JSON.stringify(eventsList) : '[]',
          ignoredChannels: Array.isArray(ignoreCh) ? JSON.stringify(ignoreCh) : '[]',
          ignoredRoles: Array.isArray(ignoreUs) ? JSON.stringify(ignoreUs) : '[]',
        },
      });
      reply.send(success(null, 'Logs mis à jour'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/:guildId/levels', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      let xp = await prisma.xPSettings.findUnique({ where: { guildId } });
      if (!xp) {
        await prisma.guild.upsert({
          where: { id: guildId },
          update: {},
          create: { id: guildId, name: guildId, ownerId: 'unknown', memberCount: 0 },
        });
        xp = await prisma.xPSettings.create({ data: { guildId } });
      }
      const rewards = await prisma.xPRoleReward.findMany({ where: { guildId }, orderBy: { levelRequired: 'asc' } });
      reply.send(success({ settings: xp, roleRewards: rewards }));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
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
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
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
      reply.send(success({
        entries,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
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
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/:guildId/economy', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const ec = request.body as any;
      await prisma.economySettings.upsert({
        where: { guildId },
        update: {
          enabled: ec.enabled, currencyName: ec.currencyName, currencySymbol: ec.currencySymbol,
          dailyAmount: ec.dailyAmount, weeklyAmount: ec.weeklyAmount, startupBalance: ec.startupBalance,
          workMin: ec.workMin, workMax: ec.workMax, workCooldown: ec.workCooldown,
          robberyEnabled: ec.robberyEnabled, robberyMaxAmount: ec.robberyMaxAmount,
          robberyCooldown: ec.robberyCooldown, interestRate: ec.interestRate,
          interestInterval: ec.interestInterval, bankCapacity: ec.bankCapacity,
        },
        create: { guildId, ...ec },
      });
      reply.send(success(null, 'Économie sauvegardée'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
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
        username: w.user?.username ?? w.userId, avatar: w.user?.avatar ?? null,
        wallet: w.wallet, bank: w.bank, totalEarned: w.totalEarned,
        guildId,
      }));
      reply.send(success({
        entries,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
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
      const data = giveaways.map((g) => ({
        ...g,
        entryCount: g._count.entries,
        entries: [] as string[],
      }));
      reply.send(success({
        giveaways: data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/:guildId/giveaways/:id/stats', { preHandler: [authenticate, validateParams(giveawayIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as any;
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
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/:guildId/giveaways', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      if (!body.prize || !body.duration) return reply.status(400).send(error('Prize et durée requis'));
      const channelId = body.channelId;
      if (!channelId) return reply.status(400).send(error('channelId requis'));
      const endsAt = new Date(Date.now() + body.duration * 1000);
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
          prize: body.prize, winnerCount: body.winners || 1,
          duration: body.duration,
          endsAt,
          requiredRoleId: body.requirements?.requiredRoleId || null,
          requiredLevel: 0, requiredAccountAge: 0,
          status: 'RUNNING',
        },
      });
      reply.status(201).send(success(giveaway, 'Giveaway créé'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/:guildId/giveaways/:id', { preHandler: [authenticate, validateParams(giveawayIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as any;
      const body = request.body as any;
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
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.delete('/:guildId/giveaways/:id', { preHandler: [authenticate, validateParams(giveawayIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as any;
      const g = await prisma.giveaway.findFirst({ where: { id, guildId } });
      if (!g) return reply.status(404).send(error('Giveaway introuvable'));
      await prisma.giveawayEntry.deleteMany({ where: { giveawayId: id } });
      await prisma.giveaway.delete({ where: { id } });
      reply.send(success(null, 'Giveaway supprimé'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
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
          const discordId = (v as { user?: { discordId: string } }).user?.discordId ?? v.userId;
          votesRecord[discordId] = String(v.optionIndex);
          voteCounts[v.optionIndex]++;
        }
        return {
          id: p.id,
          guildId: p.guildId,
          channelId: p.channelId,
          question: p.question,
          options: rawOptions.map((o, i) => ({ id: String(i), label: o.label, votes: voteCounts[i] })),
          votes: votesRecord,
          status: p.status === 'OPEN' ? 'ACTIVE' : 'CLOSED' as const,
        };
      });
      reply.send(success({
        polls: data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/:guildId/polls', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      if (!body.question || !body.options?.length)
        return reply.status(400).send(error('Question et options requises'));
      const channelId = body.channelId;
      if (!channelId) return reply.status(400).send(error('channelId requis pour publier le sondage sur Discord'));

      let msg: any = null;
      if (channelId) {
        const options = body.options.map((o: string) => ({ id: o, label: o }));
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
      const poll = await prisma.poll.create({
        data: {
          guildId, channelId: channelId || '',
          messageId: msg?.id || null,
          question: body.question,
          options: JSON.stringify(body.options.map((o: string, i: number) => ({ id: String(i), label: o, votes: 0 }))),
          status: 'OPEN',
        },
      });
      reply.status(201).send(success(poll, 'Sondage créé'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/:guildId/polls/:id', { preHandler: [authenticate, validateParams(pollIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as any;
      const body = request.body as any;
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
      reply.send(success({ ...updated, options: JSON.parse(updated.options) }, 'Sondage mis à jour'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.delete('/:guildId/polls/:id', { preHandler: [authenticate, validateParams(pollIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as any;
      const p = await prisma.poll.findFirst({ where: { id, guildId } });
      if (!p) return reply.status(404).send(error('Sondage introuvable'));
      await prisma.pollVote.deleteMany({ where: { pollId: id } });
      await prisma.poll.delete({ where: { id } });
      reply.send(success(null, 'Sondage supprimé'));
    } catch (err: any) {
      console.error('[POLL DELETE ERROR]', err);
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.post('/:guildId/suggestions/send', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      if (!body.content || !body.channelId) {
        return reply.status(400).send(error('content et channelId requis'));
      }
      const msg = await sendChannelMessage(body.channelId, {
        embeds: [{
          title: '💡 Nouvelle suggestion',
          description: body.content,
          color: 0x5865f2,
          footer: { text: 'Réagissez pour voter' },
          timestamp: new Date().toISOString(),
        }],
      });
      await addMessageReaction(body.channelId, msg.id, '✅');
      await new Promise((r) => setTimeout(r, 350));
      await addMessageReaction(body.channelId, msg.id, '❌');

      const authorDiscordId = request.user!.discordId;
      const suggestion = await prisma.suggestion.create({
        data: {
          guildId,
          channelId: body.channelId,
          messageId: msg.id,
          authorId: authorDiscordId,
          content: body.content,
          status: 'PENDING',
        },
      });
      reply.status(201).send(success(suggestion, 'Suggestion envoyée'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/:guildId/suggestions', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
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
        staffResponse: s.staffResponse ? { moderatorId: s.staffResponderId || '', response: s.staffResponse, action: s.status as any } : null,
      }));
      reply.send(success({
        suggestions,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
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
      if (body.status) {
        sendDM(s.authorId, {
          embeds: [{
            title: body.status === 'APPROVED' ? '💡 Suggestion approuvée ✅' : body.status === 'REJECTED' ? '💡 Suggestion refusée ❌' : 'Suggestion mise à jour',
            description: `Ta suggestion a été ${body.status === 'APPROVED' ? 'approuvée' : 'refusée'} :\n\n${s.content}`,
            fields: [
              { name: 'Votes', value: `👍 ${s.upvotes} | 👎 ${s.downvotes}`, inline: false },
              ...(body.staffResponse ? [{ name: 'Réponse du staff', value: body.staffResponse, inline: false }] : []),
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
              { name: 'Réponse du staff', value: body.staffResponse || 'Aucune réponse', inline: false },
            ],
            color: body.status === 'APPROVED' ? 0x00FF00 : body.status === 'REJECTED' ? 0xFF0000 : 0xFFA500,
            timestamp: new Date().toISOString(),
          }],
        }).catch(() => {});
      }
      reply.send(success(updated, 'Suggestion mise à jour'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/:guildId/suggestions/:id/respond', { preHandler: [authenticate, validateParams(suggestionIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as any;
      const body = request.body as any;
      const s = await prisma.suggestion.findFirst({ where: { id, guildId } });
      if (!s) return reply.status(404).send(error('Suggestion introuvable'));
      const action = body.action;
      const staffResponse = body.response;
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
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/:guildId/suggestions/:id/vote', { preHandler: [authenticate, validateParams(suggestionIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as any;
      const body = request.body as any;
      const vote = body.vote;
      if (!['up', 'down'].includes(vote)) return reply.status(400).send(error('Vote invalide'));
      const s = await prisma.suggestion.findFirst({ where: { id, guildId } });
      if (!s || s.status !== 'PENDING') return reply.status(400).send(error('Suggestion introuvable ou déjà traitée'));
      const voters: Record<string, 'up' | 'down'> = JSON.parse(s.voters || '{}');
      const discordId = request.user!.discordId;
      if (voters[discordId] === vote) {
        delete voters[discordId];
      } else {
        voters[discordId] = vote;
      }
      const upvotes = Object.values(voters).filter((v) => v === 'up').length;
      const downvotes = Object.values(voters).filter((v) => v === 'down').length;
      const updated = await prisma.suggestion.update({
        where: { id },
        data: { upvotes, downvotes, voters: JSON.stringify(voters) },
      });
      reply.send(success(updated, 'Vote enregistré'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.delete('/:guildId/suggestions/:id', { preHandler: [authenticate, validateParams(suggestionIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as any;
      const s = await prisma.suggestion.findFirst({ where: { id, guildId } });
      if (!s) return reply.status(404).send(error('Suggestion introuvable'));
      await prisma.suggestion.delete({ where: { id } });
      reply.send(success(null, 'Suggestion supprimée'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/:guildId/welcome', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      let welcome = await prisma.welcomeSettings.findUnique({ where: { guildId } });
      if (!welcome) welcome = await prisma.welcomeSettings.create({ data: { guildId } });
      reply.send(success({ settings: welcome }));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/:guildId/welcome', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      const welcomeDM = body.welcomeDM ?? body.dmWelcome ?? false;
      const welcomeDMMessage = body.welcomeDMMessage ?? body.dmWelcomeMessage ?? null;
      const data = {
        enabled: body.enabled ?? true,
        welcomeChannelId: body.welcomeChannelId ?? null,
        welcomeMessage: body.welcomeMessage ?? null,
        welcomeEmbed: body.welcomeEmbed ?? false,
        welcomeDM,
        welcomeDMMessage,
        goodbyeEnabled: body.goodbyeEnabled ?? true,
        goodbyeChannelId: body.goodbyeChannelId ?? null,
        goodbyeMessage: body.goodbyeMessage ?? null,
        goodbyeEmbed: body.goodbyeEmbed ?? false,
      };
      await prisma.welcomeSettings.upsert({
        where: { guildId },
        update: {
          enabled: data.enabled,
          welcomeChannelId: data.welcomeChannelId,
          welcomeMessage: data.welcomeMessage,
          welcomeEmbed: data.welcomeEmbed,
          goodbyeEnabled: data.goodbyeEnabled,
          goodbyeChannelId: data.goodbyeChannelId,
          goodbyeMessage: data.goodbyeMessage,
          goodbyeEmbed: data.goodbyeEmbed,
          welcomeDM: data.welcomeDM,
          welcomeDMMessage: data.welcomeDMMessage,
        },
        create: { guildId, ...data },
      });
      reply.send(success(null, 'Paramètres de bienvenue mis à jour'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  function transformAutoroleSettings(ar: any) {
    return {
      enabled: ar.enabled,
      roleIds: (ar.entries ?? []).filter((e: any) => e.type === 'JOIN').map((e: any) => e.roleId),
      botRoles: (ar.entries ?? []).filter((e: any) => e.type === 'BOT').map((e: any) => e.roleId),
      delay: 0,
      ignoreBots: false,
    };
  }

  app.get('/:guildId/autoroles', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      let ar = await prisma.autoroleSettings.findUnique({ where: { guildId }, include: { entries: true } });
      if (!ar) ar = await prisma.autoroleSettings.create({ data: { guildId }, include: { entries: true } });
      reply.send(success({ settings: transformAutoroleSettings(ar) }));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/:guildId/protection', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      let ps = await prisma.protectionSettings.findUnique({ where: { guildId } });
      if (!ps) ps = await prisma.protectionSettings.create({ data: { guildId } });
      reply.send(success({ settings: ps }));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/:guildId/protection', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      await prisma.protectionSettings.upsert({
        where: { guildId },
        update: {
          enabled: body.enabled ?? undefined,
          antiRaid: body.antiRaid ?? undefined,
          raidThreshold: body.raidThreshold ?? undefined,
          raidInterval: body.raidInterval ?? undefined,
          antiSpam: body.antiSpam ?? undefined,
          spamThreshold: body.spamThreshold ?? undefined,
          spamInterval: body.spamInterval ?? undefined,
          antiMassMention: body.antiMassMention ?? undefined,
          mentionThreshold: body.mentionThreshold ?? undefined,
          antiLink: body.antiLink ?? undefined,
          antiAlts: body.antiAlts ?? undefined,
          altAccountAge: body.altAccountAge ?? undefined,
          verificationLevel: body.verificationLevel ?? undefined,
          captchaVerification: body.captchaVerification ?? undefined,
          verifiedRoleId: body.verifiedRoleId ?? undefined,
          punishment: body.punishment ?? undefined,
        },
        create: { guildId, ...body },
      });
      reply.send(success(null, 'Protection mise à jour'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/:guildId/protection/emergency', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = (request.body as { enable?: boolean }) ?? {};
      const enable = body.enable !== false;
      await prisma.protectionSettings.upsert({
        where: { guildId },
        update: { emergencyMode: enable, enabled: enable ? true : undefined },
        create: { guildId, emergencyMode: enable, enabled: true },
      });
      const { botEmergencyMode } = await import('../services/bot-proxy');
      await botEmergencyMode(guildId, enable).catch(() => {});
      reply.send(success({ emergencyMode: enable }, enable ? 'Mode urgence activé' : 'Mode urgence désactivé'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/:guildId/autoroles', { preHandler: [authenticate, validateParams(guildIdSchema), validateBody(autoroleSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      await prisma.autoroleSettings.upsert({
        where: { guildId },
        update: { enabled: body.enabled ?? undefined },
        create: { guildId, enabled: body.enabled ?? true },
      });
      if (body.roleIds || body.botRoles) {
        const settings = await prisma.autoroleSettings.findUnique({ where: { guildId } });
        if (settings) {
          await prisma.autoroleEntry.deleteMany({ where: { guildId } });
          const joinRoles: string[] = body.roleIds ?? [];
          const botRoles: string[] = body.botRoles ?? [];
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
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/:guildId/embeds', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const embeds = await prisma.savedEmbed.findMany({ where: { guildId }, orderBy: { createdAt: 'desc' } });
      const data = embeds.map((e) => ({ ...e, fields: JSON.parse(e.fields) }));
      reply.send(success({ embeds: data }));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/:guildId/embeds', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as { embeds?: any[] };
      if (!Array.isArray(body.embeds)) {
        return reply.status(400).send(error('embeds (tableau) requis'));
      }
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
      reply.send(success(null, 'Embeds mis à jour'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  // Envoi d'un embed depuis le dashboard (UI) vers un salon.
  // Endpoint attendu par le frontend: POST /api/guilds/:guildId/embeds/send
  app.post('/:guildId/embeds/send', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      const channelId = body.channelId as string | undefined;
      const embedPreset = body.embed as any;

      if (!channelId) return reply.status(400).send(error('channelId requis'));
      if (!embedPreset) return reply.status(400).send(error('embed requis'));

      // Normalisation des champs attendus par discord.js EmbedBuilder
      const fields = Array.isArray(embedPreset.fields) ? embedPreset.fields : [];

      await sendChannelMessage(channelId, {
        embeds: [{
          title: embedPreset.title ?? undefined,
          description: embedPreset.description ?? undefined,
          color: typeof embedPreset.color === 'string' ? parseInt(embedPreset.color.replace('#', ''), 16) : embedPreset.color,
          fields: fields.map((f: any) => ({
            name: String(f.name ?? ''),
            value: String(f.value ?? ''),
            inline: Boolean(f.inline),
          })),
          footer: embedPreset.footer ? { text: String(embedPreset.footer) } : undefined,
          thumbnail: embedPreset.thumbnail ? { url: String(embedPreset.thumbnail) } : undefined,
          image: embedPreset.image ? { url: String(embedPreset.image) } : undefined,
          timestamp: embedPreset.timestamp ? new Date().toISOString() : undefined,
        }],
      });

      reply.send(success(null, 'Embed envoyé'));
    } catch (err: any) {
      reply.status(500).send(error(sanitizeError(err)));
    }
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
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
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
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.delete('/:guildId/embeds/:id', { preHandler: [authenticate, validateParams(embedIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as any;
      const embed = await prisma.savedEmbed.findFirst({ where: { id, guildId } });
      if (!embed) return reply.status(404).send(error('Embed introuvable'));
      await prisma.savedEmbed.delete({ where: { id } });
      reply.send(success(null, 'Embed supprimé'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
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
      reply.send(success({ entries: logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  // --- Music routes (proxy to bot internal API) ---

  app.get('/:guildId/music/queue', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const data = await getQueueState(guildId);
      reply.send(success(data));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/:guildId/music/control', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      await botControl(guildId, body.action, body.value);
      reply.send(success({ action: body.action }));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  // --- Ticket settings ---
  app.get('/:guildId/tickets/settings', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      let ts = await prisma.ticketSettings.findUnique({ where: { guildId } });
      if (!ts) ts = await prisma.ticketSettings.create({ data: { guildId } });
      reply.send(success({
        ...ts,
        moderatorRoles: JSON.parse(ts.moderatorRoles || '[]'),
        accessRoles: JSON.parse(ts.accessRoles || '[]'),
      }));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.patch('/:guildId/tickets/settings', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as Record<string, unknown>;
      const data: Record<string, unknown> = { ...body };
      if (Array.isArray(body.moderatorRoles)) data.moderatorRoles = JSON.stringify(body.moderatorRoles);
      if (Array.isArray(body.accessRoles)) data.accessRoles = JSON.stringify(body.accessRoles);
      const ts = await prisma.ticketSettings.upsert({
        where: { guildId },
        update: data,
        create: { guildId, ...data },
      });
      reply.send(success(ts, 'Paramètres tickets mis à jour'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  // --- Danger zone ---
  app.post('/:guildId/settings/reset', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
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
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/:guildId/settings/leave', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      await leaveGuildViaBot(guildId);
      await prisma.guild.update({ where: { id: guildId }, data: { botPresent: false } });
      reply.send(success(null, 'Bot retiré du serveur'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/:guildId/settings/delete-data', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
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
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/:guildId/members', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const q = request.query as any;
      const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 50));
      const after = q.after || '0';
      const members = await (await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members?limit=${limit}&after=${after}`,
        { headers: { Authorization: `Bot ${getConfig().DISCORD_TOKEN}` } }
      )).json() as any[];
      reply.send(success({
        members: members.map((m: any) => ({
          id: m.user.id,
          username: m.user.username,
          avatar: m.user.avatar,
          nick: m.nick,
        })),
      }));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  // --- Auto-modération ---
  app.get('/:guildId/automod', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      let settings = await prisma.autoModSettings.findUnique({ where: { guildId } });
      if (!settings) {
        settings = await prisma.autoModSettings.create({ data: { guildId } });
      }
      reply.send(success(settings));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.patch('/:guildId/automod', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
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
      await invalidateBotAutoModCache(guildId).catch(() => {});
      reply.send(success(settings, 'Auto-modération mise à jour'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/:guildId/leaderboard', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const q = request.query as any;
      const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 10));
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
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/:guildId/resolve-user/:userId', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, userId } = request.params as any;
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
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/:guildId/music/history', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
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

  // ─── Forms ───

  app.get('/:guildId/forms', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
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
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/:guildId/forms', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      const settings = await prisma.formSettings.upsert({
        where: { guildId },
        update: {
          enabled: body.enabled ?? undefined,
          channelId: body.channelId !== undefined ? body.channelId : undefined,
          logChannel: body.logChannel !== undefined ? body.logChannel : undefined,
        },
        create: {
          guildId,
          enabled: body.enabled ?? false,
          channelId: body.channelId ?? null,
          logChannel: body.logChannel ?? null,
        },
        include: { templates: true },
      });
      reply.send(success({ settings }));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/:guildId/forms/templates', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      if (!body.name) return reply.status(400).send(error('Le nom du formulaire est requis'));
      await prisma.formSettings.upsert({
        where: { guildId },
        update: {},
        create: { guildId, enabled: false },
      });
      const template = await prisma.formTemplate.create({
        data: {
          guildId,
          name: body.name,
          description: body.description ?? null,
          fields: JSON.stringify(body.fields ?? []),
          enabled: body.enabled ?? true,
        },
      });
      reply.status(201).send(success({ template }));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/:guildId/forms/templates/:templateId', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { templateId } = request.params as any;
      const body = request.body as any;
      const data: any = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.description !== undefined) data.description = body.description;
      if (body.fields !== undefined) data.fields = JSON.stringify(body.fields);
      if (body.enabled !== undefined) data.enabled = body.enabled;
      const template = await prisma.formTemplate.update({
        where: { id: templateId },
        data,
      });
      reply.send(success({ template }));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.delete('/:guildId/forms/templates/:templateId', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { templateId } = request.params as any;
      await prisma.formTemplate.delete({ where: { id: templateId } });
      reply.send(success(null, 'Formulaire supprimé'));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/:guildId/forms/submissions', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(q.limit) || 20));
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
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.patch('/:guildId/forms/submissions/:submissionId', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { submissionId } = request.params as any;
      const body = request.body as any;
      const data: any = {};
      if (body.status !== undefined) data.status = body.status;
      if (body.reviewedBy !== undefined) data.reviewedBy = body.reviewedBy;
      if (body.status === 'approved' || body.status === 'rejected') {
        data.reviewedAt = new Date();
        data.reviewedBy = data.reviewedBy ?? (request as any).user?.discordId;
      }
      const submission = await prisma.formSubmission.update({
        where: { id: submissionId },
        data,
      });
      reply.send(success({ submission }));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  // ─── Starboard ───

  app.get('/:guildId/starboard', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      let settings = await prisma.starboardSettings.findUnique({
        where: { guildId },
      });
      if (!settings) {
        settings = await prisma.starboardSettings.create({
          data: { guildId, enabled: false, starEmoji: '\u2B50', minStars: 3, selfStar: false },
        });
      }
      reply.send(success({ settings }));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/:guildId/starboard', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      // Keep the stored `enabled` flag consistent with the configured channel
      // so the dashboard, bot, and helpers all agree on the active state.
      const derivedEnabled =
        body.enabled ?? (body.channelId !== undefined ? !!body.channelId : undefined);
      const settings = await prisma.starboardSettings.upsert({
        where: { guildId },
        update: {
          enabled: derivedEnabled,
          channelId: body.channelId !== undefined ? body.channelId : undefined,
          starEmoji: body.starEmoji ?? undefined,
          minStars: body.minStars !== undefined ? parseInt(body.minStars) : undefined,
          selfStar: body.selfStar ?? undefined,
        },
        create: {
          guildId,
          enabled: derivedEnabled ?? false,
          channelId: body.channelId ?? null,
          starEmoji: body.starEmoji ?? '\u2B50',
          minStars: body.minStars ?? 3,
          selfStar: body.selfStar ?? false,
        },
      });
      reply.send(success({ settings }));
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/:guildId/starboard/entries', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(q.limit) || 20));
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
    } catch (err: any) { reply.status(500).send(error(sanitizeError(err))); }
  });

}
