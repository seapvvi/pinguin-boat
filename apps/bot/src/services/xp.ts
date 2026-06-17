import { prisma } from '@pinguin/db';
import { ensureUser } from './user';
import { updateQuestProgress } from './quests';
import { isEconomyActive } from './economy';
import { isEventActive } from './events';
import { trackWarXp } from './clans';
import { calculateLevel } from '@pinguin/shared/levelFormula';

export const XP_PER_VOCAL_MINUTE = 15;

function parseJsonIds(raw: string): string[] {
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    return [];
  }
}

export async function addMessageXp(
  guildId: string,
  userId: string,
  options?: { channelId?: string; roleIds?: string[]; contentLength?: number; isThread?: boolean }
): Promise<{ xp: number; level: number; leveledUp: boolean }> {
  const now = new Date();
  await ensureUser(userId);

  const settings = await prisma.xPSettings.findUnique({ where: { guildId } });
  if (settings && !settings.enabled) {
    const p = await prisma.xPProfile.findUnique({ where: { guildId_userId: { guildId, userId } } });
    return { xp: p?.xp ?? 0, level: p?.level ?? 0, leveledUp: false };
  }

  if (settings) {
    const noXpChannels = parseJsonIds(settings.noXpChannels);
    const noXpRoles = parseJsonIds(settings.noXpRoles);
    if (options?.channelId && noXpChannels.includes(options.channelId)) {
      const p = await prisma.xPProfile.findUnique({ where: { guildId_userId: { guildId, userId } } });
      return { xp: p?.xp ?? 0, level: p?.level ?? 0, leveledUp: false };
    }
    if (options?.roleIds?.some((r) => noXpRoles.includes(r))) {
      const p = await prisma.xPProfile.findUnique({ where: { guildId_userId: { guildId, userId } } });
      return { xp: p?.xp ?? 0, level: p?.level ?? 0, leveledUp: false };
    }
    if (!settings.xpInThreads && options?.isThread) {
      const p = await prisma.xPProfile.findUnique({ where: { guildId_userId: { guildId, userId } } });
      return { xp: p?.xp ?? 0, level: p?.level ?? 0, leveledUp: false };
    }
  }

  const messageCooldown = (settings?.messageCooldown ?? 60) * 1000;

  const { xp, level, leveledUp, xpGain } = await prisma.$transaction(async (tx) => {
    let profile = await tx.xPProfile.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });

    if (!profile) {
      profile = await tx.xPProfile.create({
        data: { guildId, userId, xp: 0, level: 0, voiceXp: 0, messageCount: 0, voiceMinutes: 0 },
      });
    }

    if (profile.lastMessageAt) {
      const msSince = now.getTime() - profile.lastMessageAt.getTime();
      if (msSince < messageCooldown) {
        return { xp: profile.xp, level: profile.level, leveledUp: false, xpGain: 0 };
      }
    }

    const xpMin = settings?.xpPerMessageMin ?? 15;
    const xpMax = settings?.xpPerMessageMax ?? 25;
    let xpGain = Math.floor(Math.random() * (xpMax - xpMin + 1)) + xpMin;
    if (settings?.doubleXpLongMessages && (options?.contentLength ?? 0) > 250) {
      xpGain *= 2;
    }
    if (settings?.xpMultiplier && settings.xpMultiplier !== 1) {
      xpGain = Math.floor(xpGain * settings.xpMultiplier);
    }
    if (options?.roleIds && options.roleIds.length > 0) {
      const roleRewards = await tx.xPRoleReward.findMany({
        where: { guildId, roleId: { in: options.roleIds } },
      });
      const roleMult = Math.max(1, ...roleRewards.map((r) => r.xpMultiplier));
      if (roleMult > 1) {
        xpGain = Math.floor(xpGain * roleMult);
      }
    }
    if (await isEventActive('double_xp')) {
      xpGain *= 2;
    }

    const newXp = profile.xp + xpGain;
    const newLevel = calculateLevel(newXp);
    const leveledUp = newLevel > profile.level;

    await tx.xPProfile.update({
      where: { guildId_userId: { guildId, userId } },
      data: {
        xp: newXp,
        level: newLevel,
        messageCount: { increment: 1 },
        lastMessageAt: now,
      },
    });

    return { xp: newXp, level: newLevel, leveledUp, xpGain };
  });

  await trackWarXp(guildId, userId, xpGain);

  if (leveledUp) {
    const economyActive = await isEconomyActive(guildId);
    if (economyActive) {
      await updateQuestProgress(guildId, userId, 'LEVEL_UP', 1);
    }
  }

  return { xp, level, leveledUp };
}

export async function addVoiceXp(
  guildId: string,
  userId: string,
  minutes: number,
  roleIds?: string[]
): Promise<{ xp: number; level: number; leveledUp: boolean }> {
  const now = new Date();
  await ensureUser(userId);

  const settings = await prisma.xPSettings.findUnique({ where: { guildId } });
  if (settings && !settings.enabled) {
    const p = await prisma.xPProfile.findUnique({ where: { guildId_userId: { guildId, userId } } });
    return { xp: p?.xp ?? 0, level: p?.level ?? 0, leveledUp: false };
  }

  let profile = await prisma.xPProfile.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });

  if (!profile) {
    profile = await prisma.xPProfile.create({
      data: { guildId, userId, xp: 0, level: 0, voiceXp: 0, messageCount: 0, voiceMinutes: 0 },
    });
  }

  const voiceCooldown = (settings?.voiceCooldown ?? 120) * 1000;
  if (profile.lastVoiceAt) {
    const msSince = now.getTime() - profile.lastVoiceAt.getTime();
    if (msSince < voiceCooldown) {
      return { xp: profile.xp, level: profile.level, leveledUp: false };
    }
  }

  let xpGain = XP_PER_VOCAL_MINUTE * Math.max(1, minutes);
  if (settings?.xpMultiplier && settings.xpMultiplier !== 1) {
    xpGain = Math.floor(xpGain * settings.xpMultiplier);
  }
  if (roleIds && roleIds.length > 0) {
    const roleRewards = await prisma.xPRoleReward.findMany({
      where: { guildId, roleId: { in: roleIds } },
    });
    const roleMult = Math.max(1, ...roleRewards.map((r) => r.xpMultiplier));
    if (roleMult > 1) {
      xpGain = Math.floor(xpGain * roleMult);
    }
  }
  if (await isEventActive('double_xp')) {
    xpGain *= 2;
  }

  const newXp = profile.xp + xpGain;
  const newLevel = calculateLevel(newXp);
  const leveledUp = newLevel > profile.level;

  await prisma.xPProfile.update({
    where: { guildId_userId: { guildId, userId } },
    data: {
      xp: newXp,
      level: newLevel,
      voiceXp: { increment: xpGain },
      voiceMinutes: { increment: minutes },
      lastVoiceAt: now,
    },
  });

  await trackWarXp(guildId, userId, xpGain);

  return { xp: newXp, level: newLevel, leveledUp };
}