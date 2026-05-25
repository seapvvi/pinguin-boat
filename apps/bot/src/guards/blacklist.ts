import { prisma } from '@pinguin/db';
import { GuildMember, Interaction } from 'discord.js';
import { getCache, setCache } from '../utils/cache';

export interface BlacklistCheckResult {
  blacklisted: boolean;
  reason?: string;
}

export async function checkUserBlacklist(userId: string): Promise<BlacklistCheckResult> {
  try {
    const cacheKey = `blacklistUser:${userId}`;
    let blacklisted = getCache<{ reason: string } | null>(cacheKey);
    if (blacklisted === undefined) {
      const dbResult = await prisma.blacklistUser.findUnique({ where: { targetId: userId } });
      blacklisted = dbResult ?? null;
      setCache(cacheKey, blacklisted, 30_000);
    }
    if (blacklisted) {
      return { blacklisted: true, reason: blacklisted.reason };
    }
    return { blacklisted: false };
  } catch {
    return { blacklisted: false };
  }
}

export async function checkGuildBlacklist(guildId: string): Promise<BlacklistCheckResult> {
  try {
    const cacheKey = `blacklistGuild:${guildId}`;
    let blacklisted = getCache<{ reason: string } | null>(cacheKey);
    if (blacklisted === undefined) {
      const dbResult = await prisma.blacklistGuild.findUnique({ where: { guildId } });
      blacklisted = dbResult ?? null;
      setCache(cacheKey, blacklisted, 30_000);
    }
    if (blacklisted) {
      return { blacklisted: true, reason: blacklisted.reason };
    }
    return { blacklisted: false };
  } catch {
    return { blacklisted: false };
  }
}

export async function checkInteractionBlacklist(
  interaction: Interaction
): Promise<BlacklistCheckResult> {
  if (!interaction.guildId || !interaction.user) {
    return { blacklisted: false };
  }

  const userCheck = await checkUserBlacklist(interaction.user.id);
  if (userCheck.blacklisted) return userCheck;

  const guildCheck = await checkGuildBlacklist(interaction.guildId);
  if (guildCheck.blacklisted) return guildCheck;

  return { blacklisted: false };
}
