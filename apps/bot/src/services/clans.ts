import { prisma } from '@pinguin/db';
import { ensureUser } from './user';

export const WAR_DURATION_MS = 24 * 60 * 60 * 1000;
export const WAR_PRIZE_PER_MEMBER = 500;

export async function getClan(guildId: string, clanId: string) {
  return prisma.clan.findFirst({
    where: { id: clanId, guildId },
  });
}

export async function getClanByName(guildId: string, name: string) {
  return prisma.clan.findFirst({
    where: { guildId, name: { equals: name, mode: 'insensitive' } },
  });
}

export async function getUserClan(guildId: string, userId: string) {
  const member = await prisma.clanMember.findUnique({
    where: { guildId_userId: { guildId, userId } },
    include: { clan: true },
  });
  return member ?? null;
}

export async function getUserClanWithMembers(guildId: string, userId: string) {
  const member = await prisma.clanMember.findUnique({
    where: { guildId_userId: { guildId, userId } },
    include: {
      clan: {
        include: {
          members: {
            include: {
              clan: false,
            },
          },
        },
      },
    },
  });
  return member ?? null;
}

export async function getClanMembers(clanId: string) {
  return prisma.clanMember.findMany({
    where: { clanId },
  });
}

export async function getClanMember(guildId: string, userId: string) {
  return prisma.clanMember.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });
}

export async function getClanTotalXp(guildId: string, clanId: string): Promise<number> {
  const members = await prisma.clanMember.findMany({
    where: { clanId },
  });
  if (members.length === 0) return 0;

  const profiles = await prisma.xPProfile.findMany({
    where: {
      guildId,
      userId: { in: members.map((m) => m.userId) },
    },
  });

  return profiles.reduce((sum, p) => sum + p.xp, 0);
}

export async function getClanTotalWallet(guildId: string, clanId: string): Promise<number> {
  const members = await prisma.clanMember.findMany({
    where: { clanId },
  });
  if (members.length === 0) return 0;

  const wallets = await prisma.economyWallet.findMany({
    where: {
      guildId,
      userId: { in: members.map((m) => m.userId) },
    },
  });

  return wallets.reduce((sum, w) => sum + w.wallet + w.bank, 0);
}

export async function getClansLeaderboard(guildId: string, type: 'xp' | 'wallet') {
  const clans = await prisma.clan.findMany({
    where: { guildId },
    include: { members: true },
  });

  const stats = await Promise.all(
    clans.map(async (clan) => {
      if (clan.members.length === 0) return { ...clan, total: 0, memberCount: 0 };
      const userIds = clan.members.map((m) => m.userId);

      if (type === 'xp') {
        const profiles = await prisma.xPProfile.findMany({
          where: { guildId, userId: { in: userIds } },
        });
        const total = profiles.reduce((s, p) => s + p.xp, 0);
        return { ...clan, total, memberCount: clan.members.length };
      }

      const wallets = await prisma.economyWallet.findMany({
        where: { guildId, userId: { in: userIds } },
      });
      const total = wallets.reduce((s, w) => s + w.wallet + w.bank, 0);
      return { ...clan, total, memberCount: clan.members.length };
    })
  );

  return stats.sort((a, b) => b.total - a.total);
}

export async function createClan(guildId: string, name: string, ownerId: string, description?: string) {
  const existing = await prisma.clanMember.findUnique({
    where: { guildId_userId: { guildId, userId: ownerId } },
  });
  if (existing) {
    throw new Error('Vous êtes déjà dans un clan.');
  }

  const nameTaken = await prisma.clan.findFirst({
    where: { guildId, name: { equals: name, mode: 'insensitive' } },
  });
  if (nameTaken) {
    throw new Error('Ce nom de clan est déjà pris.');
  }

  return prisma.$transaction(async (tx) => {
    const clan = await tx.clan.create({
      data: { guildId, name, ownerId, description },
    });

    await tx.clanMember.create({
      data: { clanId: clan.id, guildId, userId: ownerId, role: 'OWNER' },
    });

    return clan;
  });
}

export async function addMember(clanId: string, guildId: string, userId: string, role: 'MEMBER' | 'OFFICER' = 'MEMBER') {
  const existing = await prisma.clanMember.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });
  if (existing) {
    throw new Error('Cet utilisateur est déjà dans un clan.');
  }

  return prisma.clanMember.create({
    data: { clanId, guildId, userId, role },
  });
}

export async function removeMember(clanId: string, guildId: string, userId: string) {
  const member = await prisma.clanMember.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });
  if (!member || member.clanId !== clanId) {
    throw new Error('Vous n\'êtes pas membre de ce clan.');
  }

  await prisma.clanMember.delete({
    where: { guildId_userId: { guildId, userId } },
  });
}

export async function deleteClan(clanId: string, guildId: string, userId: string) {
  const clan = await prisma.clan.findFirst({
    where: { id: clanId, guildId },
  });
  if (!clan) throw new Error('Clan introuvable.');
  if (clan.ownerId !== userId) throw new Error('Seul le propriétaire peut supprimer le clan.');

  return prisma.clan.delete({ where: { id: clanId } });
}

