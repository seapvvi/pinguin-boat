import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import { requireOwner } from '../middleware/owner';
import { prisma } from '@pinguin/db';
import { success, error, paginated } from '../utils/response';
import * as DeployService from '../services/deploy';

const ownerPre = { preHandler: [authenticate, requireOwner] };

export async function deployRoutes(app: FastifyInstance) {
  app.post('/start', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await DeployService.startDeployment(request.user!.id);
      reply.send(success(result, 'Déploiement démarré en arrière-plan'));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur de déploiement'));
    }
  });

  app.post('/rollback', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      await DeployService.rollback(request.user!.id, body?.version);
      reply.send(success(null, 'Rollback effectué'));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur de rollback'));
    }
  });

  app.get('/status/:id', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as any;
      const deployment = await prisma.deployment.findUnique({ where: { id } });
      if (!deployment) return reply.status(404).send(error('Déploiement introuvable'));
      reply.send(success({
        id: deployment.id,
        version: deployment.version,
        status: deployment.status,
        log: deployment.log?.split('\n').filter(Boolean) || [],
        startedAt: deployment.startedAt,
        completedAt: deployment.completedAt,
      }));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur de statut'));
    }
  });

  app.get('/status', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = await DeployService.getDeployStatus();
      reply.send(success(status));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur de statut'));
    }
  });

  app.get('/history', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = request.query as any;
      const page = Math.max(1, parseInt(q.page) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(q.limit) || 10));
      const { deployments, total } = await DeployService.getDeployHistory(page, limit);
      reply.send(paginated(deployments, total, page, limit));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur d\'historique'));
    }
  });
}
