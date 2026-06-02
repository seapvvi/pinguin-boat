import { Client, EmbedBuilder } from 'discord.js';
import { prisma, type StreamPlatform } from '@pinguin/db';
import { isModuleEnabled } from '../guards/module';
import { fetchStream } from './twitch';
import { fetchLiveStream, searchChannel } from './youtube';
import { logger } from '@pinguin/shared';

let cronInterval: NodeJS.Timeout | null = null;

export async function checkNotifications(client: Client): Promise<void> {
  try {
    const notifications = await prisma.streamNotification.findMany();

    for (const notif of notifications) {
      try {
        if (!(await isModuleEnabled(notif.guildId, 'notifications'))) continue;

        if (notif.platform === 'TWITCH') {
          await checkTwitchNotification(client, notif);
        } else if (notif.platform === 'YOUTUBE') {
          await checkYoutubeNotification(client, notif);
        }
      } catch (error) {
        logger.error(`Erreur notification ${notif.platform}/${notif.channelName}`, { error, guildId: notif.guildId });
      }
    }
  } catch (error) {
    logger.error('Erreur checkNotifications', { error });
  }
}

async function checkTwitchNotification(
  client: Client,
  notif: { id: string; guildId: string; channelName: string; channelId: string | null; discordChannelId: string; lastLiveAt: Date | null; isLive: boolean }
): Promise<void> {
  const stream = await fetchStream(notif.channelName);
  const isLiveNow = stream !== null;

  if (isLiveNow && !notif.isLive) {
    const guild = client.guilds.cache.get(notif.guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(notif.discordChannelId);
    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setColor(0x9146ff)
      .setTitle(`🔴 ${stream!.userName} est en live sur Twitch !`)
      .setURL(stream!.streamUrl)
      .setDescription(stream!.title)
      .addFields({ name: 'Jeu', value: stream!.gameName, inline: true })
      .setImage(stream!.thumbnailUrl)
      .setTimestamp();

    if (stream!.profileImageUrl) {
      embed.setThumbnail(stream!.profileImageUrl);
    }

    await channel.send({ embeds: [embed] });

    await prisma.streamNotification.update({
      where: { id: notif.id },
      data: {
        isLive: true,
        lastLiveAt: new Date(),
        channelId: notif.channelId,
      },
    });
  } else if (!isLiveNow && notif.isLive) {
    await prisma.streamNotification.update({
      where: { id: notif.id },
      data: { isLive: false },
    });
  }
}

async function checkYoutubeNotification(
  client: Client,
  notif: { id: string; guildId: string; channelName: string; channelId: string | null; discordChannelId: string; lastLiveAt: Date | null; isLive: boolean; lastVideoId: string | null }
): Promise<void> {
  let channelId = notif.channelId;

  if (!channelId) {
    const channel = await searchChannel(notif.channelName);
    if (!channel) return;
    channelId = channel.channelId;

    await prisma.streamNotification.update({
      where: { id: notif.id },
      data: { channelId },
    });
  }

  const stream = await fetchLiveStream(channelId);
  const isLiveNow = stream !== null;

  if (isLiveNow && stream!.videoId !== notif.lastVideoId) {
    const guild = client.guilds.cache.get(notif.guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(notif.discordChannelId);
    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle(`🔴 ${stream!.channelName} est en live sur YouTube !`)
      .setURL(stream!.streamUrl)
      .setDescription(stream!.videoTitle)
      .setImage(stream!.thumbnailUrl)
      .setTimestamp();

    if (stream!.channelAvatarUrl) {
      embed.setThumbnail(stream!.channelAvatarUrl);
    }

    await channel.send({ embeds: [embed] });

    await prisma.streamNotification.update({
      where: { id: notif.id },
      data: {
        isLive: true,
        lastLiveAt: new Date(),
        lastVideoId: stream!.videoId,
      },
    });
  } else if (!isLiveNow && notif.isLive) {
    await prisma.streamNotification.update({
      where: { id: notif.id },
      data: { isLive: false },
    });
  }
}

export function startStreamNotificationCron(client: Client): void {
  if (cronInterval) return;

  logger.info('[Notifications] Démarrage du cron toutes les 2 minutes');

  cronInterval = setInterval(() => {
    checkNotifications(client).catch((err) => {
      logger.error('[Notifications] Erreur cron', { error: err });
    });
  }, 2 * 60 * 1000);

  checkNotifications(client).catch((err) => {
    logger.error('[Notifications] Erreur premier check', { error: err });
  });
}

export function stopStreamNotificationCron(): void {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    logger.info('[Notifications] Cron arrêté');
  }
}
