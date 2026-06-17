import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireOwner } from '../middleware/owner';
import { prisma, DeployEnvironment } from '@pinguin/db';
import { success, error, sanitizeError } from '../utils/response';
import * as DeployService from '../services/deploy';

const ownerPre = { preHandler: [authenticate, requireOwner] };

const startSchema = z.object({
  environment: z.enum(['development', 'staging', 'production']).optional(),
});

const rollbackSchema = z.object({ version: z.string().min(1).optional() });

const paramsSchema = z.object({ id: z.string().uuid() });

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export async function deployRoutes(app: FastifyInstance) {
  app.post('/start', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = startSchema.safeParse(request.body);
      const envRaw = parsed.success ? parsed.data.environment : undefined;

      // Guard: l'environnement est dérivé de la config si non spécifié
      const { getConfig } = await import('@pinguin/config');
      const config = getConfig();
      const env = envRaw || config.DEPLOY_ENV;

      const envMap: Record<string, DeployEnvironment> = {
        development: DeployEnvironment.DEVELOPMENT,
        staging: DeployEnvironment.STAGING,
        production: DeployEnvironment.PRODUCTION,
      };
      const deployEnv = envMap[env] || DeployEnvironment.DEVELOPMENT;

      const result = await DeployService.startDeployment(request.user!.id, deployEnv);
      reply.send(success(result, 'Déploiement démarré en arrière-plan'));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.post('/rollback', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = rollbackSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send(error('Paramètres invalides'));
    }
    try {
      await DeployService.rollback(request.user!.id, parsed.data.version);
      reply.send(success(null, 'Rollback effectué'));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/status/:id', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = paramsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send(error('ID de déploiement invalide'));
      }
      const { id } = parsed.data;
      const deployment = await prisma.deployment.findUnique({ where: { id } });
      if (!deployment) return reply.status(404).send(error('Déploiement introuvable'));
      reply.send(success({
        id: deployment.id,
        version: deployment.version,
        environment: deployment.environment,
        gitRef: deployment.gitRef,
        status: deployment.status,
        log: deployment.log?.split('\n').filter(Boolean) || [],
        startedAt: deployment.startedAt,
        completedAt: deployment.completedAt,
      }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/status', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = await DeployService.getDeployStatus();
      reply.send(success(status));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });

  app.get('/history', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = paginationSchema.parse(request.query);
      const { deployments, total } = await DeployService.getDeployHistory(query.page, query.limit);
      reply.send(success({ deployments, pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } }));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });
}
