import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@pinguin/db';
import { getConfig } from '@pinguin/config';

const config = getConfig();

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      discordId: string;
      username: string;
      avatar: string | null;
      email: string | null;
      locale: string;
      sessionId: string;
    };
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  let token: string | undefined;

  const cookieToken = request.cookies?.session;
  if (cookieToken) {
    token = cookieToken;
  }

  if (!token) {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    reply.status(401).send({
      success: false,
      error: 'Authentification requise',
    });
    return;
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) {
    reply.status(401).send({
      success: false,
      error: 'Session invalide',
    });
    return;
  }

  if (new Date() > session.expiresAt) {
    await prisma.session.delete({ where: { id: session.id } });
    reply.status(401).send({
      success: false,
      error: 'Session expirée',
    });
    return;
  }

  const blacklisted = await prisma.blacklistUser.findUnique({
    where: { targetId: session.user.discordId },
  });

  if (blacklisted) {
    reply.status(403).send({
      success: false,
      error: `Votre compte a été blacklisté pour infraction. Raison: ${blacklisted.reason}. Vous pouvez contester en ouvrant un ticket: https://discord.gg/EJHhcYkXMQ`,
    });
    return;
  }

  request.user = {
    id: session.user.id,
    discordId: session.user.discordId,
    username: session.user.username,
    avatar: session.user.avatar,
    email: session.user.email,
    locale: session.user.locale,
    sessionId: session.id,
  };
}
