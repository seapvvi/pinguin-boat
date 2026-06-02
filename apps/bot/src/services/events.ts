import { prisma } from '@pinguin/db';
import { getCache, setCache } from '../utils/cache';

export async function isEventActive(key: string): Promise<boolean> {
  const cacheKey = `event:${key}`;
  const cached = getCache<boolean>(cacheKey);
  if (cached !== null) return cached;

  const flag = await prisma.featureFlag.findUnique({ where: { key } });
  if (!flag || !flag.enabled) {
    setCache(cacheKey, false, 30_000);
    return false;
  }

  const now = new Date();
  if (flag.startsAt && now < flag.startsAt) {
    setCache(cacheKey, false, 30_000);
    return false;
  }
  if (flag.expiresAt && now > flag.expiresAt) {
    setCache(cacheKey, false, 30_000);
    return false;
  }

  setCache(cacheKey, true, 30_000);
  return true;
}

export async function getActiveEvents(): Promise<{
  id: string;
  key: string;
  name: string;
  description: string | null;
  startsAt: Date | null;
  expiresAt: Date | null;
}[]> {
  const now = new Date();
  const flags = await prisma.featureFlag.findMany({
    where: {
      enabled: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
      ],
    },
    select: { id: true, key: true, name: true, description: true, startsAt: true, expiresAt: true },
  });
  return flags;
}

export async function setEvent(
  key: string,
  name: string,
  description: string | undefined,
  durationMinutes: number
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMinutes * 60_000);

  await prisma.featureFlag.upsert({
    where: { key },
    update: { name, description, enabled: true, startsAt: now, expiresAt },
    create: { key, name, description, enabled: true, startsAt: now, expiresAt },
  });
}

export async function disableEvent(key: string): Promise<void> {
  await prisma.featureFlag.update({
    where: { key },
    data: { enabled: false, startsAt: null, expiresAt: null },
  });
}
