import { Message, PermissionFlagsBits } from 'discord.js';
import { prisma } from '@pinguin/db';

const settingsCache = new Map<string, { data: any; at: number }>();
const infractions = new Map<string, number>();
const CACHE_MS = 30_000;

function parseJson(raw: string): string[] {
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    return [];
  }
}

async function getSettings(guildId: string) {
  const c = settingsCache.get(guildId);
  if (c && Date.now() - c.at < CACHE_MS) return c.data;
  const s = await prisma.autoModSettings.findUnique({ where: { guildId } });
  settingsCache.set(guildId, { data: s, at: Date.now() });
  return s;
}

function isWhitelisted(message: Message, whitelistRoles: string[], whitelistChannels: string[]): boolean {
  if (whitelistChannels.includes(message.channel.id)) return true;
  if (!message.member) return false;
  if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return true;
  return message.member.roles.cache.some((r) => whitelistRoles.includes(r.id));
}

export async function checkAutoMod(message: Message): Promise<boolean> {
  if (!message.guild || message.author.bot || !message.member) return false;

  const settings = await getSettings(message.guild.id);
  if (!settings) return false;

  const whitelistRoles = parseJson(settings.whitelistRoles);
  const whitelistChannels = parseJson(settings.whitelistChannels);
  if (isWhitelisted(message, whitelistRoles, whitelistChannels)) return false;

  const content = message.content;
  let violation = false;

  if (settings.bannedWords) {
    const words = parseJson(settings.bannedWordsList).map((w) => w.toLowerCase());
    const lower = content.toLowerCase();
    if (words.some((w) => w && lower.includes(w))) violation = true;
  }

  if (!violation && settings.discordInvites && /(discord\.gg|discord\.com\/invite)\//i.test(content)) {
    violation = true;
  }

  if (!violation && settings.externalLinks && /https?:\/\//i.test(content) && !content.includes('discord')) {
    violation = true;
  }

  if (!violation && settings.excessiveCaps && content.length > 8) {
    const letters = content.replace(/[^a-zA-Z]/g, '');
    if (letters.length > 0) {
      const upper = letters.replace(/[^A-Z]/g, '').length;
      if ((upper / letters.length) * 100 >= settings.capsThreshold) violation = true;
    }
  }

  if (!violation && settings.excessiveMentions) {
    const mentions = message.mentions.users.size + message.mentions.roles.size;
    if (mentions >= settings.mentionsThreshold) violation = true;
  }

  if (!violation && settings.messageSpam) {
    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const windowMs = Math.max(settings.spamInterval, 1) * 1000;
    const entry = (global as any).__automodSpam ??= new Map<string, number[]>();
    const times: number[] = entry.get(key) ?? [];
    times.push(now);
    const recent = times.filter((t) => now - t < windowMs);
    entry.set(key, recent);
    if (recent.length >= settings.spamThreshold) violation = true;
  }

  if (!violation) return false;

  await message.delete().catch(() => {});

  const infKey = `${message.guild.id}:${message.author.id}`;
  const count = (infractions.get(infKey) ?? 0) + 1;
  infractions.set(infKey, count);

  if (count >= settings.autoSanctionThreshold) {
    if (settings.muteEnabled) {
      await message.member.timeout(settings.muteDuration * 60 * 1000, 'Auto-modération').catch(() => {});
    } else if (settings.kickEnabled) {
      await message.member.kick('Auto-modération').catch(() => {});
    } else if (settings.banEnabled) {
      await message.member.ban({ reason: 'Auto-modération' }).catch(() => {});
    }
    infractions.set(infKey, 0);
  }

  if (settings.logChannelId) {
    const ch = message.guild.channels.cache.get(settings.logChannelId);
    if (ch?.isTextBased()) {
      await ch.send(`⚠️ Auto-mod : message supprimé de <@${message.author.id}> (infraction ${count})`).catch(() => {});
    }
  }

  return true;
}
