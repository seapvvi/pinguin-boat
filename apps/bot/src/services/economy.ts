import { prisma } from '@pinguin/db';
import { ensureUser } from './user';
import { isEventActive } from './events';

const cache = new Map<string, { data: any; at: number }>();
const CACHE_MS = 30_000;

export async function getEconomySettings(guildId: string) {
  const c = cache.get(guildId);
  if (c && Date.now() - c.at < CACHE_MS) return c.data;
  let settings = await prisma.economySettings.findUnique({
    where: { guildId },
    include: { shopItems: true },
  });
  if (!settings) {
    settings = await prisma.economySettings.create({
      data: { guildId },
      include: { shopItems: true },
    });
  }
  cache.set(guildId, { data: settings, at: Date.now() });
  return settings;
}

export async function getOrCreateWallet(guildId: string, userId: string, startupBalance = 100) {
  await ensureUser(userId);
  let wallet = await prisma.economyWallet.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });
  if (!wallet) {
    wallet = await prisma.economyWallet.create({
      data: { guildId, userId, wallet: startupBalance, bank: 0, totalEarned: startupBalance },
    });
  }
  return wallet;
}

export function formatCoins(amount: number, symbol: string, name: string): string {
  return `**${amount}** ${symbol} ${name}`;
}

export function invalidateEconomyCache(guildId: string): void {
  cache.delete(guildId);
}

/** Module activé sur le serveur ou toggle « économie » dans le dashboard. */
export async function isEconomyActive(guildId: string): Promise<boolean> {
  const settings = await getEconomySettings(guildId);
  if (settings.enabled) return true;
  const mods = await prisma.moduleEnabled.findUnique({ where: { guildId } });
  return mods?.economy ?? false;
}

export async function getEconomyMultiplier(): Promise<number> {
  if (await isEventActive('economy_bonus_x2')) return 2;
  return 1;
}
