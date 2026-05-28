import { prisma } from '@pinguin/db';

const cache = new Map<string, { data: any; at: number }>();
const CACHE_MS = 30_000;

export async function getStarboardSettings(guildId: string) {
  const c = cache.get(guildId);
  if (c && Date.now() - c.at < CACHE_MS) return c.data;
  
  let settings = await prisma.starboardSettings.findUnique({
    where: { guildId },
  });
  
  if (!settings) {
    settings = await prisma.starboardSettings.create({
      data: { 
        guildId,
        enabled: false,
        starEmoji: '⭐',
        minStars: 3,
        selfStar: false,
      },
    });
  }
  
  cache.set(guildId, { data: settings, at: Date.now() });
  return settings;
}

export function invalidateStarboardCache(guildId: string): void {
  cache.delete(guildId);
}

export async function isStarboardActive(guildId: string): Promise<boolean> {
  const settings = await getStarboardSettings(guildId);
  if (!settings.enabled) return false;
  return !!settings.channelId;
}

export async function setStarboardChannel(
  guildId: string,
  channelId: string | null
) {
  invalidateStarboardCache(guildId);
  
  return await prisma.starboardSettings.upsert({
    where: { guildId },
    update: { channelId },
    create: { 
      guildId,
      channelId,
      enabled: !!channelId,
      starEmoji: '⭐',
      minStars: 3,
      selfStar: false,
    },
  });
}

export async function setStarboardSettings(
  guildId: string,
  settings: {
    enabled?: boolean;
    starEmoji?: string;
    minStars?: number;
    selfStar?: boolean;
  }
) {
  invalidateStarboardCache(guildId);
  
  return await prisma.starboardSettings.upsert({
    where: { guildId },
    update: settings,
    create: { 
      guildId,
      ...settings,
      enabled: settings.enabled ?? true,
      starEmoji: settings.starEmoji ?? '⭐',
      minStars: settings.minStars ?? 3,
      selfStar: settings.selfStar ?? false,
    },
  });
}

export async function getStarboardEntry(
  guildId: string,
  originalMessageId: string
) {
  return await prisma.starboardEntry.findUnique({
    where: {
      guildId_originalId: {
        guildId,
        originalId: originalMessageId,
      },
    },
  });
}

export async function createStarboardEntry(
  guildId: string,
  originalMessageId: string,
  authorId: string,
  content: string,
  attachment?: string
) {
  return await prisma.starboardEntry.create({
    data: {
      guildId,
      originalId: originalMessageId,
      authorId,
      content,
      attachment,
      starCount: 0,
    },
  });
}

export async function updateStarboardEntry(
  entryId: string,
  updates: {
    starCount?: number;
    starboardId?: string;
  }
) {
  return await prisma.starboardEntry.update({
    where: { id: entryId },
    data: updates,
  });
}

export async function deleteStarboardEntry(entryId: string) {
  return await prisma.starboardEntry.delete({
    where: { id: entryId },
  });
}