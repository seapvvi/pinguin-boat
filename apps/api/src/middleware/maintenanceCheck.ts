import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@pinguin/db';

export async function checkMaintenance(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const url = request.url;
  if (url.startsWith('/api/owner') || url.startsWith('/api/auth')) return;

  const maintenance = await prisma.maintenanceWindow.findFirst({
    where: { active: true, endsAt: { gt: new Date() } },
    select: { message: true },
  });

  if (maintenance) {
    reply.status(503).send({
      success: false,
      maintenance: true,
      message: maintenance.message,
    });
  }
}
