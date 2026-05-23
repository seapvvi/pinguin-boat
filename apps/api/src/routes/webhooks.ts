import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@pinguin/db';
import { getConfig } from '@pinguin/config';
import { success, error } from '../utils/response';
import * as DeployService from '../services/deploy';

const config = getConfig();

export async function webhookRoutes(app: FastifyInstance) {
  app.post('/github', async (request: FastifyRequest, reply: FastifyReply) => {
    const signature = request.headers['x-hub-signature-256'] as string;
    const event = request.headers['x-github-event'] as string;
    const body = request.body as any;

    if (!event) {
      return reply.status(400).send(error('En-tête x-github-event manquant'));
    }

    if (event === 'ping') {
      return reply.send(success({ message: 'pong' }));
    }

    if (event === 'push' && body?.ref === `refs/heads/${config.GITHUB_BRANCH}`) {
      try {
        const ownerId = config.DISCORD_OWNER_ID;
        const owner = await prisma.user.findUnique({ where: { discordId: ownerId } });

        const result = await DeployService.startDeployment(
          owner?.id || 'webhook'
        );

        reply.send(success(result, 'Déploiement automatique démarré'));
      } catch (err: any) {
        reply.status(500).send(error(err.message || 'Échec du déploiement automatique'));
      }
    } else {
      reply.send(success({ ignored: true, event }));
    }
  });
}
