import { z } from 'zod';
import { prisma } from '@pinguin/db';

export const MODULE_FIELDS = ['moderation','protection','tickets','logs','levels','economy','music','giveaways','polls','suggestions','welcome','autoroles','embeds','minigames','starboard','forms','clans','notifications'] as const;

export const MODULE_DEFAULTS: Record<string, boolean> = {
  moderation: true, protection: true, tickets: true, logs: true,
  levels: true, economy: false, music: true, giveaways: true,
  polls: true, suggestions: true, welcome: true, autoroles: true, embeds: true,
  minigames: true, starboard: false, forms: false, clans: false, notifications: false,
};

export const guildIdSchema = z.object({ guildId: z.string().min(1) });
export const ticketIdSchema = z.object({ guildId: z.string().min(1), ticketId: z.string().min(1) });
export const suggestionIdSchema = z.object({ guildId: z.string().min(1), id: z.string().min(1) });
export const giveawayIdSchema = z.object({ guildId: z.string().min(1), id: z.string().min(1) });
export const pollIdSchema = z.object({ guildId: z.string().min(1), id: z.string().min(1) });

export const autoroleSchema = z.object({
  enabled: z.boolean().optional(),
  roleIds: z.array(z.string()).optional(),
  botRoles: z.array(z.string()).optional(),
});

export const economySchema = z.object({
  enabled: z.boolean().optional(),
  currencyName: z.string().max(20).optional(),
  currencySymbol: z.string().max(10).optional(),
  dailyAmount: z.number().int().min(0).max(1000000).optional(),
  weeklyAmount: z.number().int().min(0).max(1000000).optional(),
  startupBalance: z.number().int().min(0).max(1000000).optional(),
  workMin: z.number().int().min(0).max(10000).optional(),
  workMax: z.number().int().min(0).max(10000).optional(),
  workCooldown: z.number().int().min(0).max(86400).optional(),
  robberyEnabled: z.boolean().optional(),
  robberyMaxAmount: z.number().int().min(0).max(1000000).optional(),
  robberyCooldown: z.number().int().min(0).max(86400).optional(),
  interestRate: z.number().int().min(0).max(100).optional(),
  interestInterval: z.number().int().min(0).max(604800).optional(),
  bankCapacity: z.number().int().min(0).max(10000000).optional(),
  shopItems: z.array(z.object({
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    price: z.number().int().min(0),
    roleId: z.string().nullable().optional(),
  })).optional(),
});

const levelFormulaSchema = z.string().regex(/^[\d\s\*\+\-\/\.\(\)level]+$/);

export const levelsSchema = z.object({
  enabled: z.boolean().optional(),
  xpPerMessageMin: z.number().int().min(1).max(1000).optional(),
  xpPerMessageMax: z.number().int().min(1).max(1000).optional(),
  voiceXp: z.number().int().min(0).optional(),
  messageCooldown: z.number().int().min(0).max(3600).optional(),
  voiceCooldown: z.number().int().min(0).max(3600).optional(),
  levelFormula: levelFormulaSchema.optional(),
  maxLevel: z.number().int().max(10000).optional(),
  ignoredChannels: z.array(z.string()).optional(),
  ignoredRoles: z.array(z.string()).optional(),
  announcementChannelId: z.string().nullable().optional(),
  announcementMessage: z.string().nullable().optional(),
  roleRewards: z.array(z.object({
    level: z.number().int().min(0),
    roleId: z.string().min(1),
    xpMultiplier: z.number().min(0).optional(),
  })).optional(),
});

