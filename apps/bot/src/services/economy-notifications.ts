import { Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { getEconomySettings, isEconomyActive } from './economy';
import { EmbedBuilder } from 'discord.js';

const runningIntervals = new Map<string, NodeJS.Timeout>();
const NOTIFIED_DAILY = new Set<string>();
const NOTIFIED_WEEKLY = new Set<string>();

export async function startNotificationCron(client: Client, guildId: string): Promise<void> {
  if (runningIntervals.has(guildId)) {
    return;
  }

  const settings = await getEconomySettings(guildId);
  if (!settings.enabled) {
    return;
  }

  const interval = setInterval(async () => {
    try {
      const active = await isEconomyActive(guildId);
      if (!active) {
        stopNotificationCron(guildId);
        return;
      }

      const currentSettings = await getEconomySettings(guildId);
      if (!currentSettings.enabled) {
        return;
      }

      const now = new Date();
      const dailyThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weeklyThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const wallets = await prisma.economyWallet.findMany({
        where: {
          guildId,
          OR: [
            { lastDailyAt: { lte: dailyThreshold } },
            { lastWeeklyAt: { lte: weeklyThreshold } },
            { lastDailyAt: null },
            { lastWeeklyAt: null },
          ],
        },
        include: {
          user: true,
        },
      });

      if (wallets.length === 0) {
        return;
      }

      for (const wallet of wallets) {
        if (!wallet.user) continue;

        const dailyKey = `${guildId}:${wallet.userId}:daily`;
        const weeklyKey = `${guildId}:${wallet.userId}:weekly`;

        if (wallet.user.notifyDaily) {
          const shouldNotifyDaily = !wallet.lastDailyAt || wallet.lastDailyAt <= dailyThreshold;
          if (shouldNotifyDaily && !NOTIFIED_DAILY.has(dailyKey)) {
            try {
              const discordUser = await client.users.fetch(wallet.userId).catch(() => null);
              if (discordUser) {
                const embed = new EmbedBuilder()
                  .setTitle('🔔 Rappel quotidien')
                  .setDescription(`Votre récompense quotidienne est disponible !\nUtilisez la commande \`/daily\` pour réclamer **${currentSettings.dailyAmount} ${currentSettings.currencySymbol}**.`)
                  .setColor('#14b8a6')
                  .setTimestamp();

                await discordUser.send({ embeds: [embed] });
                NOTIFIED_DAILY.add(dailyKey);
                
                setTimeout(() => {
                  NOTIFIED_DAILY.delete(dailyKey);
                }, 25 * 60 * 60 * 1000);
              }
            } catch (error) {
              console.error(`[Economy] Impossible d'envoyer DM à ${wallet.userId}:`, error);
            }
          }
        }

        if (wallet.user.notifyWeekly) {
          const shouldNotifyWeekly = !wallet.lastWeeklyAt || wallet.lastWeeklyAt <= weeklyThreshold;
          if (shouldNotifyWeekly && !NOTIFIED_WEEKLY.has(weeklyKey)) {
            try {
              const discordUser = await client.users.fetch(wallet.userId).catch(() => null);
              if (discordUser) {
                const embed = new EmbedBuilder()
                  .setTitle('🔔 Rappel hebdomadaire')
                  .setDescription(`Votre récompense hebdomadaire est disponible !\nUtilisez la commande \`/weekly\` pour réclamer **${currentSettings.weeklyAmount} ${currentSettings.currencySymbol}**.`)
                  .setColor('#8b5cf6')
                  .setTimestamp();

                await discordUser.send({ embeds: [embed] });
                NOTIFIED_WEEKLY.add(weeklyKey);
                
                setTimeout(() => {
                  NOTIFIED_WEEKLY.delete(weeklyKey);
                }, 8 * 24 * 60 * 60 * 1000);
              }
            } catch (error) {
              console.error(`[Economy] Impossible d'envoyer DM à ${wallet.userId}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error(`[Economy] Erreur lors du cron de notifications pour ${guildId}:`, error);
    }
  }, 5 * 60 * 1000);

  runningIntervals.set(guildId, interval);
  console.log(`[Economy] Cron de notifications démarré pour ${guildId} (interval: 5min)`);
}

export function stopNotificationCron(guildId: string): void {
  const interval = runningIntervals.get(guildId);
  if (interval) {
    clearInterval(interval);
    runningIntervals.delete(guildId);
    console.log(`[Economy] Cron de notifications arrêté pour ${guildId}`);
  }
}

export function stopAllNotificationCrons(): void {
  for (const [guildId, interval] of runningIntervals.entries()) {
    clearInterval(interval);
    console.log(`[Economy] Cron de notifications arrêté pour ${guildId}`);
  }
  runningIntervals.clear();
}

export async function initializeNotificationCrons(client: Client, guildIds: string[]): Promise<void> {
  for (const guildId of guildIds) {
    try {
      const active = await isEconomyActive(guildId);
      if (!active) continue;

      const settings = await getEconomySettings(guildId);
      if (settings.enabled) {
        startNotificationCron(client, guildId);
      }
    } catch (error) {
      console.error(`[Economy] Erreur lors de l'initialisation du cron de notifications pour ${guildId}:`, error);
    }
  }
}
