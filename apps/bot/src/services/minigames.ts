import { prisma } from '@pinguin/db';

const cache = new Map<string, { data: any; at: number }>();
const CACHE_MS = 30_000;

export async function getMinigameSettings(guildId: string) {
  const c = cache.get(guildId);
  if (c && Date.now() - c.at < CACHE_MS) return c.data;
  
  let settings = await prisma.minigameSettings.findUnique({
    where: { guildId },
  });
  
  if (!settings) {
    settings = await prisma.minigameSettings.create({
      data: { guildId },
    });
  }
  
  cache.set(guildId, { data: settings, at: Date.now() });
  return settings;
}

export function invalidateMinigameCache(guildId: string): void {
  cache.delete(guildId);
}

export async function isMinigamesActive(guildId: string): Promise<boolean> {
  const settings = await getMinigameSettings(guildId);
  if (settings.enabled) return true;
  
  const mods = await prisma.moduleEnabled.findUnique({ where: { guildId } });
  return mods?.minigames ?? false;
}

export async function createGameSession(
  guildId: string,
  userId: string,
  gameType: string,
  bet: number,
  channelId: string,
  messageId?: string,
  opponentId?: string
) {
  return await prisma.minigameSession.create({
    data: {
      guildId,
      userId,
      gameType,
      bet,
      channelId,
      messageId,
      opponentId,
      status: 'active',
      gameState: '{}',
    },
  });
}

export async function getActiveSession(userId: string, gameType?: string) {
  const where: any = {
    userId,
    status: 'active',
  };
  
  if (gameType) {
    where.gameType = gameType;
  }
  
  return await prisma.minigameSession.findFirst({
    where,
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export async function updateGameSession(
  sessionId: string,
  updates: {
    status?: string;
    gameState?: string;
    starCount?: number;
  }
) {
  return await prisma.minigameSession.update({
    where: { id: sessionId },
    data: updates,
  });
}

export async function endGameSession(sessionId: string, status: string) {
  return await prisma.minigameSession.update({
    where: { id: sessionId },
    data: {
      status,
      updatedAt: new Date(),
    },
  });
}