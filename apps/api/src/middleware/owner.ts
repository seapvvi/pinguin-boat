import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@pinguin/db';
import { getConfig } from '@pinguin/config';

const config = getConfig();

export async function requireOwner(
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
    await prisma.ownerLog.create({
      data: {
        userId: request.user.id,
        action: 'UNAUTHORIZED_ACCESS',
        details: JSON.stringify({
          path: request.url,
          method: request.method,
          ip: request.ip,
        }),
        ip: request.ip,
        userAgent: request.headers['user-agent'] || '',
        success: false,
      },
    });

    reply.status(403).send({
      success: false,
      error: 'Accès réservé au propriétaire',
    });
    return;
  }

  const twoFA = await prisma.owner2FA.findUnique({
    where: { userId: request.user.id },
  });

  if (twoFA?.enabled && !twoFA.verified) {
    reply.status(401).send({
      success: false,
      error: 'Authentification à deux facteurs requise',
      data: { requires2FA: true },
    });
    return;
  }

  await prisma.ownerLog.create({
    data: {
      userId: request.user.id,
      action: 'ACCESS_GRANTED',
      details: JSON.stringify({
        path: request.url,
        method: request.method,
      }),
      ip: request.ip,
      userAgent: request.headers['user-agent'] || '',
      success: true,
    },
  });
}
