import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@pinguin/db';
import { authenticate } from '../../middleware/auth';
import { validateParams } from '../../middleware/validate';
import { success, error, sanitizeError } from '../../utils/response';
import { guildIdSchema } from '../../utils/guild-helpers';

const guildParam = { preHandler: [authenticate, validateParams(guildIdSchema)] };

export async function welcomeRoutes(app: FastifyInstance) {
  app.get('/', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      let welcome = await prisma.welcomeSettings.findUnique({ where: { guildId } });
      if (!welcome) welcome = await prisma.welcomeSettings.create({ data: { guildId } });
      reply.send(success({ settings: welcome }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;
      const welcomeDM = (body.welcomeDM as boolean) ?? (body.dmWelcome as boolean) ?? false;
      const welcomeDMMessage = (body.welcomeDMMessage as string) ?? (body.dmWelcomeMessage as string) ?? null;
      const data = {
        enabled: (body.enabled as boolean) ?? true,
        welcomeChannelId: (body.welcomeChannelId as string) ?? null,
        welcomeMessage: (body.welcomeMessage as string) ?? null,
        welcomeEmbed: (body.welcomeEmbed as boolean) ?? false,
        welcomeDM,
        welcomeDMMessage,
        goodbyeEnabled: (body.goodbyeEnabled as boolean) ?? true,
        goodbyeChannelId: (body.goodbyeChannelId as string) ?? null,
        goodbyeMessage: (body.goodbyeMessage as string) ?? null,
        goodbyeEmbed: (body.goodbyeEmbed as boolean) ?? false,
        cardEnabled: (body.cardEnabled as boolean) ?? false,
        cardBackground: (body.cardBackground as string) ?? 'COLOR',
        cardBgColor: (body.cardBgColor as string) ?? '#23272a',
        cardBgImage: (body.cardBgImage as string) ?? null,
        cardTextColor: (body.cardTextColor as string) ?? '#ffffff',
        cardSubtextColor: (body.cardSubtextColor as string) ?? '#b9bbbe',
        cardAccentColor: (body.cardAccentColor as string) ?? '#5865f2',
        cardBlurBackground: (body.cardBlurBackground as boolean) ?? false,
        cardText: (body.cardText as string) ?? 'Bienvenue sur {server} !',
        cardSubtext: (body.cardSubtext as string) ?? 'Tu es le {memberCount}ème membre',
      };
      await prisma.welcomeSettings.upsert({
        where: { guildId },
        update: data,
        create: { guildId, ...data },
      });
      reply.send(success(null, 'Paramètres de bienvenue mis à jour'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });
}