export const welcomeSchema = z.object({
  enabled: z.boolean().optional(),
  welcomeChannelId: z.string().optional(),
  welcomeMessage: z.string().max(2000).optional(),
  welcomeEmbed: z.boolean().optional(),
  welcomeEmbedColor: z.string().optional(),
  welcomeEmbedTitle: z.string().optional(),
  welcomeEmbedDescription: z.string().optional(),
  welcomeEmbedFooter: z.string().optional(),
  welcomeEmbedImage: z.string().optional(),
  welcomeDM: z.boolean().optional(),
  welcomeDMMessage: z.string().optional(),
  dmWelcome: z.boolean().optional(),
  dmWelcomeMessage: z.string().optional(),
  goodbyeEnabled: z.boolean().optional(),
  goodbyeChannelId: z.string().optional(),
  goodbyeMessage: z.string().max(2000).optional(),
  goodbyeEmbed: z.boolean().optional(),
  goodbyeEmbedColor: z.string().optional(),
  cardEnabled: z.boolean().optional(),
  cardBackground: z.string().optional(),
  cardBgColor: z.string().optional(),
  cardBgImage: z.string().optional(),
  cardTextColor: z.string().optional(),
  cardSubtextColor: z.string().optional(),
  cardAccentColor: z.string().optional(),
  cardBlurBackground: z.boolean().optional(),
  cardText: z.string().optional(),
  cardSubtext: z.string().optional(),
});

export const protectionSchema = z.object({
  enabled: z.boolean().optional(),
  emergencyMode: z.boolean().optional(),
  antiRaid: z.boolean().optional(),
  raidThreshold: z.number().int().min(1).optional(),
  raidInterval: z.number().int().min(1).optional(),
  antiSpam: z.boolean().optional(),
  spamThreshold: z.number().int().min(1).optional(),
  spamInterval: z.number().int().min(1).optional(),
  antiMassMention: z.boolean().optional(),
  mentionThreshold: z.number().int().min(1).optional(),
  antiLink: z.boolean().optional(),
  antiAlts: z.boolean().optional(),
  altAccountAge: z.number().int().min(0).optional(),
  verificationLevel: z.string().optional(),
  captchaVerification: z.boolean().optional(),
  punishment: z.string().optional(),
});

export const importModulesEnum = z.enum([
  'settings', 'modulesEnabled', 'logSettings', 'xpSettings', 'welcomeSettings',
  'economySettings', 'protectionSettings', 'autoroleSettings', 'autoModSettings', 'ticketSettings',
]);

export const importSchema = z.object({
  exportData: z.record(z.unknown()),
  modules: z.array(importModulesEnum).min(1),
});

export function computeDisabledModules(modulesEnabled: any): string[] {
  return MODULE_FIELDS
    .filter(f => modulesEnabled ? !modulesEnabled[f] : !MODULE_DEFAULTS[f])
    .map(f => f.toUpperCase());
}

export function mapLogsPayload(logSettings: { logChannelId: string | null; events: string; ignoredChannels: string; ignoredRoles: string } | null, modules?: { logs?: boolean } | null) {
  const events = logSettings ? JSON.parse(logSettings.events || '[]') : [];
  return {
    enabled: modules?.logs ?? true,
    logChannelId: logSettings?.logChannelId ?? null,
    enabledEvents: events,
    ignoreChannels: logSettings ? JSON.parse(logSettings.ignoredChannels || '[]') : [],
    ignoreUsers: logSettings ? JSON.parse(logSettings.ignoredRoles || '[]') : [],
  };
}

export function transformAutoroleSettings(ar: { enabled: boolean; entries?: Array<{ type: string; roleId: string }> } | null) {
  if (!ar) return { enabled: false, roleIds: [], botRoles: [], delay: 0, ignoreBots: false };
  return {
    enabled: ar.enabled,
    roleIds: (ar.entries ?? []).filter((e) => e.type === 'JOIN').map((e) => e.roleId),
    botRoles: (ar.entries ?? []).filter((e) => e.type === 'BOT').map((e) => e.roleId),
    delay: 0,
    ignoreBots: false,
  };
}

export async function ensureUser(discordId: string) {
  return prisma.user.upsert({
    where: { discordId },
    update: {},
    create: { discordId, username: discordId },
  });
}

export async function getEconomySettings(guildId: string) {
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
