import { prisma } from '@pinguin/db';
import { GuildMember, Interaction } from 'discord.js';

export interface BlacklistCheckResult {
  blacklisted: boolean;
  reason?: string;
}

export async function checkUserBlacklist(userId: string): Promise<BlacklistCheckResult> {
  try {
    const blacklisted = await prisma.blacklistUser.findUnique({ where: { targetId: userId } });
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
    const blacklisted = await prisma.blacklistGuild.findUnique({ where: { guildId } });
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
