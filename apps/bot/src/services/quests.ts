import { prisma, QuestType, QuestObjectiveType, QuestStatus } from '@pinguin/db';
import { getEconomySettings, getOrCreateWallet } from './economy';

interface QuestDefinition {
  type: QuestType;
  objectiveType: QuestObjectiveType;
  objectiveTarget: number;
  reward: number;
  title: string;
  description: string;
}

const DAILY_QUESTS: QuestDefinition[] = [
  {
    type: QuestType.DAILY,
    objectiveType: QuestObjectiveType.SEND_MESSAGES,
    objectiveTarget: 20,
    reward: 150,
    title: '🗣️ Bavard',
    description: 'Envoyez 20 messages dans le serveur',
  },
  {
    type: QuestType.DAILY,
    objectiveType: QuestObjectiveType.WIN_BLACKJACK,
    objectiveTarget: 1,
    reward: 200,
    title: '🃏 Chanceux',
    description: 'Gagnez 1 partie de blackjack',
  },
  {
    type: QuestType.DAILY,
    objectiveType: QuestObjectiveType.EARN_MONEY,
    objectiveTarget: 500,
    reward: 100,
    title: '💰 Travailleur',
    description: 'Gagnez 500 pièces (via work, daily, etc.)',
  },
];

const WEEKLY_QUESTS: QuestDefinition[] = [
  {
    type: QuestType.WEEKLY,
    objectiveType: QuestObjectiveType.SEND_MESSAGES,
    objectiveTarget: 100,
    reward: 500,
    title: '📞 Social',
    description: 'Envoyez 100 messages dans le serveur',
  },
  {
    type: QuestType.WEEKLY,
    objectiveType: QuestObjectiveType.WIN_BLACKJACK,
    objectiveTarget: 5,
    reward: 800,
    title: '🎰 Pro du casino',
    description: 'Gagnez 5 parties de blackjack',
  },
  {
    type: QuestType.WEEKLY,
    objectiveType: QuestObjectiveType.LEVEL_UP,
    objectiveTarget: 3,
    reward: 1000,
    title: '⭐ Évolution',
    description: 'Gagnez 3 niveaux',
  },
];

export async function generateDailyQuests(guildId: string): Promise<void> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  for (const questDef of DAILY_QUESTS) {
    const existing = await prisma.quest.findFirst({
      where: {
        guildId,
        type: QuestType.DAILY,
        objectiveType: questDef.objectiveType,
        startsAt: { gte: startOfDay },
      },
    });

    if (!existing) {
      await prisma.quest.create({
        data: {
          guildId,
          type: questDef.type,
          objectiveType: questDef.objectiveType,
          objectiveTarget: questDef.objectiveTarget,
          reward: questDef.reward,
          title: questDef.title,
          description: questDef.description,
          startsAt: startOfDay,
          endsAt: endOfDay,
        },
      });
    }
  }
}

export async function generateWeeklyQuests(guildId: string): Promise<void> {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff);
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);

  for (const questDef of WEEKLY_QUESTS) {
    const existing = await prisma.quest.findFirst({
      where: {
        guildId,
        type: QuestType.WEEKLY,
        objectiveType: questDef.objectiveType,
        startsAt: { gte: startOfWeek },
      },
    });

    if (!existing) {
      await prisma.quest.create({
        data: {
          guildId,
          type: questDef.type,
          objectiveType: questDef.objectiveType,
          objectiveTarget: questDef.objectiveTarget,
          reward: questDef.reward,
          title: questDef.title,
          description: questDef.description,
          startsAt: startOfWeek,
          endsAt: endOfWeek,
        },
      });
    }
  }
}

export async function getActiveQuests(guildId: string, userId: string) {
  const now = new Date();
  const quests = await prisma.quest.findMany({
    where: {
      guildId,
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    include: {
      progress: {
        where: { userId },
      },
    },
  });

  return quests.map((quest) => ({
    ...quest,
    userProgress: quest.progress[0] || null,
  }));
}

export async function updateQuestProgress(
  guildId: string,
  userId: string,
  objectiveType: QuestObjectiveType,
  increment: number = 1
): Promise<boolean> {
  const now = new Date();
  const activeQuests = await prisma.quest.findMany({
    where: {
      guildId,
      objectiveType,
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
  });

  let rewardEarned = false;

  for (const quest of activeQuests) {
    let progress = await prisma.questProgress.findUnique({
      where: {
        guildId_userId_questId: {
          guildId,
          userId,
          questId: quest.id,
        },
      },
    });

    if (!progress) {
      progress = await prisma.questProgress.create({
        data: {
          guildId,
          userId,
          questId: quest.id,
          progress: increment,
          status: QuestStatus.ACTIVE,
        },
      });
    } else if (progress.status === QuestStatus.ACTIVE) {
      progress = await prisma.questProgress.update({
        where: { id: progress.id },
        data: {
          progress: Math.min(progress.progress + increment, quest.objectiveTarget),
        },
      });
    }

    if (progress.progress >= quest.objectiveTarget && progress.status === QuestStatus.ACTIVE) {
      await prisma.questProgress.update({
        where: { id: progress.id },
        data: {
          status: QuestStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      await prisma.economyWallet.update({
        where: { guildId_userId: { guildId, userId } },
        data: {
          wallet: { increment: quest.reward },
          totalEarned: { increment: quest.reward },
        },
      });

      await prisma.economyTransaction.create({
        data: {
          guildId,
          toUserId: userId,
          amount: quest.reward,
          type: 'EARN',
          description: `Récompense de quête: ${quest.title}`,
        },
      });

      rewardEarned = true;
    }
  }

  return rewardEarned;
}

export async function claimQuestReward(guildId: string, userId: string, questId: string): Promise<boolean> {
  const progress = await prisma.questProgress.findUnique({
    where: {
      guildId_userId_questId: {
        guildId,
        userId,
        questId,
      },
    },
    include: { quest: true },
  });

  if (!progress || progress.status !== QuestStatus.COMPLETED) {
    return false;
  }

  const claimed = await prisma.$transaction(async (tx) => {
    const current = await tx.questProgress.findUnique({
      where: { id: progress.id },
    });
    if (!current || current.status !== QuestStatus.COMPLETED || current.completedAt) {
      return false;
    }

    await tx.economyWallet.update({
      where: { guildId_userId: { guildId, userId } },
      data: {
        wallet: { increment: progress.quest.reward },
        totalEarned: { increment: progress.quest.reward },
      },
    });

    await tx.economyTransaction.create({
      data: {
        guildId,
        toUserId: userId,
        amount: progress.quest.reward,
        type: 'EARN',
        description: `Récompense de quête: ${progress.quest.title}`,
      },
    });

    await tx.questProgress.update({
      where: { id: progress.id },
      data: { completedAt: new Date() },
    });

    return true;
  });

  return claimed;
}

export async function cleanupExpiredQuests(): Promise<void> {
  const now = new Date();
  await prisma.questProgress.updateMany({
    where: {
      quest: { endsAt: { lt: now } },
      status: QuestStatus.ACTIVE,
    },
    data: { status: QuestStatus.EXPIRED },
  });
}
