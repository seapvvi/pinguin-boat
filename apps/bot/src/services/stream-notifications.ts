import { Client, EmbedBuilder } from 'discord.js';
import { prisma, type StreamPlatform } from '@pinguin/db';
import { isModuleEnabled } from '../guards/module';
import { fetchStream } from './twitch';
import { fetchLatestVideo, fetchLiveStream, searchChannel } from './youtube';
import { logger } from '@pinguin/shared';

type NotifRow = Awaited<ReturnType<typeof prisma.streamNotification.findMany>>[number];

let cronInterval: NodeJS.Timeout | null = null;

function buildLiveEmbed(
  notif: NotifRow,
  overrides: {
    defaultColor: number;
    title: string;
    url: string;
    description: string;
    thumbnailUrl?: string | null;
    profileImageUrl?: string | null;
    gameName?: string;
    streamerName: string;
  },
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(notif.customColor ? parseInt(notif.customColor.replace('#', ''), 16) : overrides.defaultColor)
    .setURL(overrides.url)
    .setImage(overrides.thumbnailUrl ?? null)
    .setTimestamp();

  if (notif.customTitle) {
    const resolved = notif.customTitle
      .replace(/{streamer}/g, overrides.streamerName)
      .replace(/{game}/g, overrides.gameName ?? '')
      .replace(/{title}/g, overrides.description);
    embed.setTitle(resolved);
  } else {
    embed.setTitle(overrides.title);
  }

  if (notif.customDescription) {
    const resolved = notif.customDescription
      .replace(/{streamer}/g, overrides.streamerName)
      .replace(/{game}/g, overrides.gameName ?? '')
      .replace(/{title}/g, overrides.description);
    embed.setDescription(resolved);
  } else {
    embed.setDescription(overrides.description);
  }

  if (notif.customFooter) {
    embed.setFooter({ text: notif.customFooter });
  }

  if (overrides.profileImageUrl) {
    embed.setThumbnail(overrides.profileImageUrl);
  }

  if (overrides.gameName && !notif.customTitle && !notif.customDescription) {
    embed.addFields({ name: 'Jeu', value: overrides.gameName, inline: true });
  }

  return embed;
}

function buildVideoEmbed(
  notif: NotifRow,
  overrides: {
    defaultColor: number;
    title: string;
    url: string;
    description?: string;
    thumbnail: string;
    streamerName: string;
  },
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(notif.customColor ? parseInt(notif.customColor.replace('#', ''), 16) : overrides.defaultColor)
    .setURL(overrides.url)
    .setImage(overrides.thumbnail)
    .setTimestamp();

  if (notif.customTitle) {
    const resolved = notif.customTitle
      .replace(/{streamer}/g, overrides.streamerName)
      .replace(/{game}/g, '')
      .replace(/{title}/g, overrides.description ?? overrides.title);
    embed.setTitle(resolved);
  } else {
    embed.setTitle(overrides.title);
  }

  if (notif.customDescription) {
    const resolved = notif.customDescription
      .replace(/{streamer}/g, overrides.streamerName)
      .replace(/{game}/g, '')
      .replace(/{title}/g, overrides.description ?? overrides.title);
    embed.setDescription(resolved);
  } else if (overrides.description) {
    embed.setDescription(overrides.description);
  }

  if (notif.customFooter) {
    embed.setFooter({ text: notif.customFooter });
  }

  return embed;
}

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
  notif: NotifRow,
): Promise<void> {
  const stream = await fetchStream(notif.channelName);
  const isLiveNow = stream !== null;

  if (isLiveNow && !notif.isLive) {
    const guild = client.guilds.cache.get(notif.guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(notif.discordChannelId);
    if (!channel || !channel.isTextBased()) return;

    const embed = buildLiveEmbed(notif, {
      defaultColor: 0x9146ff,
      title: `🔴 ${stream!.userName} est en live sur Twitch !`,
      url: stream!.streamUrl,
      description: stream!.title,
      thumbnailUrl: stream!.thumbnailUrl,
      profileImageUrl: stream!.profileImageUrl,
      gameName: stream!.gameName,
      streamerName: stream!.userName,
    });

    const content = notif.pingEveryoneOnLive ? '@everyone' : undefined;

    await channel.send({ content, embeds: [embed] });

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
  notif: NotifRow,
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

  // ─── Détection live ───
  const stream = await fetchLiveStream(channelId);
  const isLiveNow = stream !== null;

  if (isLiveNow && stream!.videoId !== notif.lastLiveId) {
    const guild = client.guilds.cache.get(notif.guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(notif.discordChannelId);
    if (!channel || !channel.isTextBased()) return;

    const embed = buildLiveEmbed(notif, {
      defaultColor: 0xff0000,
      title: `🔴 ${stream!.channelName} est en live sur YouTube !`,
      url: stream!.streamUrl,
      description: stream!.videoTitle,
      thumbnailUrl: stream!.thumbnailUrl,
      profileImageUrl: stream!.channelAvatarUrl,
      streamerName: stream!.channelName,
    });

    const content = notif.pingEveryoneOnLive ? '@everyone' : undefined;

    await channel.send({ content, embeds: [embed] });

    await prisma.streamNotification.update({
      where: { id: notif.id },
      data: {
        isLive: true,
        lastLiveAt: new Date(),
        lastLiveId: stream!.videoId,
      },
    });
  } else if (!isLiveNow && notif.isLive) {
    await prisma.streamNotification.update({
      where: { id: notif.id },
      data: { isLive: false },
    });
  }

  // ─── Détection nouvelle vidéo ───
  const video = await fetchLatestVideo(channelId);

  if (video && video.videoId !== notif.lastVideoId) {
    const guild = client.guilds.cache.get(notif.guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(notif.discordChannelId);
    if (!channel || !channel.isTextBased()) return;

    const embed = buildVideoEmbed(notif, {
      defaultColor: 0xff0000,
      title: `📹 Nouvelle vidéo YouTube : ${video.title}`,
      url: video.url,
      description: video.title,
      thumbnail: video.thumbnail,
      streamerName: notif.channelName,
    });

    const content = notif.pingEveryoneOnLive ? '@everyone' : undefined;

    await channel.send({ content, embeds: [embed] });

    await prisma.streamNotification.update({
      where: { id: notif.id },
      data: { lastVideoId: video.videoId },
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
