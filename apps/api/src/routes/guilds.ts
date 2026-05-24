import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@pinguin/db';
import { getConfig } from '@pinguin/config';
import { authenticate } from '../middleware/auth';
import { validateParams } from '../middleware/validate';
import { success, error } from '../utils/response';
import { sendDM, timeoutMember, kickMember, banMember, unbanMember, sendChannelMessage, editMessage, addMessageReaction, createGuildChannel, deleteChannel, editChannel, getGuildChannels, getGuildRoles, NUMBER_EMOJIS } from '../services/discord';
import { z } from 'zod';

const config = getConfig();

const guildIdSchema = z.object({ guildId: z.string().min(1) });
const ticketIdSchema = z.object({ guildId: z.string().min(1), ticketId: z.string().min(1) });
const embedIdSchema = z.object({ guildId: z.string().min(1), id: z.string().min(1) });
const suggestionIdSchema = z.object({ guildId: z.string().min(1), id: z.string().min(1) });
const giveawayIdSchema = z.object({ guildId: z.string().min(1), id: z.string().min(1) });
const pollIdSchema = z.object({ guildId: z.string().min(1), id: z.string().min(1) });

const guildParam = { preHandler: [authenticate, validateParams(guildIdSchema)] };

export async function guildRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const guilds = await prisma.guild.findMany({
        select: {
          id: true, name: true, icon: true, ownerId: true, memberCount: true,
          botPresent: true,
        },
        orderBy: [{ botPresent: 'desc' }, { memberCount: 'desc' }],
      });
      const premiumGuildIds = new Set(
        (await prisma.premiumSubscription.findMany({
          where: { guildId: { not: null }, status: 'ACTIVE' },
          select: { guildId: true },
        })).map((s) => s.guildId).filter(Boolean)
      );
      const enriched = guilds.map((g) => ({
        ...g,
        premium: (premiumGuildIds.has(g.id) ? 'BASIC' : 'FREE') as 'BASIC' | 'FREE',
      }));
      reply.send(success({ guilds: enriched }));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur lors de la récupération'));
    }
  });

  const MODULE_FIELDS = ['moderation','protection','tickets','logs','levels','economy','music','giveaways','polls','suggestions','welcome','autoroles','embeds'] as const;
  const MODULE_DEFAULTS: Record<string, boolean> = {
    moderation: true, protection: true, tickets: false, logs: true,
    levels: true, economy: false, music: true, giveaways: true,
    polls: true, suggestions: true, welcome: true, autoroles: true, embeds: true,
  };

  function computeDisabledModules(modulesEnabled: any): string[] {
    return MODULE_FIELDS
      .filter(f => modulesEnabled ? !modulesEnabled[f] : !MODULE_DEFAULTS[f])
      .map(f => f.toUpperCase());
  }

  app.get('/:guildId', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const guild = await prisma.guild.findUnique({
        where: { id: guildId },
        include: {
          settings: true, modulesEnabled: true, logSettings: true,
          xpSettings: true, welcomeSettings: true,
          autoroleSettings: { include: { entries: true } },
        },
      });
      if (!guild) return reply.status(404).send(error('Serveur introuvable'));
      let channelCount = 0, roleCount = 0;
      try {
        const [channels, roles] = await Promise.all([
          getGuildChannels(guildId),
          getGuildRoles(guildId),
        ]);
        channelCount = channels.length;
        roleCount = roles.length;
      } catch {}
      const payload = {
        ...guild, disabledModules: computeDisabledModules(guild.modulesEnabled),
        memberCount: guild.memberCount, channelCount, roleCount,
      };
      reply.send(success({ guild: payload }));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur'));
    }
  });

  app.put('/:guildId', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;

      if (Array.isArray(body.disabledModules)) {
        const data: Record<string, boolean> = {};
        for (const f of MODULE_FIELDS) {
          data[f] = !body.disabledModules.map((m: string) => m.toLowerCase()).includes(f);
        }
        await prisma.moduleEnabled.upsert({
          where: { guildId },
          update: data,
          create: { guildId, ...data },
        });
      }

      const guild = await prisma.guild.findUnique({
        where: { id: guildId },
        include: {
          settings: true, modulesEnabled: true, logSettings: true,
          xpSettings: true, welcomeSettings: true,
          autoroleSettings: { include: { entries: true } },
        },
      });
      if (!guild) return reply.status(404).send(error('Serveur introuvable'));
      const payload = { ...guild, disabledModules: computeDisabledModules(guild.modulesEnabled) };
      reply.send(success({ guild: payload }));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur'));
    }
  });

  app.get('/:guildId/settings', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      let settings = await prisma.guildSettings.findUnique({ where: { guildId } });
      if (!settings) {
        settings = await prisma.guildSettings.create({ data: { guildId } });
      }
      reply.send(success({ settings }));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur'));
    }
  });

  app.put('/:guildId/settings', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      await prisma.guildSettings.upsert({
        where: { guildId },
        update: {
          prefix: body.prefix ?? undefined,
          locale: body.locale ?? undefined,
          timezone: body.timezone ?? undefined,
          modLogChannel: body.modLogChannel ?? undefined,
          modRoleIds: body.modRoleIds ? JSON.stringify(body.modRoleIds) : undefined,
          adminRoleIds: body.adminRoleIds ? JSON.stringify(body.adminRoleIds) : undefined,
          muteRoleId: body.muteRoleId ?? undefined,
        },
        create: {
          guildId,
          prefix: body.prefix ?? '/',
          locale: body.locale ?? 'fr',
          modRoleIds: body.modRoleIds ? JSON.stringify(body.modRoleIds) : '[]',
          adminRoleIds: body.adminRoleIds ? JSON.stringify(body.adminRoleIds) : '[]',
        },
      });
      reply.send(success(null, 'Paramètres mis à jour'));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur de mise à jour'));
    }
  });

  app.get('/:guildId/modules', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      let modules = await prisma.moduleEnabled.findUnique({ where: { guildId } });
      if (!modules) modules = await prisma.moduleEnabled.create({ data: { guildId } });
      reply.send(success({ modules }));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur'));
    }
  });

  app.put('/:guildId/modules', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      const fields = ['moderation','protection','tickets','logs','levels','economy','music','giveaways','polls','suggestions','welcome','autoroles','embeds'];
      const data: any = {};
      for (const f of fields) { if (typeof body[f] === 'boolean') data[f] = body[f]; }
      if (Object.keys(data).length > 0) {
        await prisma.moduleEnabled.upsert({ where: { guildId }, update: data, create: { guildId, ...data } });
      }
      reply.send(success(null, 'Modules mis à jour'));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur'));
    }
  });

  app.get('/:guildId/moderation', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
      const where = { guildId, deletedAt: null } as any;
      const [modCases, total] = await Promise.all([
        prisma.moderationCase.findMany({
          where, orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
          include: { user: { select: { username: true, avatar: true } } },
        }),
        prisma.moderationCase.count({ where }),
      ]);
      reply.send(success({
        cases: modCases,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur'));
    }
  });

  async function ensureUser(discordId: string) {
    const existing = await prisma.user.findUnique({ where: { discordId } });
    if (existing) return existing;
    return prisma.user.create({ data: { discordId, username: discordId } });
  }

  app.delete('/:guildId/moderation/:caseId', { preHandler: [authenticate, validateParams(z.object({ guildId: z.string(), caseId: z.string() }))] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, caseId } = request.params as any;
      const modCase = await prisma.moderationCase.findFirst({ where: { id: caseId, guildId } });
      if (!modCase) return reply.status(404).send(error('Cas introuvable'));
      await prisma.moderationCase.update({ where: { id: caseId }, data: { deletedAt: new Date() } });
      await prisma.auditLog.create({
        data: {
          guildId, action: 'MODERATION_CASE_DELETED',
          userId: request.user!.id,
          details: JSON.stringify({ caseId, targetUserId: modCase.userId }),
        },
      }).catch(() => {});
      reply.send(success(null, 'Cas supprimé'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.post('/:guildId/moderation', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      const type = body.type as string;
      if (!type || !body.userId || !body.reason)
        return reply.status(400).send(error('Type, utilisateur et raison requis'));
      await ensureUser(body.userId);

      const moderatorTag = request.user!.username || 'Dashboard';
      const reason = body.reason;
      const durationMs = body.duration ? body.duration * 1000 : null;

      switch (type) {
        case 'WARN':
          await sendDM(body.userId, {
            embeds: [{
              title: 'Avertissement',
              description: `Vous avez reçu un avertissement sur le serveur.\nRaison : ${reason}`,
              color: 0xFFA500,
              timestamp: new Date().toISOString(),
            }],
          }).catch(() => {});
          break;
        case 'MUTE':
        case 'TIMEOUT':
          await timeoutMember(guildId, body.userId, durationMs);
          await sendDM(body.userId, {
            embeds: [{
              title: 'Mute',
              description: `Vous avez été rendu muet.\nRaison : ${reason}${durationMs ? `\nDurée : ${Math.round(durationMs / 60000)} minutes` : ''}`,
              color: 0xFF0000,
              timestamp: new Date().toISOString(),
            }],
          }).catch(() => {});
          break;
        case 'UNMUTE':
          await timeoutMember(guildId, body.userId, null);
          break;
        case 'KICK':
          await kickMember(guildId, body.userId, `Expulsé par ${moderatorTag}: ${reason}`);
          await sendDM(body.userId, {
            embeds: [{
              title: 'Expulsion',
              description: `Vous avez été expulsé du serveur.\nRaison : ${reason}`,
              color: 0xFF0000,
              timestamp: new Date().toISOString(),
            }],
          }).catch(() => {});
          break;
        case 'BAN':
        case 'TEMPBAN':
          await banMember(guildId, body.userId, `Banni par ${moderatorTag}: ${reason}`);
          await sendDM(body.userId, {
            embeds: [{
              title: 'Bannissement',
              description: `Vous avez été banni du serveur.\nRaison : ${reason}${type === 'TEMPBAN' && durationMs ? `\nDurée : ${Math.round(durationMs / 3600000)} heures` : ''}`,
              color: 0xFF0000,
              timestamp: new Date().toISOString(),
            }],
          }).catch(() => {});
          break;
        case 'UNBAN':
          await unbanMember(guildId, body.userId, `Débanni par ${moderatorTag}: ${reason}`);
          break;
        default:
          return reply.status(400).send(error(`Type de modération inconnu: ${type}`));
      }

      const modCase = await prisma.moderationCase.create({
        data: {
          guildId, userId: body.userId, moderatorId: request.user!.id,
          type, reason,
          duration: body.duration || null,
          expiresAt: body.duration ? new Date(Date.now() + body.duration * 1000) : null,
        },
      });
      reply.status(201).send(success(modCase, 'Action exécutée sur Discord'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/tickets', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
      const where: any = { guildId };
      if (q.status) where.status = q.status;
      const [tickets, total] = await Promise.all([
        prisma.ticket.findMany({
          where, orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
          include: { creator: { select: { username: true, avatar: true } }, claimedBy: { select: { username: true } } },
        }),
        prisma.ticket.count({ where }),
      ]);
      reply.send(success({
        tickets,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.post('/:guildId/tickets', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      if (!body.subject) return reply.status(400).send(error('Sujet requis'));
      await ensureUser(body.creatorId || request.user!.id);
      const catId = body.categoryId || undefined;
      let channel: any;
      try {
        channel = await createGuildChannel(guildId, {
          name: `ticket-${body.subject.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 32)}`,
          type: 0,
          parent_id: catId,
          topic: `Ticket: ${body.subject}`,
        });
      } catch {
        return reply.status(500).send(error('Impossible de créer le channel ticket sur Discord'));
      }
      await sendChannelMessage(channel.id, {
        embeds: [{
          title: 'Nouveau ticket',
          description: `**Sujet :** ${body.subject}${body.description ? `\n**Description :** ${body.description}` : ''}\n**Créé par :** <@${body.creatorId || request.user!.id}>`,
          color: 0x00AAFF,
          timestamp: new Date().toISOString(),
        }],
      });
      const ticket = await prisma.ticket.create({
        data: {
          guildId, channelId: channel.id, creatorId: body.creatorId || request.user!.id,
          subject: body.subject, description: body.description || null,
          categoryId: body.categoryId || null, status: 'OPEN',
        },
      });
      reply.status(201).send(success(ticket, 'Ticket créé'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.put('/:guildId/tickets/:ticketId', { preHandler: [authenticate, validateParams(ticketIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, ticketId } = request.params as any;
      const body = request.body as any;
      const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, guildId } });
      if (!ticket) return reply.status(404).send(error('Ticket introuvable'));
      const upd: any = {};
      if (body.status) upd.status = body.status;
      if (body.claimedById !== undefined) upd.claimedById = body.claimedById;
      if (body.status === 'CLOSED') { upd.closedAt = new Date(); upd.closedById = request.user!.id; }
      const updated = await prisma.ticket.update({ where: { id: ticketId }, data: upd });
      if (body.status === 'CLOSED' && ticket.channelId && !ticket.channelId.startsWith('pending-')) {
        await sendChannelMessage(ticket.channelId, {
          embeds: [{ title: 'Ticket fermé', description: `Ce ticket a été fermé par <@${request.user!.id}>.`, color: 0xFF0000, timestamp: new Date().toISOString() }],
        }).catch(() => {});
      }
      if (body.claimedById && ticket.channelId && !ticket.channelId.startsWith('pending-')) {
        await editChannel(ticket.channelId, { name: `claimed-${ticket.subject.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 24)}` }).catch(() => {});
        await sendChannelMessage(ticket.channelId, {
          embeds: [{ title: 'Ticket réclamé', description: `Ce ticket a été réclamé par <@${body.claimedById}>.`, color: 0x00FF00, timestamp: new Date().toISOString() }],
        }).catch(() => {});
      }
      if (body.claimedById === null && ticket.channelId && !ticket.channelId.startsWith('pending-')) {
        await editChannel(ticket.channelId, { name: `ticket-${ticket.subject.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 24)}` }).catch(() => {});
        await sendChannelMessage(ticket.channelId, {
          embeds: [{ title: 'Ticket non réclamé', description: `Ce ticket n'est plus réclamé.`, color: 0xFFA500, timestamp: new Date().toISOString() }],
        }).catch(() => {});
      }
      reply.send(success(updated, 'Ticket mis à jour'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/logs', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      let ls = await prisma.logSettings.findUnique({ where: { guildId } });
      if (!ls) ls = await prisma.logSettings.create({ data: { guildId } });
      reply.send(success({
        logChannelId: ls.logChannelId,
        events: JSON.parse(ls.events),
        ignoredChannels: JSON.parse(ls.ignoredChannels),
        ignoredRoles: JSON.parse(ls.ignoredRoles),
      }));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.put('/:guildId/logs', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      await prisma.logSettings.upsert({
        where: { guildId },
        update: {
          logChannelId: body.logChannelId ?? undefined,
          events: body.events ? JSON.stringify(body.events) : undefined,
          ignoredChannels: body.ignoredChannels ? JSON.stringify(body.ignoredChannels) : undefined,
          ignoredRoles: body.ignoredRoles ? JSON.stringify(body.ignoredRoles) : undefined,
        },
        create: { guildId, logChannelId: body.logChannelId || null, events: body.events ? JSON.stringify(body.events) : '[]', ignoredChannels: '[]', ignoredRoles: '[]' },
      });
      reply.send(success(null, 'Logs mis à jour'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/levels', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      let xp = await prisma.xPSettings.findUnique({ where: { guildId } });
      if (!xp) {
        await prisma.guild.upsert({
          where: { id: guildId },
          update: {},
          create: { id: guildId, name: guildId, ownerId: 'unknown', memberCount: 0 },
        });
        xp = await prisma.xPSettings.create({ data: { guildId } });
      }
      const rewards = await prisma.xPRoleReward.findMany({ where: { guildId }, orderBy: { levelRequired: 'asc' } });
      reply.send(success({ settings: xp, roleRewards: rewards }));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.put('/:guildId/levels', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      await prisma.xPSettings.upsert({
        where: { guildId },
        update: {
          enabled: body.enabled ?? undefined,
          messageXp: body.messageXp ?? undefined,
          voiceXp: body.voiceXp ?? undefined,
          messageCooldown: body.messageCooldown ?? undefined,
          voiceCooldown: body.voiceCooldown ?? undefined,
          announcementChannelId: body.announcementChannelId ?? undefined,
          announcementMessage: body.announcementMessage ?? undefined,
          ignoredChannels: body.ignoredChannels ? JSON.stringify(body.ignoredChannels) : undefined,
          ignoredRoles: body.ignoredRoles ? JSON.stringify(body.ignoredRoles) : undefined,
        },
        create: { guildId, ...body },
      });
      if (body.roleRewards) {
        await prisma.xPRoleReward.deleteMany({ where: { guildId } });
        for (const r of body.roleRewards) {
          await prisma.xPRoleReward.create({ data: { guildId, roleId: r.roleId, levelRequired: r.level } });
        }
      }
      reply.send(success(null, 'Paramètres XP mis à jour'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/levels/leaderboard', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
      const [profiles, total] = await Promise.all([
        prisma.xPProfile.findMany({
          where: { guildId }, orderBy: { xp: 'desc' },
          skip: (page - 1) * limit, take: limit,
          include: { user: { select: { username: true, avatar: true } } },
        }),
        prisma.xPProfile.count({ where: { guildId } }),
      ]);
      const entries = profiles.map((p, i) => ({
        rank: (page - 1) * limit + i + 1, userId: p.userId,
        username: p.user.username, avatar: p.user.avatar,
        xp: p.xp, level: p.level, guildId,
      }));
      reply.send(success({
        entries,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/economy', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const wallets = await prisma.economyWallet.findMany({
        where: { guildId }, orderBy: { wallet: 'desc' }, take: 10,
        include: { user: { select: { username: true, avatar: true } } },
      });
      const totalEconomy = await prisma.economyWallet.aggregate({
        where: { guildId },
        _sum: { wallet: true, bank: true },
      });
      reply.send(success({
        wallets,
        totalWallet: totalEconomy._sum.wallet || 0,
        totalBank: totalEconomy._sum.bank || 0,
        currencyName: 'pièces',
        currencySymbol: '🪙',
      }));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.put('/:guildId/economy', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      reply.send(success(null, 'Non implémenté côté API'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/economy/leaderboard', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
      const [wallets, total] = await Promise.all([
        prisma.economyWallet.findMany({
          where: { guildId }, orderBy: { wallet: 'desc' },
          skip: (page - 1) * limit, take: limit,
          include: { user: { select: { username: true, avatar: true } } },
        }),
        prisma.economyWallet.count({ where: { guildId } }),
      ]);
      const entries = wallets.map((w, i) => ({
        rank: (page - 1) * limit + i + 1, userId: w.userId,
        username: w.user.username, avatar: w.user.avatar,
        wallet: w.wallet, bank: w.bank, totalEarned: w.totalEarned,
        guildId,
      }));
      reply.send(success({
        entries,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/giveaways', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
      const [giveaways, total] = await Promise.all([
        prisma.giveaway.findMany({
          where: { guildId }, orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
          include: { _count: { select: { entries: true } } },
        }),
        prisma.giveaway.count({ where: { guildId } }),
      ]);
      reply.send(success({
        giveaways,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.post('/:guildId/giveaways', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      if (!body.prize || !body.duration) return reply.status(400).send(error('Prize et durée requis'));
      const channelId = body.channelId;
      if (!channelId) return reply.status(400).send(error('channelId requis'));
      const endsAt = new Date(Date.now() + body.duration * 1000);
      let msg: any;
      try {
        msg = await sendChannelMessage(channelId, {
          embeds: [{
            title: '🎉 Giveaway',
            description: `**${body.prize}**\n\n**Gagnants :** ${body.winners || 1}\n**Se termine :** <t:${Math.floor(endsAt.getTime() / 1000)}:R>`,
            color: 0xFF00FF,
            timestamp: endsAt.toISOString(),
          }],
          components: [{
            type: 1,
            components: [{ type: 2, style: 3, custom_id: 'giveaway_join_api', label: '🎉 Participer' }],
          }],
        });
        await addMessageReaction(channelId, msg.id, '🎉').catch(() => {});
      } catch {
        return reply.status(500).send(error('Impossible de poster le giveaway sur Discord'));
      }
      const giveaway = await prisma.giveaway.create({
        data: {
          guildId, channelId,
          messageId: msg.id,
          prize: body.prize, winnerCount: body.winners || 1,
          duration: body.duration,
          endsAt,
          requiredRoleId: body.requirements?.requiredRoleId || null,
          requiredLevel: 0, requiredAccountAge: 0,
          status: 'RUNNING',
        },
      });
      reply.status(201).send(success(giveaway, 'Giveaway créé'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.put('/:guildId/giveaways/:id', { preHandler: [authenticate, validateParams(giveawayIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as any;
      const body = request.body as any;
      const g = await prisma.giveaway.findFirst({ where: { id, guildId } });
      if (!g) return reply.status(404).send(error('Giveaway introuvable'));

      if (body.status === 'ENDED' && g.messageId && !g.channelId.startsWith('pending')) {
        const entries = await prisma.giveawayEntry.findMany({ where: { giveawayId: g.id } });
        const userIds = entries.map(e => e.userId);
        const shuffled = userIds.sort(() => Math.random() - 0.5);
        const winners = shuffled.slice(0, g.winnerCount);
        const winnersStr = winners.length > 0 ? winners.map(w => `<@${w}>`).join(', ') : 'Aucun participant';
        await editMessage(g.channelId, g.messageId, {
          embeds: [{
            title: '🎉 Giveaway terminé',
            description: `**${g.prize}**\n\n**Gagnant(s) :** ${winnersStr}`,
            color: 0x00FF00,
          }],
          components: [],
        }).catch(() => {});
        await prisma.giveaway.update({ where: { id }, data: { status: 'ENDED', endsAt: new Date(), winners: JSON.stringify(winners) } });
        return reply.send(success({ winners }, 'Giveaway terminé'));
      }

      if (body.status === 'CANCELLED' && g.messageId && !g.channelId.startsWith('pending')) {
        await editMessage(g.channelId, g.messageId, {
          embeds: [{ title: '🎉 Giveaway annulé', description: `**${g.prize}**\nCe giveaway a été annulé.`, color: 0xFF0000 }],
          components: [],
        }).catch(() => {});
        await prisma.giveaway.update({ where: { id }, data: { status: 'CANCELLED' } });
        return reply.send(success(null, 'Giveaway annulé'));
      }

      const upd: any = {};
      if (body.prize) upd.prize = body.prize;
      if (body.winnerCount) upd.winnerCount = body.winnerCount;
      const updated = await prisma.giveaway.update({ where: { id }, data: upd });
      reply.send(success(updated, 'Giveaway mis à jour'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/polls', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
      const [polls, total] = await Promise.all([
        prisma.poll.findMany({
          where: { guildId }, orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
          include: { votes: { select: { userId: true, optionIndex: true } } },
        }),
        prisma.poll.count({ where: { guildId } }),
      ]);
      const data = polls.map((p) => {
        const rawOptions: string[] = JSON.parse(p.options);
        const votesRecord: Record<string, string> = {};
        const voteCounts: number[] = new Array(rawOptions.length).fill(0);
        for (const v of p.votes) {
          votesRecord[v.userId] = String(v.optionIndex);
          voteCounts[v.optionIndex]++;
        }
        return {
          id: p.id,
          guildId: p.guildId,
          channelId: p.channelId,
          question: p.question,
          options: rawOptions.map((label, i) => ({ id: String(i), label, votes: voteCounts[i] })),
          votes: votesRecord,
          status: p.status === 'OPEN' ? 'ACTIVE' : 'CLOSED' as const,
        };
      });
      reply.send(success({
        polls: data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.post('/:guildId/polls', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      if (!body.question || !body.options?.length)
        return reply.status(400).send(error('Question et options requises'));
      const channelId = body.channelId;
      if (!channelId) return reply.status(400).send(error('channelId requis'));
      const options = body.options.map((o: string) => ({ id: o, label: o }));
      const descLines = options.map((o: any, i: number) => `${NUMBER_EMOJIS[i] || `${i + 1}.`} ${o.label}`).join('\n');
      let msg: any;
      try {
        msg = await sendChannelMessage(channelId, {
          embeds: [{
            title: `📊 ${body.question}`,
            description: descLines,
            color: 0x00AAFF,
            footer: { text: 'Réagissez pour voter' },
            timestamp: new Date().toISOString(),
          }],
        });
        for (let i = 0; i < Math.min(options.length, 10); i++) {
          await addMessageReaction(channelId, msg.id, NUMBER_EMOJIS[i]).catch(() => {});
        }
      } catch {
        return reply.status(500).send(error('Impossible de poster le sondage sur Discord'));
      }
      const poll = await prisma.poll.create({
        data: {
          guildId, channelId,
          messageId: msg.id,
          question: body.question,
          options: JSON.stringify(body.options.map((o: string, i: number) => ({ id: String(i), label: o, votes: 0 }))),
          status: 'OPEN',
        },
      });
      reply.status(201).send(success(poll, 'Sondage créé'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.put('/:guildId/polls/:id', { preHandler: [authenticate, validateParams(pollIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as any;
      const body = request.body as any;
      const p = await prisma.poll.findFirst({ where: { id, guildId }, include: { votes: true } });
      if (!p) return reply.status(404).send(error('Sondage introuvable'));
      const upd: any = {};
      if (body.status) upd.status = body.status === 'CLOSED' ? 'CLOSED' : 'OPEN';
      const updated = await prisma.poll.update({ where: { id }, data: upd });
      if (body.status === 'CLOSED' && p.messageId && !p.channelId.startsWith('pending')) {
        const rawOptions = JSON.parse(p.options) as { id: string; label: string; votes: number }[];
        const voteCounts = new Array(rawOptions.length).fill(0);
        for (const v of (p.votes || [])) voteCounts[v.optionIndex]++;
        const descLines = rawOptions.map((o: any, i: number) =>
          `${NUMBER_EMOJIS[i] || `${i + 1}.`} ${o.label} — **${voteCounts[i]}** vote(s)`
        ).join('\n');
        await editMessage(p.channelId, p.messageId, {
          embeds: [{
            title: `📊 ${p.question} (Terminé)`,
            description: descLines,
            color: 0x808080,
            footer: { text: 'Sondage fermé' },
            timestamp: new Date().toISOString(),
          }],
        }).catch(() => {});
      }
      reply.send(success({ ...updated, options: JSON.parse(updated.options) }, 'Sondage mis à jour'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/suggestions', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
      const where: any = { guildId };
      if (q.status) where.status = q.status;
      const [suggestions, total] = await Promise.all([
        prisma.suggestion.findMany({
          where, orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
          include: { author: { select: { username: true, avatar: true } } },
        }),
        prisma.suggestion.count({ where }),
      ]);
      reply.send(success({
        suggestions,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.put('/:guildId/suggestions/:id', { preHandler: [authenticate, validateParams(suggestionIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as any;
      const body = request.body as any;
      const s = await prisma.suggestion.findFirst({ where: { id, guildId } });
      if (!s) return reply.status(404).send(error('Suggestion introuvable'));
      const upd: any = {};
      if (body.status) upd.status = body.status;
      if (body.staffResponse) { upd.staffResponse = body.staffResponse; upd.staffResponderId = request.user!.id; }
      const updated = await prisma.suggestion.update({ where: { id }, data: upd });
      if (body.status && s.messageId && !s.channelId.startsWith('pending')) {
        const statusEmoji = body.status === 'APPROVED' ? '✅' : body.status === 'REJECTED' ? '❌' : '⏳';
        const statusLabel = body.status === 'APPROVED' ? 'Approuvée' : body.status === 'REJECTED' ? 'Refusée' : 'En attente';
        await editMessage(s.channelId, s.messageId, {
          embeds: [{
            title: `💡 Suggestion ${statusLabel} ${statusEmoji}`,
            description: s.content,
            fields: [
              { name: 'Statut', value: statusLabel, inline: true },
              { name: 'Réponse du staff', value: body.staffResponse || 'Aucune réponse', inline: false },
            ],
            color: body.status === 'APPROVED' ? 0x00FF00 : body.status === 'REJECTED' ? 0xFF0000 : 0xFFA500,
            timestamp: new Date().toISOString(),
          }],
        }).catch(() => {});
      }
      reply.send(success(updated, 'Suggestion mise à jour'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/welcome', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      let welcome = await prisma.welcomeSettings.findUnique({ where: { guildId } });
      if (!welcome) welcome = await prisma.welcomeSettings.create({ data: { guildId } });
      reply.send(success({ settings: welcome }));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.put('/:guildId/welcome', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      await prisma.welcomeSettings.upsert({
        where: { guildId },
        update: {
          enabled: body.enabled ?? undefined,
          welcomeChannelId: body.welcomeChannelId ?? undefined,
          welcomeMessage: body.welcomeMessage ?? undefined,
          welcomeEmbed: body.welcomeEmbed ?? undefined,
          goodbyeEnabled: body.goodbyeEnabled ?? undefined,
          goodbyeChannelId: body.goodbyeChannelId ?? undefined,
          goodbyeMessage: body.goodbyeMessage ?? undefined,
          goodbyeEmbed: body.goodbyeEmbed ?? undefined,
          welcomeDM: body.welcomeDM ?? undefined,
          welcomeDMMessage: body.welcomeDMMessage ?? undefined,
        },
        create: { guildId, ...body },
      });
      reply.send(success(null, 'Paramètres de bienvenue mis à jour'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/autoroles', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      let ar = await prisma.autoroleSettings.findUnique({ where: { guildId }, include: { entries: true } });
      if (!ar) ar = await prisma.autoroleSettings.create({ data: { guildId }, include: { entries: true } });
      reply.send(success({ settings: ar }));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.put('/:guildId/autoroles', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      await prisma.autoroleSettings.upsert({
        where: { guildId },
        update: {
          enabled: body.enabled ?? undefined,
          onJoin: body.onJoin ?? undefined,
          onLevelUp: body.onLevelUp ?? undefined,
          onReaction: body.onReaction ?? undefined,
        },
        create: { guildId, ...body },
      });
      if (body.entries) {
        await prisma.autoroleEntry.deleteMany({ where: { guildId } });
        const settings = await prisma.autoroleSettings.findUnique({ where: { guildId } });
        if (settings) {
          for (const e of body.entries) {
            await prisma.autoroleEntry.create({
              data: {
                settingsId: settings.id, guildId,
                roleId: e.roleId, type: e.type || 'JOIN',
                levelRequired: e.levelRequired || null,
              },
            });
          }
        }
      }
      reply.send(success(null, 'Paramètres d\'autorôles mis à jour'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/embeds', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const embeds = await prisma.savedEmbed.findMany({ where: { guildId }, orderBy: { createdAt: 'desc' } });
      const data = embeds.map((e) => ({ ...e, fields: JSON.parse(e.fields) }));
      reply.send(success({ embeds: data }));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  // Envoi d'un embed depuis le dashboard (UI) vers un salon.
  // Endpoint attendu par le frontend: POST /api/guilds/:guildId/embeds/send
  app.post('/:guildId/embeds/send', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      const channelId = body.channelId as string | undefined;
      const embedPreset = body.embed as any;

      if (!channelId) return reply.status(400).send(error('channelId requis'));
      if (!embedPreset) return reply.status(400).send(error('embed requis'));

      // Normalisation des champs attendus par discord.js EmbedBuilder
      const fields = Array.isArray(embedPreset.fields) ? embedPreset.fields : [];

      await sendChannelMessage(channelId, {
        embeds: [{
          title: embedPreset.title ?? undefined,
          description: embedPreset.description ?? undefined,
          color: typeof embedPreset.color === 'string' ? parseInt(embedPreset.color.replace('#', ''), 16) : embedPreset.color,
          fields: fields.map((f: any) => ({
            name: String(f.name ?? ''),
            value: String(f.value ?? ''),
            inline: Boolean(f.inline),
          })),
          footer: embedPreset.footer ? { text: String(embedPreset.footer) } : undefined,
          thumbnail: embedPreset.thumbnail ? { url: String(embedPreset.thumbnail) } : undefined,
          image: embedPreset.image ? { url: String(embedPreset.image) } : undefined,
          timestamp: embedPreset.timestamp ? new Date().toISOString() : undefined,
        }],
      });

      reply.send(success(null, 'Embed envoyé'));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur lors de l\'envoi d\'embed'));
    }
  });

  app.post('/:guildId/embeds', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const body = request.body as any;
      if (!body.name) return reply.status(400).send(error('Nom requis'));
      const embed = await prisma.savedEmbed.create({
        data: {
          guildId, name: body.name,
          title: body.title || null, description: body.description || null,
          color: body.color || '#e0e0e0',
          fields: body.fields ? JSON.stringify(body.fields) : '[]',
          footer: body.footer || null, image: body.image || null,
          thumbnail: body.thumbnail || null, timestamp: body.timestamp ?? true,
        },
      });
      reply.status(201).send(success(embed, 'Embed créé'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.put('/:guildId/embeds/:id', { preHandler: [authenticate, validateParams(embedIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as any;
      const body = request.body as any;
      const embed = await prisma.savedEmbed.findFirst({ where: { id, guildId } });
      if (!embed) return reply.status(404).send(error('Embed introuvable'));
      const upd: any = {};
      if (body.name) upd.name = body.name;
      if (body.title !== undefined) upd.title = body.title;
      if (body.description !== undefined) upd.description = body.description;
      if (body.color) upd.color = body.color;
      if (body.fields) upd.fields = JSON.stringify(body.fields);
      if (body.footer !== undefined) upd.footer = body.footer;
      if (body.image !== undefined) upd.image = body.image;
      if (body.thumbnail !== undefined) upd.thumbnail = body.thumbnail;
      if (body.timestamp !== undefined) upd.timestamp = body.timestamp;
      const updated = await prisma.savedEmbed.update({ where: { id }, data: upd });
      reply.send(success(updated, 'Embed mis à jour'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.delete('/:guildId/embeds/:id', { preHandler: [authenticate, validateParams(embedIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, id } = request.params as any;
      const embed = await prisma.savedEmbed.findFirst({ where: { id, guildId } });
      if (!embed) return reply.status(404).send(error('Embed introuvable'));
      await prisma.savedEmbed.delete({ where: { id } });
      reply.send(success(null, 'Embed supprimé'));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });

  app.get('/:guildId/audit', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as any;
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where: { guildId }, orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit, take: limit,
          include: { user: { select: { username: true, avatar: true } } },
        }),
        prisma.auditLog.count({ where: { guildId } }),
      ]);
      reply.send(success({ entries: logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }));
    } catch (err: any) { reply.status(500).send(error(err.message || 'Erreur')); }
  });
}
