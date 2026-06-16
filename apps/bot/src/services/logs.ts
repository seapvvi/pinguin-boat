import { Client, TextChannel, EmbedBuilder, Guild, PartialUser, User } from 'discord.js';
import { prisma, type LogSettings } from '@pinguin/db';

const settingsCache = new Map<string, { data: LogSettings | null; at: number }>();
const CACHE_MS = 30_000;

function parseJson(raw: string): string[] {
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    return [];
  }
}

async function getLogSettings(guildId: string) {
  const cached = settingsCache.get(guildId);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;

  const ls = await prisma.logSettings.findUnique({ where: { guildId } });
  settingsCache.set(guildId, { data: ls, at: Date.now() });
  return ls;
}

export async function sendGuildLog(
  client: Client,
  guildId: string,
  event: string,
  embed: EmbedBuilder
): Promise<void> {
  const modules = await prisma.moduleEnabled.findUnique({ where: { guildId } });
  if (modules && !modules.logs) return;

  const ls = await getLogSettings(guildId);
  if (!ls?.logChannelId) return;

  const events = parseJson(ls.events) as string[];
  if (events.length > 0 && !events.includes(event)) return;

  const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;

  const channel = guild.channels.cache.get(ls.logChannelId) as TextChannel | undefined;
  if (!channel?.isTextBased()) return;

  const me = guild.members.me;
  if (!me?.permissionsIn(channel).has(['ViewChannel', 'SendMessages'])) return;

  await channel.send({ embeds: [embed] }).catch(() => {});
}

export function invalidateLogCache(guildId: string): void {
  settingsCache.delete(guildId);
}

export function userTag(user: User | PartialUser): string {
  return user.username ?? user.id;
}
