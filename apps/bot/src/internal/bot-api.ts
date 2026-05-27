import http from 'http';
import { Client, TextChannel } from 'discord.js';
import * as music from '../services/music';
import { invalidateCache } from '../utils/cache';
import { invalidateAutoModCache } from '../services/automod';

export function startInternalBotApi(client: Client): void {
  const port = parseInt(process.env.BOT_INTERNAL_PORT || '3002');
  const secret = process.env.BOT_INTERNAL_SECRET || 'dev-secret';

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
        const member = guild.members.me!;
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
            const member = client.guilds.cache.get(guildId)?.members.me!;
            const textChannel = client.guilds.cache.get(guildId)?.channels.cache.find(c => c.isTextBased()) as TextChannel;
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
        console.log(`[BotAPI] Modules mis à jour pour ${guildId}:`, disabledModules);
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

      // GET /internal/guilds/:guildId/search — search tracks
      if (path.startsWith(`/internal/guilds/${guildId}/search`) && req.method === 'GET') {
        const query = url.searchParams.get('q') || '';
        if (!query) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'query required' }));
          return;
        }
        try {
          const { search } = await import('play-dl');
          const results = await search(query, { source: { youtube: 'video' }, limit: 5 });
          const tracks = results.map((v: any) => ({
            title: v.title,
            url: v.url,
            duration: v.durationInSec,
            thumbnail: v.thumbnails?.[0]?.url ?? null,
            author: v.channel?.name ?? 'Inconnu',
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

  server.listen(port, '127.0.0.1', () => {
    console.log(`[BotAPI] Internal API listening on 127.0.0.1:${port}`);
  });
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
