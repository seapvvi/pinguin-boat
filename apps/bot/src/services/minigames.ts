import { prisma, type MinigameSettings } from '@pinguin/db';

const cache = new Map<string, { data: MinigameSettings; at: number }>();
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

export async function getActiveSession(userId: string, gameType?: string, guildId?: string) {
  const where: any = {
    userId,
    status: 'active',
  };
  
  if (gameType) {
    where.gameType = gameType;
  }
  if (guildId) {
    where.guildId = guildId;
  }
  
  const session = await prisma.minigameSession.findFirst({
    where,
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (session) {
    const ageMs = Date.now() - new Date(session.createdAt).getTime();
    const MAX_SESSION_AGE = 10 * 60 * 1000;
    if (ageMs > MAX_SESSION_AGE) {
      await prisma.minigameSession.update({
        where: { id: session.id },
        data: { status: 'expired' },
      });
      return null;
    }
  }

  return session;
}

export async function updateGameSession(
  sessionId: string,
  updates: {
    status?: string;
    gameState?: string;
    starCount?: number;
    messageId?: string;
  }
) {
  return await prisma.minigameSession.update({
    where: { id: sessionId },
    data: updates,
  });
}

export async function endGameSession(sessionId: string, status: string, payout = 0) {
  return await prisma.minigameSession.update({
    where: { id: sessionId },
    data: {
      status,
      payout,
      updatedAt: new Date(),
    },
  });
}

/**
 * Returns an error message if minigames are restricted to a specific channel
 * and the current channel is not the allowed one. Returns null when allowed.
 */
export async function cleanStaleSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  const result = await prisma.minigameSession.updateMany({
    where: {
      status: 'active',
      createdAt: { lt: cutoff },
    },
    data: { status: 'expired' },
  });
  return result.count;
}

export function minigameChannelError(
  settings: { gamesChannelId?: string | null },
  channelId: string | null
): string | null {
  if (!settings.gamesChannelId) return null;
  if (channelId === settings.gamesChannelId) return null;
  return `Les minijeux ne sont autorisés que dans <#${settings.gamesChannelId}>.`;
}