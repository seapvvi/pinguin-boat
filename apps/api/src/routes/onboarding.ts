import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@pinguin/db';
import { authenticate } from '../middleware/auth';
import { requireGuildAdmin } from '../middleware/guild-auth';
import { requireOwner } from '../middleware/owner';
import { validateParams } from '../middleware/validate';
import { success, error, sanitizeError } from '../utils/response';
import { getGuildChannels, getGuildRoles } from '../services/discord';
import { z } from 'zod';

const guildIdSchema = z.object({ guildId: z.string().min(1) });

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function onboardingRoutes(app: FastifyInstance) {
  app.get('/guilds/:guildId/onboarding-data', { preHandler: [authenticate, requireGuildAdmin, validateParams(guildIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };

      const [guildSettings, logSettings, welcomeSettings, economySettings, ticketSettings, channels, roles] = await Promise.all([
        prisma.guildSettings.findUnique({ where: { guildId } }),
        prisma.logSettings.findUnique({ where: { guildId } }),
        prisma.welcomeSettings.findUnique({ where: { guildId } }),
        prisma.economySettings.findUnique({ where: { guildId } }),
        prisma.ticketSettings.findUnique({ where: { guildId } }),
        getGuildChannels(guildId).catch(() => []),
        getGuildRoles(guildId).catch(() => []),
      ]);

      const textChannels = (channels || [])
        .filter((c: { type: number; id: string; name: string }) => c.type === 0)
        .map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }));

      const allRoles = (roles || [])
        .filter((r: { name: string; id: string }) => r.name !== '@everyone')
        .map((r: { id: string; name: string }) => ({ id: r.id, name: r.name }));

      reply.send(success({
        guildSettings: guildSettings ? {
          onboardingDone: guildSettings.onboardingDone,
          modRoleIds: JSON.parse(guildSettings.modRoleIds || '[]'),
        } : { onboardingDone: false, modRoleIds: [] },
        logSettings: logSettings ? {
          logChannelId: logSettings.logChannelId,
        } : { logChannelId: null },
        welcomeSettings: welcomeSettings ? {
          enabled: welcomeSettings.enabled,
          welcomeChannelId: welcomeSettings.welcomeChannelId,
          welcomeMessage: welcomeSettings.welcomeMessage,
        } : { enabled: true, welcomeChannelId: null, welcomeMessage: null },
        economySettings: economySettings ? {
          enabled: economySettings.enabled,
          currencyName: economySettings.currencyName,
          currencySymbol: economySettings.currencySymbol,
        } : { enabled: false, currencyName: 'pièces', currencySymbol: '🪙' },
        ticketSettings: ticketSettings ? {
          enabled: ticketSettings.enabled,
          logChannelId: ticketSettings.logChannelId,
          panelMessage: ticketSettings.panelMessage,
        } : { enabled: false, logChannelId: null, panelMessage: 'Cliquez sur le bouton ci-dessous pour ouvrir un ticket de support.\nNotre équipe vous répondra dès que possible.' },
        channels: textChannels,
        roles: allRoles,
      }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.patch('/guilds/:guildId/settings/onboarding-done', { preHandler: [authenticate, requireGuildAdmin, validateParams(guildIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      await prisma.guildSettings.upsert({
        where: { guildId },
        update: { onboardingDone: true },
        create: { guildId, onboardingDone: true },
      });
      reply.send(success(null, 'Onboarding marqué comme terminé'));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.post('/onboarding/source', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { guildId: string; source: string; details?: string };
      if (!body.guildId || !body.source) {
        return reply.status(400).send(error('guildId et source requis'));
      }
      const validSources = ['top.gg', 'word_of_mouth', 'social_media', 'other'];
      if (!validSources.includes(body.source)) {
        return reply.status(400).send(error('Source invalide'));
      }
      const source = await prisma.onboardingSource.create({
        data: {
          guildId: body.guildId,
          source: body.source,
          details: body.details || null,
        },
      });
      reply.send(success(source, 'Source enregistrée'));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/admin/onboarding/sources', { preHandler: [authenticate, requireOwner] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = paginationSchema.parse(request.query);

      const [sources, total] = await Promise.all([
        prisma.onboardingSource.findMany({
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        prisma.onboardingSource.count(),
      ]);

      const sourceBreakdown = await prisma.onboardingSource.groupBy({
        by: ['source'],
        _count: { _all: true },
      });

      const otherDetails = await prisma.onboardingSource.findMany({
        where: { source: 'other', details: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { guildId: true, details: true, createdAt: true },
      });

      reply.send(success({
        sources,
        breakdown: sourceBreakdown.map((s) => ({
          source: s.source,
          count: s._count._all,
        })),
        otherDetails,
        pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
      }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });
}
