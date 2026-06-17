import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@pinguin/db';
import { getConfig } from '@pinguin/config';

const config = getConfig();

async function logOwnerAction(
  request: FastifyRequest,
  action: string,
  success: boolean,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.ownerLog.create({
      data: {
        userId: request.user!.id,
        action,
        details: details ? JSON.stringify(details) : null,
        ip: request.ip,
        userAgent: request.headers['user-agent'] || '',
        success,
      },
    });
  } catch { }
}

export async function requireOwnerDiscordId(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user) {
    reply.status(401).send({
      success: false,
      error: 'Authentification requise',
    });
    return;
  }

  if (request.user.discordId !== config.DISCORD_OWNER_ID) {
    await logOwnerAction(request, 'UNAUTHORIZED_ACCESS', false, {
      path: request.url,
      method: request.method,
    });
    reply.status(403).send({
      success: false,
      error: 'Accès réservé au propriétaire',
    });
    return;
  }
}

export async function requireOwner(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await requireOwnerDiscordId(request, reply);
  if (reply.sent) return;

  const session = await prisma.session.findUnique({
    where: { id: request.user!.sessionId },
  });

  if (!session) {
    reply.status(401).send({
      success: false,
      error: 'Session introuvable',
    });
    return;
  }

  if (!session.ownerVerifiedAt) {
    reply.status(401).send({
      success: false,
      error: 'Veuillez d\'abord vérifier le mot de passe propriétaire',
      data: { requiresPassword: true },
    });
    return;
  }

  const twoFA = await prisma.owner2FA.findUnique({
    where: { userId: request.user!.id },
  });

  if (twoFA?.enabled && !session.owner2faVerifiedAt) {
    reply.status(401).send({
      success: false,
      error: 'Authentification à deux facteurs requise',
      data: { requires2FA: true },
    });
    return;
  }

  await logOwnerAction(request, 'ACCESS_GRANTED', true, {
    path: request.url,
    method: request.method,
  });
}
