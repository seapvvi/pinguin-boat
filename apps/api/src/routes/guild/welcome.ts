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
  welcomeImageUrl: z.string().url().regex(/^https:\/\//).nullable().optional(),
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
          welcomeChannelId: body.welcomeChannelId ?? null,
          welcomeMessage: body.welcomeMessage ?? null,
          welcomeEmbed: body.welcomeEmbed,
          welcomeDM: body.welcomeDM ?? false,
          welcomeDMMessage: body.welcomeDMMessage ?? null,
          welcomeImageUrl: body.welcomeImageUrl ?? null,
          goodbyeEnabled: body.goodbyeEnabled ?? true,
          goodbyeChannelId: body.goodbyeChannelId ?? null,
          goodbyeMessage: body.goodbyeMessage ?? null,
          goodbyeEmbed: body.goodbyeEmbed,
          cardEnabled: body.cardEnabled ?? false,
          cardBackground: body.cardBackground ?? 'COLOR',
          cardBgColor: body.cardBgColor ?? '#23272a',
          cardBgImage: body.cardBgImage ?? null,
          cardTextColor: body.cardTextColor ?? '#ffffff',
          cardSubtextColor: body.cardSubtextColor ?? '#b9bbbe',
          cardAccentColor: body.cardAccentColor ?? '#5865f2',
          cardBlurBackground: body.cardBlurBackground ?? false,
          cardText: body.cardText ?? 'Bienvenue sur {server} !',
          cardSubtext: body.cardSubtext ?? 'Tu es le {memberCount}ème membre',
        },
        create: { guildId, ...body as any },
      });
      reply.send(success(null, 'Paramètres de bienvenue mis à jour'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });
}
