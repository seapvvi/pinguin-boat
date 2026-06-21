import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@pinguin/db';
import { authenticate } from '../../middleware/auth';
import { requireGuildAdmin } from '../../middleware/guild-auth';
import { validateParams, validateBody } from '../../middleware/validate';
import { success, error, sanitizeError } from '../../utils/response';
import { guildIdSchema } from '../../utils/guild-helpers';

const httpsUrlSchema = z.string().url().regex(/^https:\/\//).optional().nullable();

const welcomeBodySchema = z.object({
  enabled: z.boolean().optional(),
  welcomeChannelId: z.string().nullable().optional(),
  welcomeMessage: z.string().max(2000).nullable().optional(),
  welcomeEmbed: z.boolean().optional(),
  welcomeDM: z.boolean().optional(),
  welcomeDMMessage: z.string().max(2000).nullable().optional(),
  goodbyeEnabled: z.boolean().optional(),
  goodbyeChannelId: z.string().nullable().optional(),
  goodbyeMessage: z.string().max(2000).nullable().optional(),
  goodbyeEmbed: z.boolean().optional(),
  cardEnabled: z.boolean().optional(),
  cardBackground: z.enum(['COLOR', 'GRADIENT', 'IMAGE']).optional(),
  cardBgColor: z.string().optional(),
  cardBgImage: httpsUrlSchema,
  cardTextColor: z.string().optional(),
  cardSubtextColor: z.string().optional(),
  cardAccentColor: z.string().optional(),
  cardBlurBackground: z.boolean().optional(),
  cardText: z.string().max(500).optional(),
  cardSubtext: z.string().max(500).optional(),
});

const welcomeParam = { preHandler: [authenticate, requireGuildAdmin, validateParams(guildIdSchema), validateBody(welcomeBodySchema)] };

export async function welcomeRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [authenticate, validateParams(guildIdSchema)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      let welcome = await prisma.welcomeSettings.findUnique({ where: { guildId } });
      if (!welcome) welcome = await prisma.welcomeSettings.create({ data: { guildId } });
      reply.send(success({ settings: welcome }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/', welcomeParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as z.infer<typeof welcomeBodySchema>;

      await prisma.welcomeSettings.upsert({
        where: { guildId },
        update: {
          enabled: body.enabled,
          welcomeChannelId: body.welcomeChannelId !== undefined ? (body.welcomeChannelId || null) : undefined,
          welcomeMessage: body.welcomeMessage !== undefined ? (body.welcomeMessage || null) : undefined,
          welcomeEmbed: body.welcomeEmbed,
          welcomeDM: body.welcomeDM !== undefined ? body.welcomeDM : undefined,
          welcomeDMMessage: body.welcomeDMMessage !== undefined ? (body.welcomeDMMessage || null) : undefined,
          goodbyeEnabled: body.goodbyeEnabled !== undefined ? body.goodbyeEnabled : undefined,
          goodbyeChannelId: body.goodbyeChannelId !== undefined ? (body.goodbyeChannelId || null) : undefined,
          goodbyeMessage: body.goodbyeMessage !== undefined ? (body.goodbyeMessage || null) : undefined,
          goodbyeEmbed: body.goodbyeEmbed,
          cardEnabled: body.cardEnabled !== undefined ? body.cardEnabled : undefined,
          cardBackground: body.cardBackground !== undefined ? body.cardBackground : undefined,
          cardBgColor: body.cardBgColor !== undefined ? body.cardBgColor : undefined,
          cardBgImage: body.cardBgImage !== undefined ? (body.cardBgImage || null) : undefined,
          cardTextColor: body.cardTextColor !== undefined ? body.cardTextColor : undefined,
          cardSubtextColor: body.cardSubtextColor !== undefined ? body.cardSubtextColor : undefined,
          cardAccentColor: body.cardAccentColor !== undefined ? body.cardAccentColor : undefined,
          cardBlurBackground: body.cardBlurBackground !== undefined ? body.cardBlurBackground : undefined,
          cardText: body.cardText !== undefined ? (body.cardText || 'Bienvenue sur {server} !') : undefined,
          cardSubtext: body.cardSubtext !== undefined ? (body.cardSubtext || 'Tu es le {memberCount}ème membre') : undefined,
        },
        create: { guildId, ...body as any },
      });
      reply.send(success(null, 'Paramètres de bienvenue mis à jour'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });
}
