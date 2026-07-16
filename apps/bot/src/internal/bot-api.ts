import http from 'http';
import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { prisma } from '@pinguin/db';
import { getConfig } from '@pinguin/config';
import * as music from '../services/music';
import { invalidateCache } from '../utils/cache';
import { invalidateAutoModCache } from '../services/automod';
import { invalidateModuleCache } from '../guards/module';
import { logger } from '@pinguin/shared';

export function startInternalBotApi(client: Client): void {
  const config = getConfig();
  const port = config.BOT_INTERNAL_PORT;
  const secret = config.BOT_INTERNAL_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('BOT_INTERNAL_SECRET must be set in production'); })() : 'dev-secret');

  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.headers['x-internal-secret'] !== secret) {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: 'Forbidden' }));
      return;
    }

    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const path = url.pathname;
      const guildId = path.match(/\/internal\/guilds\/([^/]+)/)?.[1];

      // GET /internal/ping — health check (no guildId required)
      if (path === '/internal/ping' && req.method === 'GET') {
        res.end(JSON.stringify({ success: true, uptime: process.uptime() }));
        return;
      }

      if (path === '/internal/stats' && req.method === 'GET') {
        let onlineMembers = 0;
        let totalMembers = 0;
        for (const g of client.guilds.cache.values()) {
          totalMembers += g.memberCount;
          onlineMembers += g.members.cache.filter(
            (m) => m.presence?.status && m.presence.status !== 'offline'
          ).size;
        }
        res.end(JSON.stringify({
          success: true,
          data: {
            guildCount: client.guilds.cache.size,
            totalMembers,
            onlineMembers,
            activeMembers: onlineMembers,
          },
        }));
        return;
      }

      // POST /internal/invalidate-modules/:guildId — invalidate module cache
      const invalidateModulesMatch = path.match(/\/internal\/invalidate-modules\/([^/]+)/);
      if (invalidateModulesMatch && req.method === 'POST') {
        invalidateModuleCache(invalidateModulesMatch[1]);
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (!guildId) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Missing guildId' }));
        return;
      }

      // GET /internal/guilds/:guildId — guild live data
      if (path === `/internal/guilds/${guildId}` && req.method === 'GET') {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Guild not found' }));
          return;
        }
        res.end(JSON.stringify({
          memberCount: guild.memberCount,
          channelCount: guild.channels.cache.size,
          roleCount: guild.roles.cache.size,
          onlineMemberCount: guild.members.cache.filter(m => m.presence?.status !== 'offline').size,
          name: guild.name,
          icon: guild.iconURL(),
        }));
        return;
      }

      // GET /internal/guilds/:guildId/queue — music queue state
      if (path === `/internal/guilds/${guildId}/queue` && req.method === 'GET') {
        const state = music.getQueueState(guildId);
        res.end(JSON.stringify({ success: true, data: state }));
        return;
      }

      // POST /internal/guilds/:guildId/play — play a track
      if (path === `/internal/guilds/${guildId}/play` && req.method === 'POST') {
        const body = await readBody(req);
        const voiceChannelId = body.voiceChannelId;
        const query = body.query;
        if (!query || !voiceChannelId) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'query and voiceChannelId required' }));
          return;
        }
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Guild not found' }));
          return;
        }
        const member = guild.members.me;
        if (!member) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Bot member not found in guild' }));
          return;
        }
        const textChannel = guild.channels.cache.find(c => c.isTextBased() && c.id !== voiceChannelId) as TextChannel;
        if (!textChannel) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'No suitable text channel found' }));
          return;
        }
        try {
          const track = await music.play(guildId, query, member, textChannel);
          res.end(JSON.stringify({ success: true, data: track }));
        } catch (err: any) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // POST /internal/guilds/:guildId/control — control playback
      if (path === `/internal/guilds/${guildId}/control` && req.method === 'POST') {
        const body = await readBody(req);
        const action = body.action;
        const value = body.value;

        switch (action) {
          case 'PLAY': {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Guild not found' }));
              return;
            }
            const member = guild.members.me;
            if (!member) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Bot member not found in guild' }));
              return;
            }
            const textChannel = guild.channels.cache.find(c => c.isTextBased()) as TextChannel;
            if (member && textChannel && value) {
              try {
                const track = await music.play(guildId, String(value), member, textChannel);
                res.end(JSON.stringify({ success: true, data: track }));
              } catch (err: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: err.message }));
              }
            }
            break;
          }
          case 'PAUSE':
            music.pause(guildId);
            res.end(JSON.stringify({ success: true }));
            break;
          case 'RESUME':
            music.resume(guildId);
            res.end(JSON.stringify({ success: true }));
            break;
          case 'SKIP': {
            const skipped = await music.skip(guildId);
            res.end(JSON.stringify({ success: true, data: skipped }));
            break;
          }
          case 'STOP':
            await music.stop(guildId);
            res.end(JSON.stringify({ success: true }));
            break;
          case 'VOLUME':
            music.setVolume(guildId, parseInt(String(value)) || 50);
            await music.saveQueueToDb(guildId);
            res.end(JSON.stringify({ success: true }));
            break;
          case 'LOOP':
            music.setLoop(guildId, value as music.LoopMode);
            await music.saveQueueToDb(guildId);
            res.end(JSON.stringify({ success: true }));
            break;
          case 'SHUFFLE':
            music.toggleShuffle(guildId);
            await music.saveQueueToDb(guildId);
            res.end(JSON.stringify({ success: true }));
            break;
          default:
            res.statusCode = 400;
            res.end(JSON.stringify({ error: `Unknown action: ${action}` }));
        }
        return;
      }

      // POST /internal/guilds/:guildId/create-channel — create ticket channel from bot context
      if (path === `/internal/guilds/${guildId}/create-channel` && req.method === 'POST') {
        const body = await readBody(req);
        const guild = client.guilds.cache.get(guildId);
        if (!guild) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Guild not found' })); return; }
        try {
          const { ChannelType, PermissionFlagsBits: PFB } = await import('discord.js');
          const overwrites: any[] = [
            { id: guild.roles.everyone.id, deny: [PFB.ViewChannel] },
            { id: body.userId, allow: [PFB.ViewChannel, PFB.SendMessages, PFB.ReadMessageHistory] },
            { id: client.user!.id, allow: [PFB.ViewChannel, PFB.SendMessages, PFB.ReadMessageHistory, PFB.ManageChannels] },
          ];
          if (Array.isArray(body.modRoles)) {
            for (const roleId of body.modRoles) {
              overwrites.push({ id: roleId, allow: [PFB.ViewChannel, PFB.SendMessages, PFB.ReadMessageHistory] });
            }
          }
          const channel = await guild.channels.create({
            name: body.channelName ?? `ticket-${body.userId}`,
            type: ChannelType.GuildText,
            parent: body.categoryId ?? undefined,
            permissionOverwrites: overwrites,
            reason: body.reason ?? 'Ticket ouvert',
          });
          res.end(JSON.stringify({ success: true, data: { channelId: channel.id, channelMention: channel.toString() } }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // POST /internal/guilds/:guildId/leave — bot leaves the guild
      if (path === `/internal/guilds/${guildId}/leave` && req.method === 'POST') {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Guild not found' })); return; }
        try {
          await guild.leave();
          res.end(JSON.stringify({ success: true }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // POST /internal/guilds/:guildId/emergency — lock/unlock guild
      if (path === `/internal/guilds/${guildId}/emergency` && req.method === 'POST') {
        const body = await readBody(req);
        const enable = body.enable !== false;
        const { setEmergencyMode } = await import('../services/protection');
        await setEmergencyMode(client, guildId, enable);
        res.end(JSON.stringify({ success: true, emergencyMode: enable }));
        return;
      }

      // POST /internal/guilds/:guildId/modules — notify module changes
      if (path === `/internal/guilds/${guildId}/modules` && req.method === 'POST') {
        const body = await readBody(req);
        const disabledModules: string[] = body.disabledModules ?? [];
        logger.info(`Modules mis à jour pour ${guildId}`, { disabledModules });
        invalidateCache(`modules:${guildId}`);
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // POST /internal/guilds/:guildId/automod/invalidate — invalidate automod cache
      if (path === `/internal/guilds/${guildId}/automod/invalidate` && req.method === 'POST') {
        invalidateAutoModCache(guildId);
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // POST /internal/guilds/:guildId/send-test-notification — send test notification embed
      if (path === `/internal/guilds/${guildId}/send-test-notification` && req.method === 'POST') {
        const body = await readBody(req);
        const notifId = body.notificationId;
        if (!notifId) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'notificationId required' }));
          return;
        }
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Guild not found' }));
          return;
        }
        try {
          const notif = await prisma.streamNotification.findUnique({ where: { id: notifId } });
          if (!notif || notif.guildId !== guildId) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Notification not found' }));
            return;
          }
          const channel = guild.channels.cache.get(notif.discordChannelId);
          if (!channel || !channel.isTextBased()) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Discord channel not found or not text-based' }));
            return;
          }
          const embed = new EmbedBuilder()
            .setColor(notif.customColor ? parseInt(notif.customColor.replace('#', ''), 16) : 0x9146ff)
            .setTitle(notif.customTitle?.replace(/{streamer}/g, notif.channelName).replace(/{game}/g, 'Test Game').replace(/{title}/g, 'Test Title') ?? `🔴 ${notif.channelName} est en direct (TEST)`)
            .setDescription(notif.customDescription?.replace(/{streamer}/g, notif.channelName).replace(/{game}/g, 'Test Game').replace(/{title}/g, 'Test Title') ?? 'Ceci est une notification de test. Votre configuration fonctionne correctement.')
            .setThumbnail('https://cdn.discordapp.com/embed/avatars/0.png')
            .setImage('https://via.placeholder.com/640x360.png?text=Test+Stream')
            .setTimestamp();
          if (notif.customFooter) {
            embed.setFooter({ text: notif.customFooter });
          }
          const content = notif.pingEveryoneOnLive ? '@everyone' : undefined;
          await channel.send({ content, embeds: [embed] });
          res.end(JSON.stringify({ success: true }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // POST /internal/guilds/:guildId/restore — restore backup
      if (path === `/internal/guilds/${guildId}/restore` && req.method === 'POST') {
        const body = await readBody(req);
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Guild not found' }));
          return;
        }
        const backupData = body.backupData;
        if (!backupData || !Array.isArray(backupData.channels) || !Array.isArray(backupData.roles)) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid backup data' }));
          return;
        }
        try {
          const result = await executeRestore(guild, backupData);
          res.end(JSON.stringify({ success: true, data: result }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      // GET /internal/guilds/:guildId/search — search tracks
      if (path.startsWith(`/internal/guilds/${guildId}/search`) && req.method === 'GET') {
        const query = url.searchParams.get('q') || '';
        if (!query) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'query required' }));
          return;
        }
        try {
          const ytDlp = await import('yt-dlp-exec').then(m => m.default);
          const raw = await ytDlp(`ytsearch5:${query}`, {
            dumpSingleJson: true,
            noWarnings: true,
            preferFreeFormats: true,
            skipDownload: true,
            noPlaylist: true,
          });
          const results = Array.isArray(raw) ? raw : [raw];
          const tracks = results.filter(Boolean).map((v: any) => ({
            title: v.title,
            url: v.webpage_url,
            duration: v.duration,
            thumbnail: v.thumbnail ?? null,
            author: v.channel ?? v.uploader ?? 'Inconnu',
          }));
          res.end(JSON.stringify({ success: true, data: tracks }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (err: any) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn(`Le port interne ${port} est déjà utilisé — API interne non démarrée`);
    } else {
      logger.error('Erreur API interne', { err: err.message });
    }
  });

  server.listen(port, '127.0.0.1', () => {
    logger.info(`Internal API listening on 127.0.0.1:${port}`);
  });
}

async function executeRestore(
  guild: import('discord.js').Guild,
  backupData: { channels: any[]; roles: any[] },
): Promise<{ channelsRestored: number; rolesRestored: number }> {
  const oldToNewChannels = new Map<string, string>();

  // 1. Supprimer tous les canaux existants
  logger.info(`[RESTORE] Suppression des canaux existants pour ${guild.id}`);
  const channels = await guild.channels.fetch();
  const deletePromises: Promise<void>[] = [];
  for (const [, channel] of channels) {
    if (channel) {
      deletePromises.push(channel.delete('Restauration de backup').catch(() => {}) as Promise<void>);
    }
  }
  await Promise.all(deletePromises);
  logger.info(`[RESTORE] ${channels.size} canaux supprimés`);

  // 2. Supprimer les rôles existants (sauf @everyone et managed)
  logger.info(`[RESTORE] Suppression des rôles existants pour ${guild.id}`);
  const roles = await guild.roles.fetch();
  const deleteRolePromises: Promise<void>[] = [];
  for (const [, role] of roles) {
    if (role && role.name !== '@everyone' && !role.managed && role.editable) {
      deleteRolePromises.push(role.delete('Restauration de backup').catch(() => {}) as Promise<void>);
    }
  }
  await Promise.all(deleteRolePromises);
  logger.info(`[RESTORE] Rôles supprimés`);

  // 3. Créer les rôles depuis le backup (triés par position)
  logger.info(`[RESTORE] Création des rôles depuis le backup`);
  const sortedRoles = [...backupData.roles]
    .filter(r => r.name !== '@everyone')
    .sort((a: any, b: any) => a.position - b.position);

  for (const roleData of sortedRoles) {
    try {
      const role = await guild.roles.create({
        name: roleData.name,
        color: roleData.color ?? 0,
        hoist: roleData.hoist ?? false,
        permissions: BigInt(roleData.permissions ?? '0'),
        mentionable: roleData.mentionable ?? false,
        unicodeEmoji: roleData.unicodeEmoji || undefined,
        reason: 'Restauration de backup',
      });
      if (roleData.position != null) {
        await role.setPosition(roleData.position).catch(() => {});
      }
    } catch (err: any) {
      logger.warn(`[RESTORE] Impossible de créer le rôle ${roleData.name}: ${err.message}`);
    }
  }
  logger.info(`[RESTORE] ${sortedRoles.length} rôles créés`);

  // 4. Créer les canaux (catégories d'abord, puis les autres)
  logger.info(`[RESTORE] Création des canaux depuis le backup`);
  const channelsData = backupData.channels;
  const categories = channelsData
    .filter((c: any) => c.type === 4)
    .sort((a: any, b: any) => a.position - b.position);
  const nonCategories = channelsData
    .filter((c: any) => c.type !== 4)
    .sort((a: any, b: any) => a.position - b.position);

  // Créer les catégories en premier
  for (const catData of categories) {
    try {
      const channel = await guild.channels.create({
        name: catData.name,
        type: catData.type,
        reason: 'Restauration de backup',
      });
      oldToNewChannels.set(catData.id, channel.id);
      if (catData.position != null) {
        await channel.setPosition(catData.position).catch(() => {});
      }
    } catch (err: any) {
      logger.warn(`[RESTORE] Impossible de créer la catégorie ${catData.name}: ${err.message}`);
    }
  }

  // Créer les autres canaux
  for (const chData of nonCategories) {
    try {
      const options: any = {
        name: chData.name,
        type: chData.type,
        reason: 'Restauration de backup',
      };
      if (chData.topic) options.topic = chData.topic;
      if (chData.nsfw) options.nsfw = chData.nsfw;
      if (chData.bitrate) options.bitrate = chData.bitrate;
      if (chData.userLimit) options.userLimit = chData.userLimit;
      if (chData.rateLimitPerUser) options.rateLimitPerUser = chData.rateLimitPerUser;

      // Mapper le parent (catégorie) si présent
      const newParentId = chData.parentId ? oldToNewChannels.get(chData.parentId) : undefined;
      if (newParentId) options.parent = newParentId;

      // Convertir les permission overwrites
      if (Array.isArray(chData.permissionOverwrites) && chData.permissionOverwrites.length > 0) {
        options.permissionOverwrites = chData.permissionOverwrites.map((ow: any) => ({
          id: ow.id,
          allow: BigInt(ow.allow || '0'),
          deny: BigInt(ow.deny || '0'),
          type: ow.type ?? 0,
        }));
      }

      const channel = await guild.channels.create(options);
      oldToNewChannels.set(chData.id, channel.id);
      if (chData.position != null) {
        await channel.setPosition(chData.position).catch(() => {});
      }
    } catch (err: any) {
      logger.warn(`[RESTORE] Impossible de créer le canal ${chData.name}: ${err.message}`);
    }
  }

  logger.info(`[RESTORE] Restauration terminée pour ${guild.id}`);
  return {
    channelsRestored: channelsData.length,
    rolesRestored: sortedRoles.length,
  };
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}
