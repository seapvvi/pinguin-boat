import { Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { createEmbed } from './embed';
import { logger } from '@pinguin/shared';

const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

let cronInterval: NodeJS.Timeout | null = null;

export function startPollCron(client: Client): void {
  if (cronInterval) return;

  logger.info('[PollCron] Démarrage du cron toutes les 30 secondes');

  cronInterval = setInterval(() => {
    closeExpiredPolls(client).catch((err) => {
      logger.error('[PollCron] Erreur', { error: err });
    });
  }, 30 * 1000);

  closeExpiredPolls(client).catch((err) => {
    logger.error('[PollCron] Erreur premier check', { error: err });
  });
}

export function stopPollCron(): void {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    logger.info('[PollCron] Cron arrêté');
  }
}

async function closeExpiredPolls(client: Client): Promise<void> {
  const now = new Date();

  const expired = await prisma.poll.findMany({
    where: {
      status: 'OPEN',
      endsAt: { lte: now },
    },
    include: { votes: true },
  });

  for (const poll of expired) {
    try {
      await prisma.poll.update({
        where: { id: poll.id },
        data: { status: 'CLOSED' },
      });

      const options: { id: string; label: string; votes: number }[] = JSON.parse(poll.options);
      const voteCounts = new Array(options.length).fill(0);
      for (const v of poll.votes) {
        voteCounts[v.optionIndex] = (voteCounts[v.optionIndex] || 0) + 1;
      }

      const descLines = options.map((opt, i) =>
        `${numberEmojis[i] || `${i + 1}.`} ${opt.label} — **${voteCounts[i]}** vote(s)`
      ).join('\n');

      if (poll.messageId && poll.channelId) {
        const guild = client.guilds.cache.get(poll.guildId);
        if (guild) {
          try {
            const channel = await guild.channels.fetch(poll.channelId);
            if (channel?.isTextBased()) {
              const msg = await channel.messages.fetch(poll.messageId).catch(() => null);
              if (msg) {
                const embed = createEmbed('poll')
                  .setTitle(`📊 ${poll.question} (Terminé)`)
                  .setDescription(descLines)
                  .setFooter({ text: 'Sondage fermé automatiquement' });
                await msg.edit({ embeds: [embed] });
              }
            }
          } catch { /* channel/message deleted */ }
        }
      }

      logger.info(`[PollCron] Sondage fermé: ${poll.question} (${poll.id})`, { guildId: poll.guildId });
    } catch (error) {
      logger.error(`[PollCron] Erreur fermeture sondage ${poll.id}`, { error, guildId: poll.guildId });
    }
  }
}