export async function getActiveWarForClan(guildId: string, clanId: string) {
  return prisma.clanWar.findFirst({
    where: {
      guildId,
      status: { in: ['PENDING', 'ACTIVE'] },
      OR: [{ challengerId: clanId }, { opponentId: clanId }],
    },
  });
}

export async function getPendingWarForClan(guildId: string, clanId: string) {
  return prisma.clanWar.findFirst({
    where: {
      guildId,
      status: 'PENDING',
      opponentId: clanId,
    },
  });
}

export async function startWar(guildId: string, challengerId: string, opponentId: string) {
  if (challengerId === opponentId) {
    throw new Error('Vous ne pouvez pas défier votre propre clan.');
  }

  const existingWar = await prisma.clanWar.findFirst({
    where: {
      guildId,
      status: { in: ['PENDING', 'ACTIVE'] },
      OR: [
        { challengerId, opponentId },
        { challengerId: opponentId, opponentId: challengerId },
      ],
    },
  });
  if (existingWar) {
    throw new Error('Une guerre est déjà en cours ou en attente entre ces deux clans.');
  }

  const opponentClan = await getClan(guildId, opponentId);
  if (!opponentClan) throw new Error('Clan adverse introuvable.');

  const memberCount = await prisma.clanMember.count({
    where: { clanId: opponentId },
  });

  const prizePool = WAR_PRIZE_PER_MEMBER * Math.max(1, memberCount);

  return prisma.clanWar.create({
    data: {
      guildId,
      challengerId,
      opponentId,
      status: 'PENDING',
      prizePool,
    },
  });
}

export async function acceptWar(warId: string, guildId: string) {
  const war = await prisma.clanWar.findFirst({
    where: { id: warId, guildId, status: 'PENDING' },
  });
  if (!war) throw new Error('Guerre introuvable ou déjà expirée.');

  const now = new Date();
  return prisma.clanWar.update({
    where: { id: warId },
    data: {
      status: 'ACTIVE',
      startedAt: now,
      endsAt: new Date(now.getTime() + WAR_DURATION_MS),
    },
  });
}

export async function completeWar(warId: string) {
  const war = await prisma.clanWar.findUnique({
    where: { id: warId },
    include: {
      challenger: true,
      opponent: true,
    },
  });
  if (!war || war.status !== 'ACTIVE') {
    throw new Error('Cette guerre n\'est pas active.');
  }

  const winnerId = war.challengerXp > war.opponentXp
    ? war.challengerId
    : war.opponentXp > war.challengerXp
      ? war.opponentId
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.clanWar.update({
      where: { id: warId },
      data: {
        status: 'COMPLETED',
        winnerId,
      },
    });

    if (winnerId) {
      const members = await tx.clanMember.findMany({
        where: { clanId: winnerId, guildId: war.guildId },
      });

      for (const member of members) {
        await ensureUser(member.userId);

        const existing = await tx.economyWallet.findUnique({
          where: { guildId_userId: { guildId: war.guildId, userId: member.userId } },
        });

        if (existing) {
          await tx.economyWallet.update({
            where: { guildId_userId: { guildId: war.guildId, userId: member.userId } },
            data: {
              wallet: { increment: war.prizePool },
              totalEarned: { increment: war.prizePool },
            },
          });
        } else {
          await tx.economyWallet.create({
            data: {
              guildId: war.guildId,
              userId: member.userId,
              wallet: war.prizePool,
              bank: 0,
              totalEarned: war.prizePool,
            },
          });
        }

        await tx.economyTransaction.create({
          data: {
            guildId: war.guildId,
            toUserId: member.userId,
            amount: war.prizePool,
            type: 'EARN',
            description: `Victoire de guerre de clan — ${war.challenger.name} vs ${war.opponent.name}`,
          },
        });
      }
    }
  });

  const updatedWar = await prisma.clanWar.findUnique({
    where: { id: warId },
    include: { challenger: true, opponent: true },
  });

  return updatedWar;
}

export async function cancelWar(warId: string, guildId: string, userId: string) {
  const war = await prisma.clanWar.findFirst({
    where: { id: warId, guildId, status: { in: ['PENDING', 'ACTIVE'] } },
    include: { challenger: true },
  });
  if (!war) throw new Error('Guerre introuvable.');
  if (war.challenger.ownerId !== userId) {
    throw new Error('Seul le propriétaire du clan challenger peut annuler la guerre.');
  }

  return prisma.clanWar.update({
    where: { id: warId },
    data: { status: 'CANCELLED' },
  });
}

export async function trackWarXp(guildId: string, userId: string, xpGained: number) {
  const member = await prisma.clanMember.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });
  if (!member) return;

  const war = await prisma.clanWar.findFirst({
    where: {
      guildId,
      status: 'ACTIVE',
      OR: [{ challengerId: member.clanId }, { opponentId: member.clanId }],
    },
  });
  if (!war) return;

  if (war.challengerId === member.clanId) {
    await prisma.clanWar.update({
      where: { id: war.id },
      data: { challengerXp: { increment: xpGained } },
    });
  } else {
    await prisma.clanWar.update({
      where: { id: war.id },
      data: { opponentXp: { increment: xpGained } },
    });
  }
}
