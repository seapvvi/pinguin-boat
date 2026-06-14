import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@pinguin/db';
import { authenticate } from '../../middleware/auth';
import { validateParams } from '../../middleware/validate';
import { success, error, sanitizeError } from '../../utils/response';
import { guildIdSchema } from '../../utils/guild-helpers';

const guildParam = { preHandler: [authenticate, validateParams(guildIdSchema)] };

export async function protectionRoutes(app: FastifyInstance) {
  app.get('/', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      let ps = await prisma.protectionSettings.findUnique({ where: { guildId } });
      if (!ps) ps = await prisma.protectionSettings.create({ data: { guildId } });
      reply.send(success({ settings: ps }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = request.body as Record<string, unknown>;
      await prisma.protectionSettings.upsert({
        where: { guildId },
        update: {
          enabled: body.enabled as boolean | undefined,
          antiRaid: body.antiRaid as boolean | undefined,
          raidThreshold: body.raidThreshold as number | undefined,
          raidInterval: body.raidInterval as number | undefined,
          antiSpam: body.antiSpam as boolean | undefined,
          spamThreshold: body.spamThreshold as number | undefined,
          spamInterval: body.spamInterval as number | undefined,
          antiMassMention: body.antiMassMention as boolean | undefined,
          mentionThreshold: body.mentionThreshold as number | undefined,
          antiLink: body.antiLink as boolean | undefined,
          antiAlts: body.antiAlts as boolean | undefined,
          altAccountAge: body.altAccountAge as number | undefined,
          verificationLevel: body.verificationLevel as string | undefined,
          captchaVerification: body.captchaVerification as boolean | undefined,
          verifiedRoleId: body.verifiedRoleId as string | undefined,
          punishment: body.punishment as string | undefined,
        },
        create: { guildId, ...body },
      });
      reply.send(success(null, 'Protection mise à jour'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.post('/emergency', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const body = (request.body as { enable?: boolean }) ?? {};
      const enable = body.enable !== false;
      await prisma.protectionSettings.upsert({
        where: { guildId },
        update: { emergencyMode: enable, enabled: enable ? true : undefined },
        create: { guildId, emergencyMode: enable, enabled: true },
      });
      const { botEmergencyMode } = await import('../../services/bot-proxy');
      await botEmergencyMode(guildId, enable).catch(() => {});
      reply.send(success({ emergencyMode: enable }, enable ? 'Mode urgence activé' : 'Mode urgence désactivé'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });
}
