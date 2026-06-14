import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { success, error, sanitizeError } from '../utils/response';
import { closeTicketWithTranscript } from '../services/ticket-close';

const INTERNAL_SECRET = process.env.BOT_INTERNAL_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('BOT_INTERNAL_SECRET must be set in production'); })() : 'dev-secret');

function requireInternalSecret(
  request: FastifyRequest,
  reply: FastifyReply
): void {
  if (request.headers['x-internal-secret'] !== INTERNAL_SECRET) {
    reply.status(403).send(error('Forbidden'));
    return;
  }
}

export async function internalRoutes(app: FastifyInstance) {
  app.post('/tickets/:ticketId/close', async (request: FastifyRequest, reply: FastifyReply) => {
    requireInternalSecret(request, reply);
    if (reply.sent) return;

    try {
      const { ticketId } = request.params as { ticketId: string };
      const body = (request.body as { closedById?: string; guildName?: string }) ?? {};
      const closedById = body.closedById ?? '0';
      const result = await closeTicketWithTranscript(ticketId, closedById, {
        guildName: body.guildName,
      });
      reply.send(success(result, 'Ticket fermé'));
    } catch (err: unknown) {
      reply.status(500).send(error(sanitizeError(err)));
    }
  });
}
