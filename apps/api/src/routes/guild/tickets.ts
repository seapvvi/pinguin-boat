import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@pinguin/db';
import { authenticate } from '../../middleware/auth';
import { validateParams } from '../../middleware/validate';
import { success, error, sanitizeError } from '../../utils/response';
import { guildIdSchema, ticketIdSchema, ensureUser } from '../../utils/guild-helpers';
import { DISCORD_PERMISSIONS } from '@pinguin/shared';
import { createGuildChannel, sendChannelMessage, editChannel, getChannelMessages, getBotUserId } from '../../services/discord';
import { closeTicketWithTranscript } from '../../services/ticket-close';
import { generateTicketTranscriptHtml } from '../../services/pastebin';

const guildParam = { preHandler: [authenticate, validateParams(guildIdSchema)] };

export async function ticketsRoutes(app: FastifyInstance) {
  app.get('/', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '20', 10) || 20));
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
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;
      if (!body.subject) return reply.status(400).send(error('Sujet requis'));
      const creatorId = (body.creatorId as string) || request.user!.discordId;
      await ensureUser(creatorId);

      const maxOpenPerUser = (await prisma.ticketSettings.findUnique({ where: { guildId } }))?.maxOpenPerUser ?? 1;

      const openTickets = await prisma.ticket.count({
        where: { guildId, creatorId, status: { in: ['OPEN', 'CLAIMED'] } },
      });
      if (openTickets >= maxOpenPerUser) {
        return reply.status(400).send(error('Vous avez déjà un ticket ouvert. Fermez-le avant d\'en créer un nouveau.'));
      }

      const totalOpenTickets = await prisma.ticket.count({
        where: { guildId, status: { in: ['OPEN', 'CLAIMED', 'PENDING'] } },
      });
      if (totalOpenTickets >= 200) {
        return reply.status(400).send(error('Le serveur a atteint la limite de tickets ouverts. Veuillez réessayer plus tard.'));
      }

      const catId = body.categoryId as string | undefined;
      const botUserId = await getBotUserId();
      const memberPerms = String(DISCORD_PERMISSIONS.VIEW_CHANNEL | DISCORD_PERMISSIONS.SEND_MESSAGES | DISCORD_PERMISSIONS.READ_MESSAGE_HISTORY);
      const botPerms = String(DISCORD_PERMISSIONS.VIEW_CHANNEL | DISCORD_PERMISSIONS.SEND_MESSAGES | DISCORD_PERMISSIONS.READ_MESSAGE_HISTORY | DISCORD_PERMISSIONS.MANAGE_CHANNELS);
      let channel: any;
      try {
        channel = await createGuildChannel(guildId, {
          name: `ticket-${(body.subject as string).toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 32)}`,
          type: 0,
          parent_id: catId,
          permission_overwrites: [
            { id: guildId, type: 0, deny: String(DISCORD_PERMISSIONS.VIEW_CHANNEL) },
            { id: creatorId, type: 1, allow: memberPerms },
            { id: botUserId, type: 1, allow: botPerms },
          ],
          topic: `Ticket: ${body.subject}`,
        });
      } catch {
        return reply.status(500).send(error('Impossible de créer le channel ticket sur Discord'));
      }
      await sendChannelMessage(channel.id, {
        content: `<@${creatorId}>`,
        embeds: [{
          title: '🎫 Ticket — Support',
          description: `**Sujet :** ${body.subject}${body.description ? `\n**Description :** ${body.description}` : ''}\nUn membre de l'équipe va vous répondre sous peu.`,
          color: 0x00AAFF,
          timestamp: new Date().toISOString(),
        }],
        components: [{
          type: 1,
          components: [
            { type: 2, style: 4, custom_id: 'ticket_close', label: 'Fermer', emoji: { name: '🔒' } },
            { type: 2, style: 3, custom_id: 'ticket_claim', label: 'Claim', emoji: { name: '🤚' } },
          ],
        }],
      });
      const ticket = await prisma.ticket.create({
        data: {
          guildId, channelId: channel.id, creatorId,
          subject: body.subject as string, description: (body.description as string) || null,
          categoryId: (body.categoryId as string) || null, status: 'OPEN',
        },
      });
      reply.status(201).send(success(ticket, 'Ticket créé'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/:ticketId', { preHandler: [authenticate, validateParams(ticketIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, ticketId } = request.params as { guildId: string; ticketId: string };
      const body = request.body as Record<string, unknown>;
      const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, guildId } });
      if (!ticket) return reply.status(404).send(error('Ticket introuvable'));
      const upd: any = {};
      const action = body.action || (body.status ? 'status' : null);
      if (action === 'close' || action === 'CLOSED') {
        upd.status = 'CLOSED'; upd.closedAt = new Date(); upd.closedById = request.user!.discordId;
      } else if (action === 'claim' || action === 'CLAIMED') {
        upd.status = 'CLAIMED'; upd.claimedById = (body.claimedById as string) || request.user!.discordId;
      } else if (action === 'unclaim') {
        upd.status = 'OPEN'; upd.claimedById = null;
      } else if (body.status) {
        upd.status = body.status;
      }
      if (body.claimedById !== undefined && !upd.claimedById) upd.claimedById = body.claimedById;
      const updated = await prisma.ticket.update({ where: { id: ticketId }, data: upd });
      if (upd.status === 'CLOSED') {
        const guild = await prisma.guild.findUnique({ where: { id: guildId }, select: { name: true } });
        await closeTicketWithTranscript(ticketId, request.user!.discordId, {
          guildName: guild?.name,
        }).catch(() => {});
      }
      if (upd.claimedById && ticket.channelId && !ticket.channelId.startsWith('pending-')) {
        await editChannel(ticket.channelId, { name: `claimed-${ticket.subject.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 24)}` }).catch(() => {});
        await sendChannelMessage(ticket.channelId, {
          embeds: [{ title: 'Ticket réclamé', description: `Ce ticket a été réclamé par <@${upd.claimedById}>.`, color: 0x00FF00, timestamp: new Date().toISOString() }],
        }).catch(() => {});
      }
      if (upd.claimedById === null && ticket.channelId && !ticket.channelId.startsWith('pending-')) {
        await editChannel(ticket.channelId, { name: `ticket-${ticket.subject.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 24)}` }).catch(() => {});
        await sendChannelMessage(ticket.channelId, {
          embeds: [{ title: 'Ticket non réclamé', description: `Ce ticket n'est plus réclamé.`, color: 0xFFA500, timestamp: new Date().toISOString() }],
        }).catch(() => {});
      }
      reply.send(success(updated, 'Ticket mis à jour'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/stats', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [totalOpen, totalClosed, closedTickets, recentClaims] = await Promise.all([
        prisma.ticket.count({ where: { guildId, status: { in: ['OPEN', 'CLAIMED', 'PENDING'] } } }),
        prisma.ticket.count({ where: { guildId, status: 'CLOSED' } }),
        prisma.ticket.findMany({
          where: { guildId, status: 'CLOSED', closedAt: { not: null } },
          select: { id: true, categoryId: true, createdAt: true, closedAt: true },
        }),
        prisma.ticketClaim.findMany({
          where: {
            ticket: { guildId, createdAt: { gte: thirtyDaysAgo } },
          },
          include: { ticket: { select: { id: true, categoryId: true, createdAt: true } } },
        }),
      ]);

      let avgResponseTimeMs = 0;
      if (recentClaims.length > 0) {
        const totalMs = recentClaims.reduce((sum, c) => sum + (c.claimedAt.getTime() - c.ticket.createdAt.getTime()), 0);
        avgResponseTimeMs = Math.round(totalMs / recentClaims.length);
      }

      let avgResolutionTimeMs = 0;
      if (closedTickets.length > 0) {
        const totalMs = closedTickets.reduce((sum, t) => sum + (t.closedAt!.getTime() - t.createdAt.getTime()), 0);
        avgResolutionTimeMs = Math.round(totalMs / closedTickets.length);
      }

      const catCount = new Map<string, { count: number; totalResolution: number; totalResponse: number; claimCount: number }>();
      for (const t of closedTickets) {
        const catId = t.categoryId ?? '__none__';
        if (!catCount.has(catId)) catCount.set(catId, { count: 0, totalResolution: 0, totalResponse: 0, claimCount: 0 });
        const entry = catCount.get(catId)!;
        entry.count++;
        entry.totalResolution += t.closedAt!.getTime() - t.createdAt.getTime();
      }
      for (const c of recentClaims) {
        const catId = c.ticket.categoryId ?? '__none__';
        if (!catCount.has(catId)) catCount.set(catId, { count: 0, totalResolution: 0, totalResponse: 0, claimCount: 0 });
        const entry = catCount.get(catId)!;
        entry.totalResponse += c.claimedAt.getTime() - c.ticket.createdAt.getTime();
        entry.claimCount++;
      }

      const categoryIds = [...catCount.keys()].filter((id) => id !== '__none__');
      const categories = await prisma.ticketCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      });
      const catNameMap = new Map(categories.map((c) => [c.id, c.name]));

      const byCategory = [...catCount.entries()]
        .filter(([id]) => id !== '__none__')
        .map(([catId, data]) => ({
          categoryId: catId,
          categoryName: catNameMap.get(catId) ?? 'Inconnue',
          count: data.count,
          avgResponseTimeMs: data.claimCount > 0 ? Math.round(data.totalResponse / data.claimCount) : 0,
          avgResolutionTimeMs: data.count > 0 ? Math.round(data.totalResolution / data.count) : 0,
        }));

      reply.send(success({
        totalOpen,
        totalClosed,
        avgResponseTimeMs,
        avgResolutionTimeMs,
        byCategory,
      }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/:ticketId/transcript', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, ticketId } = request.params as { guildId: string; ticketId: string };
      const body = request.body as { format?: string } | undefined;
      const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, guildId } });
      if (!ticket) return reply.status(404).send(error('Ticket introuvable'));
      if (!ticket.channelId || ticket.channelId.startsWith('pending-')) {
        return reply.status(400).send(error('Aucun salon Discord associé à ce ticket'));
      }
      const settings = await prisma.ticketSettings.findUnique({ where: { guildId } });
      const format = body?.format ?? settings?.transcriptFormat ?? 'HTML';

      const messages = await getChannelMessages(ticket.channelId, 200);
      const guild = await prisma.guild.findUnique({ where: { id: guildId }, select: { name: true } });

      if (format === 'TXT') {
        const lines: string[] = [];
        lines.push(`Ticket: ${ticket.subject}`);
        lines.push(`Serveur: ${guild?.name ?? '—'}`);
        lines.push(`Ouvert le: ${ticket.createdAt.toISOString()}`);
        lines.push(`Fermé le: ${ticket.closedAt?.toISOString() ?? '—'}`);
        lines.push(`Statut: ${ticket.status}`);
        lines.push('');
        lines.push('─'.repeat(60));
        lines.push('');
        const ordered = [...messages].reverse();
        for (const m of ordered) {
          const time = m.timestamp ? new Date(m.timestamp).toISOString() : '—';
          const author = m.author?.username ?? 'Inconnu';
          const content = m.content ?? '';
          lines.push(`[${time}] ${author}: ${content}`);
          if (m.attachments?.length > 0) {
            for (const a of m.attachments) {
              lines.push(`  📎 ${a.name ?? 'fichier'}: ${a.url}`);
            }
          }
        }
        const txtContent = lines.join('\n');

        await prisma.transcriptMeta.upsert({
          where: { ticketId },
          update: { content: txtContent },
          create: { ticketId, channelId: ticket.channelId, guildId, content: txtContent },
        });

        reply.send(success({
          content: txtContent,
          format: 'TXT',
          filename: `transcript-${ticket.subject.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 60)}.txt`,
        }));
      } else {
        const html = generateTicketTranscriptHtml(messages, ticket.subject, {
          guildName: guild?.name,
          openedAt: ticket.createdAt?.toLocaleString('fr-FR') ?? '—',
          closedAt: ticket.closedAt?.toLocaleString('fr-FR') ?? '—',
          closedBy: ticket.closedById ?? '—',
        });

        await prisma.transcriptMeta.upsert({
          where: { ticketId },
          update: { content: html },
          create: { ticketId, channelId: ticket.channelId, guildId, content: html },
        });

        reply.send(success({
          content: html,
          format: 'HTML',
          filename: `transcript-${ticket.subject.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 60)}.html`,
          ticketId,
        }));
      }
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/categories', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const categories = await prisma.ticketCategory.findMany({
        where: { guildId },
        orderBy: { position: 'asc' },
      });
      const parsed = categories.map((c) => ({
        ...c,
        staffRoleIds: JSON.parse(c.staffRoleIds || '[]'),
      }));
      reply.send(success({ categories: parsed }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/categories', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;
      if (!body.name) return reply.status(400).send(error('Nom requis'));
      const maxPos = await prisma.ticketCategory.aggregate({
        where: { guildId },
        _max: { position: true },
      });
      const category = await prisma.ticketCategory.create({
        data: {
          guildId,
          name: body.name as string,
          description: (body.description as string) ?? null,
          staffRoleIds: Array.isArray(body.staffRoleIds) ? JSON.stringify(body.staffRoleIds) : '[]',
          maxTicketsPerUser: (body.maxTicketsPerUser as number) ?? 5,
          openingMode: (body.openingMode as string) ?? 'BUTTON',
          formId: (body.formId as string) ?? null,
          welcomeMessage: (body.welcomeMessage as string) ?? null,
          color: (body.color as string) ?? '#5865F2',
          emoji: (body.emoji as string) ?? null,
          position: (maxPos._max.position ?? -1) + 1,
        },
      });
      reply.status(201).send(success({ category }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/categories/:categoryId', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, categoryId } = request.params as { guildId: string; categoryId: string };
      const body = request.body as Record<string, unknown>;
      const existing = await prisma.ticketCategory.findFirst({ where: { id: categoryId, guildId } });
      if (!existing) return reply.status(404).send(error('Catégorie introuvable'));
      const data: Record<string, unknown> = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.description !== undefined) data.description = body.description;
      if (body.staffRoleIds !== undefined) data.staffRoleIds = JSON.stringify(body.staffRoleIds);
      if (body.maxTicketsPerUser !== undefined) data.maxTicketsPerUser = body.maxTicketsPerUser;
      if (body.openingMode !== undefined) data.openingMode = body.openingMode;
      if (body.formId !== undefined) data.formId = body.formId;
      if (body.welcomeMessage !== undefined) data.welcomeMessage = body.welcomeMessage;
      if (body.color !== undefined) data.color = body.color;
      if (body.emoji !== undefined) data.emoji = body.emoji;
      if (body.position !== undefined) data.position = body.position;
      const category = await prisma.ticketCategory.update({ where: { id: categoryId }, data });
      reply.send(success({ category: { ...category, staffRoleIds: JSON.parse(category.staffRoleIds || '[]') } }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.delete('/categories/:categoryId', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId, categoryId } = request.params as { guildId: string; categoryId: string };
      const existing = await prisma.ticketCategory.findFirst({ where: { id: categoryId, guildId } });
      if (!existing) return reply.status(404).send(error('Catégorie introuvable'));
      await prisma.ticketCategory.delete({ where: { id: categoryId } });
      reply.send(success(null, 'Catégorie supprimée'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.patch('/categories/reorder', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as { orderedIds: string[] };
      if (!Array.isArray(body.orderedIds)) return reply.status(400).send(error('orderedIds requis'));
      await prisma.$transaction(
        body.orderedIds.map((id, index) =>
          prisma.ticketCategory.updateMany({
            where: { id, guildId },
            data: { position: index },
          })
        )
      );
      reply.send(success(null, 'Ordre mis à jour'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/settings', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      let ts = await prisma.ticketSettings.findUnique({ where: { guildId } });
      if (!ts) ts = await prisma.ticketSettings.create({ data: { guildId } });
      reply.send(success({
        ...ts,
        moderatorRoles: JSON.parse(ts.moderatorRoles || '[]'),
        accessRoles: JSON.parse(ts.accessRoles || '[]'),
      }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.patch('/settings', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;
      const data: Record<string, unknown> = { ...body };
      if (Array.isArray(body.moderatorRoles)) data.moderatorRoles = JSON.stringify(body.moderatorRoles);
      if (Array.isArray(body.accessRoles)) data.accessRoles = JSON.stringify(body.accessRoles);
      const ts = await prisma.ticketSettings.upsert({
        where: { guildId },
        update: data,
        create: { guildId, ...data },
      });
      reply.send(success(ts, 'Paramètres tickets mis à jour'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });
}
