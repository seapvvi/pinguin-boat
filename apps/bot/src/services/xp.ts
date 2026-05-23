import { prisma } from '@pinguin/db';
import { ensureUser } from './user';

export function calculateLevel(xp: number): number {
  return Math.floor(0.1 * Math.sqrt(xp));
}

export function calculateXpForLevel(level: number): number {
  return Math.floor(100 * level * 1.5);
}

export function calculateXpForNextLevel(currentXp: number): number {
  const currentLevel = calculateLevel(currentXp);
  return calculateXpForLevel(currentLevel + 1);
}

export function randomMessageXp(): number {
  return Math.floor(Math.random() * 10) + 10;
}

export function randomVoiceXp(): number {
  return Math.floor(Math.random() * 5) + 5;
}

export async function addMessageXp(guildId: string, userId: string): Promise<{ xp: number; level: number; leveledUp: boolean }> {
  const now = new Date();

  await ensureUser(userId);

  let profile = await prisma.xPProfile.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });

  if (!profile) {
    profile = await prisma.xPProfile.create({
      data: { guildId, userId, xp: 0, level: 0, voiceXp: 0, messageCount: 0, voiceMinutes: 0 },
    });
  }

  const settings = await prisma.xPSettings.findUnique({ where: { guildId } });
  const cooldown = settings?.messageCooldown ?? 60;

  if (profile.lastMessageAt) {
    const secondsSinceLast = (now.getTime() - profile.lastMessageAt.getTime()) / 1000;
    if (secondsSinceLast < cooldown) {
      return { xp: profile.xp, level: profile.level, leveledUp: false };
    }
  }

  const xpGain = randomMessageXp();
  const newXp = profile.xp + xpGain;
  const newLevel = calculateLevel(newXp);
  const leveledUp = newLevel > profile.level;

  await prisma.xPProfile.update({
    where: { guildId_userId: { guildId, userId } },
    data: {
      xp: newXp,
      level: newLevel,
      messageCount: { increment: 1 },
      lastMessageAt: now,
    },
  });

  return { xp: newXp, level: newLevel, leveledUp };
}

export async function addVoiceXp(guildId: string, userId: string, minutes: number): Promise<{ xp: number; level: number; leveledUp: boolean }> {
  const now = new Date();

  await ensureUser(userId);

  let profile = await prisma.xPProfile.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });

  if (!profile) {
    profile = await prisma.xPProfile.create({
      data: { guildId, userId, xp: 0, level: 0, voiceXp: 0, messageCount: 0, voiceMinutes: 0 },
    });
  }

  const settings = await prisma.xPSettings.findUnique({ where: { guildId } });
  const cooldown = settings?.voiceCooldown ?? 120;

  if (profile.lastVoiceAt) {
    const secondsSinceLast = (now.getTime() - profile.lastVoiceAt.getTime()) / 1000;
    if (secondsSinceLast < cooldown) {
      return { xp: profile.xp, level: profile.level, leveledUp: false };
    }
  }

  const xpGain = randomVoiceXp() * minutes;
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

  return { xp: newXp, level: newLevel, leveledUp };
}
