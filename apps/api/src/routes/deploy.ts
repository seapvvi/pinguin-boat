import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth';
import { requireOwner } from '../middleware/owner';
import { success, error, paginated } from '../utils/response';
import * as DeployService from '../services/deploy';

const ownerPre = { preHandler: [authenticate, requireOwner] };

export async function deployRoutes(app: FastifyInstance) {
  app.post('/start', ownerPre, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await DeployService.startDeployment(request.user!.id);
      reply.send(success(result, 'Déploiement démarré'));
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

  app.get('/releases', ownerPre, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const releases = await DeployService.getReleases();
      reply.send(success({ releases }));
    } catch (err: any) {
      reply.status(500).send(error(err.message || 'Erreur de récupération des releases'));
    }
  });
}
