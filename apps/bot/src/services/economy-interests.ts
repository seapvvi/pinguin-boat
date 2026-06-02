import { prisma } from '@pinguin/db';
import { getEconomySettings, isEconomyActive } from './economy';
import { logger } from '@pinguin/shared';

const runningIntervals = new Map<string, NodeJS.Timeout>();

export async function startInterestCron(guildId: string): Promise<void> {
  if (runningIntervals.has(guildId)) {
    return;
  }

  const settings = await getEconomySettings(guildId);
  if (!settings.enabled || settings.interestRate <= 0 || settings.interestInterval <= 0) {
    return;
  }

  const interval = setInterval(async () => {
    try {
      const active = await isEconomyActive(guildId);
      if (!active) {
        stopInterestCron(guildId);
        return;
      }

      const currentSettings = await getEconomySettings(guildId);
      if (!currentSettings.enabled || currentSettings.interestRate <= 0) {
        return;
      }

      const wallets = await prisma.economyWallet.findMany({
        where: {
          guildId,
          bank: { gt: 0 },
        },
      });

      if (wallets.length === 0) {
        return;
      }

      const interestRate = currentSettings.interestRate / 100;

      for (const wallet of wallets) {
        const interest = Math.floor(wallet.bank * interestRate);
        if (interest <= 0) continue;

        await prisma.$transaction(async (tx) => {
          await tx.economyWallet.update({
            where: { id: wallet.id },
            data: {
              bank: { increment: interest },
              totalEarned: { increment: interest },
            },
          });

          await tx.economyTransaction.create({
            data: {
              guildId,
              toUserId: wallet.userId,
              amount: interest,
              type: 'INTEREST',
              description: `Intérêts bancaires (${currentSettings.interestRate}%)`,
            },
          });
        });
      }

      logger.info(`[Economy] Intérêts appliqués pour ${wallets.length} wallets sur ${guildId}`);
    } catch (error) {
      logger.error(`[Economy] Erreur lors de l'application des intérêts pour ${guildId}`, { err: error instanceof Error ? error.message : String(error) });
    }
  }, settings.interestInterval);

  runningIntervals.set(guildId, interval);
  logger.info(`[Economy] Cron d'intérêts démarré pour ${guildId} (interval: ${settings.interestInterval}ms)`);
}

export function stopInterestCron(guildId: string): void {
  const interval = runningIntervals.get(guildId);
  if (interval) {
    clearInterval(interval);
    runningIntervals.delete(guildId);
    logger.info(`[Economy] Cron d'intérêts arrêté pour ${guildId}`);
  }
}

export function stopAllInterestCrons(): void {
  for (const [guildId, interval] of runningIntervals.entries()) {
    clearInterval(interval);
    logger.info(`[Economy] Cron d'intérêts arrêté pour ${guildId}`);
  }
  runningIntervals.clear();
}

export async function initializeInterestCrons(guildIds: string[]): Promise<void> {
  for (const guildId of guildIds) {
    try {
      const active = await isEconomyActive(guildId);
      if (!active) continue;

      const settings = await getEconomySettings(guildId);
      if (settings.enabled && settings.interestRate > 0 && settings.interestInterval > 0) {
        startInterestCron(guildId);
      }
    } catch (error) {
      logger.error(`[Economy] Erreur lors de l'initialisation du cron d'intérêts pour ${guildId}`, { err: error instanceof Error ? error.message : String(error) });
    }
  }
}
