import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@pinguin/db';
import { authenticate } from '../../middleware/auth';
import { validateParams } from '../../middleware/validate';
import { success, error, sanitizeError } from '../../utils/response';
import { guildIdSchema } from '../../utils/guild-helpers';

const guildParam = { preHandler: [authenticate, validateParams(guildIdSchema)] };

export async function economyRoutes(app: FastifyInstance) {
  app.get('/', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      let settings = await prisma.economySettings.findUnique({ where: { guildId } });
      if (!settings) settings = await prisma.economySettings.create({ data: { guildId } });
      reply.send(success({ settings }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.put('/', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const ec = request.body as Record<string, unknown>;
      await prisma.economySettings.upsert({
        where: { guildId },
        update: {
          enabled: ec.enabled as boolean, currencyName: ec.currencyName as string, currencySymbol: ec.currencySymbol as string,
          dailyAmount: ec.dailyAmount as number, weeklyAmount: ec.weeklyAmount as number, startupBalance: ec.startupBalance as number,
          workMin: ec.workMin as number, workMax: ec.workMax as number, workCooldown: ec.workCooldown as number,
          robberyEnabled: ec.robberyEnabled as boolean, robberyMaxAmount: ec.robberyMaxAmount as number,
          robberyCooldown: ec.robberyCooldown as number, interestRate: ec.interestRate as number,
          interestInterval: ec.interestInterval as number, bankCapacity: ec.bankCapacity as number,
        },
        create: { guildId, ...ec },
      });
      reply.send(success(null, 'Économie sauvegardée'));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });

  app.get('/leaderboard', guildParam, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { guildId } = request.params as { guildId: string };
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '20', 10) || 20));
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
        username: w.user?.username ?? w.userId, avatar: w.user?.avatar ?? null,
        wallet: w.wallet, bank: w.bank, totalEarned: w.totalEarned,
        guildId,
      }));
      reply.send(success({
        entries,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      }));
    } catch (err: unknown) { reply.status(500).send(error(sanitizeError(err))); }
  });
}
