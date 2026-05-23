import { prisma } from '@pinguin/db';

export async function ensureUser(discordId: string, username?: string | null, avatar?: string | null) {
  const existing = await prisma.user.findUnique({ where: { discordId } });
  if (existing) return existing;
  return prisma.user.create({ data: { discordId, username: username ?? discordId, avatar: avatar ?? undefined } });
}
