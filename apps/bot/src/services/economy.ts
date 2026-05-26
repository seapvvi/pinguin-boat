import { prisma } from '@pinguin/db';

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
