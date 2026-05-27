import { Message, PermissionFlagsBits } from 'discord.js';
import { prisma } from '@pinguin/db';

const settingsCache = new Map<string, { data: any; at: number }>();
const infractions = new Map<string, number>();
const CACHE_MS = 30_000;

function parseList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof raw !== 'string') return [];

  const trimmed = raw.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof parsed === 'string') {
      return parseList(parsed);
    }
  } catch {
    // fallback below (CSV/newlines)
  }

  return trimmed
    .split(/[,\r\n]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
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

function countEmojis(text: string): number {
  const matches = text.match(/\p{Extended_Pictographic}/gu);
  return matches?.length ?? 0;
}

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function applySanction(message: Message, settings: any, count: number): Promise<void> {
  if (!message.member) return;
  const reason = `Auto-modération (${count} infractions)`;

  let sanction: 'ban' | 'kick' | 'mute' | 'warn' = 'warn';
  if (settings.banEnabled) sanction = 'ban';
  else if (settings.kickEnabled) sanction = 'kick';
  else if (settings.muteEnabled) sanction = 'mute';
  else if (settings.warnEnabled === false) sanction = 'warn';

  if (sanction === 'ban') {
    await message.member.ban({ reason }).catch(() => {});
    return;
  }
  if (sanction === 'kick') {
    await message.member.kick(reason).catch(() => {});
    return;
  }
  if (sanction === 'mute') {
    const minutes = Math.max(Number(settings.muteDuration) || 10, 1);
    await message.member.timeout(minutes * 60 * 1000, reason).catch(() => {});
    return;
  }

  await prisma.moderationCase.create({
    data: {
      guildId: message.guild!.id,
      userId: message.author.id,
      moderatorId: message.client.user!.id,
      type: 'WARN',
      reason,
    },
  }).catch(() => {});
  await message.author.send(`⚠️ **Avertissement** sur **${message.guild!.name}** : ${reason}`).catch(() => {});
}

export async function checkAutoMod(message: Message): Promise<boolean> {
  if (!message.guild || message.author.bot || !message.member) return false;

  const settings = await getSettings(message.guild.id);
  if (!settings) return false;

  const hasAnyRule =
    (settings.bannedWords && settings.bannedWordsList) ||
    settings.discordInvites ||
    settings.externalLinks ||
    settings.excessiveCaps ||
    settings.excessiveEmojis ||
    settings.excessiveMentions ||
    settings.messageSpam ||
    settings.forbiddenPings ||
    settings.forbiddenMarkdown;
  if (!hasAnyRule) return false;

  const whitelistRoles = parseList(settings.whitelistRoles);
  const whitelistChannels = parseList(settings.whitelistChannels);
  if (isWhitelisted(message, whitelistRoles, whitelistChannels)) return false;

  const content = message.content;
  let violation = false;
  let reason = '';

  if (settings.bannedWords) {
    const words = parseList(settings.bannedWordsList)
      .map((w) => normalizeText(w).trim())
      .filter(Boolean);
    const lower = normalizeText(content);
    if (words.some((w) => {
      const pattern = new RegExp(`(^|\\b|\\s)${escapeRegex(w)}(\\b|\\s|$)`, 'i');
      return pattern.test(lower) || lower.includes(w);
    })) {
      violation = true;
      reason = 'Mot interdit';
    }
  }

  if (!violation && settings.discordInvites && /(discord\.gg|discord\.com\/invite)/i.test(content)) {
    violation = true;
    reason = 'Invitation Discord';
  }

  if (!violation && settings.externalLinks && /https?:\/\//i.test(content) && !/discord/i.test(content)) {
    violation = true;
    reason = 'Lien externe';
  }

  if (!violation && settings.excessiveCaps && content.length > 8) {
    const letters = content.replace(/[^a-zA-Z]/g, '');
    if (letters.length > 0) {
      const upper = letters.replace(/[^A-Z]/g, '').length;
      if ((upper / letters.length) * 100 >= settings.capsThreshold) {
        violation = true;
        reason = 'Majuscules excessives';
      }
    }
  }

  if (!violation && settings.excessiveEmojis && countEmojis(content) >= settings.emojisThreshold) {
    violation = true;
    reason = 'Emojis excessifs';
  }

  if (!violation && settings.excessiveMentions) {
    const mentions = message.mentions.users.size + message.mentions.roles.size;
    if (mentions >= settings.mentionsThreshold) {
      violation = true;
      reason = 'Mentions excessives';
    }
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
    if (recent.length >= settings.spamThreshold) {
      violation = true;
      reason = 'Spam';
    }
  }

  if (!violation) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ch = message.channel as any;

  if (violation && reason === 'Spam' && typeof ch.bulkDelete === 'function') {
    const windowMs = Math.max(settings.spamInterval, 1) * 1000;
    const cutoff = Date.now() - windowMs;
    const toDelete = ch.messages?.cache
      ? (ch.messages.cache as import('discord.js').Collection<string, import('discord.js').Message>)
          .filter((m: import('discord.js').Message) => m.author.id === message.author.id && m.createdTimestamp >= cutoff)
          .map((m: import('discord.js').Message) => m.id)
      : [message.id];
    if (toDelete.length > 1) {
      await (ch.bulkDelete(toDelete.slice(0, 100), true) as Promise<unknown>).catch(() => message.delete().catch(() => {}));
    } else {
      await message.delete().catch(() => {});
    }
  } else {
    await message.delete().catch(() => {});
  }

  if (typeof ch.send === 'function') {
    (ch.send({ content: `<@${message.author.id}> ⚠️ Ce message a été supprimé (${reason}).` }) as Promise<import('discord.js').Message>)
      .then((warn) => { setTimeout(() => warn.delete().catch(() => {}), 5000); })
      .catch(() => {});
  }

  const infKey = `${message.guild.id}:${message.author.id}`;
  const count = (infractions.get(infKey) ?? 0) + 1;
  infractions.set(infKey, count);

  const threshold = Math.max(settings.autoSanctionThreshold ?? 3, 1);
  if (count >= threshold) {
    await applySanction(message, settings, count);
    infractions.set(infKey, 0);
  }

  if (settings.logChannelId) {
    const ch = message.guild.channels.cache.get(settings.logChannelId);
    if (ch?.isTextBased()) {
      await ch
        .send(
          `⚠️ **Auto-mod** — <@${message.author.id}> : ${reason} (infraction **${count}/${threshold}**)` +
            (count >= threshold ? ' → **sanction appliquée**' : '')
        )
        .catch(() => {});
    }
  }

  return true;
}

export function invalidateAutoModCache(guildId: string): void {
  settingsCache.delete(guildId);
}
