import { prisma } from '@pinguin/db';

export interface UseItemResult {
  success: boolean;
  message: string;
  effect?: {
    type: string;
    value?: number;
    duration?: number;
  };
}

export async function getInventoryEntry(guildId: string, userId: string, itemId: string) {
  return prisma.inventoryEntry.findUnique({
    where: { guildId_userId_itemId: { guildId, userId, itemId } },
  });
}

/**
 * Ajoute un item à l'inventaire d'un utilisateur
 */
export async function addItemToInventory(guildId: string, userId: string, itemId: string, quantity: number = 1): Promise<void> {
  const existing = await prisma.inventoryEntry.findUnique({
    where: {
      guildId_userId_itemId: { guildId, userId, itemId },
    },
  });

  if (existing) {
    await prisma.inventoryEntry.update({
      where: {
        guildId_userId_itemId: { guildId, userId, itemId },
      },
      data: {
        quantity: { increment: quantity },
      },
    });
  } else {
    await prisma.inventoryEntry.create({
      data: {
        guildId,
        userId,
        itemId,
        quantity,
      },
    });
  }
}

/**
 * Récupère l'inventaire d'un utilisateur sur un serveur
 */
export async function getUserInventory(guildId: string, userId: string) {
  return prisma.inventoryEntry.findMany({
    where: {
      guildId,
      userId,
    },
    include: {
      item: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Retire un item de l'inventaire d'un utilisateur
 */
export async function removeItemFromInventory(guildId: string, userId: string, itemId: string, quantity: number = 1): Promise<boolean> {
  const existing = await prisma.inventoryEntry.findUnique({
    where: {
      guildId_userId_itemId: { guildId, userId, itemId },
    },
  });

  if (!existing || existing.quantity < quantity) {
    return false;
  }

  if (existing.quantity === quantity) {
    await prisma.inventoryEntry.delete({
      where: {
        guildId_userId_itemId: { guildId, userId, itemId },
      },
    });
  } else {
    await prisma.inventoryEntry.update({
      where: {
        guildId_userId_itemId: { guildId, userId, itemId },
      },
      data: {
        quantity: { decrement: quantity },
      },
    });
  }

  return true;
}

/**
 * Utilise un item consommable
 */
export async function useConsumable(guildId: string, userId: string, itemId: string): Promise<UseItemResult> {
  const entry = await prisma.inventoryEntry.findUnique({
    where: {
      guildId_userId_itemId: { guildId, userId, itemId },
    },
    include: {
      item: true,
    },
  });

  if (!entry || entry.quantity < 1) {
    return {
      success: false,
      message: "Vous ne possédez pas cet item.",
    };
  }

  const item = entry.item;

  // Vérifier que l'item est consommable
  if (item.type === 'ROLE') {
    return {
      success: false,
      message: "Cet item n'est pas consommable. Il s'agit d'un rôle permanent.",
    };
  }

  // Appliquer l'effet selon le type
  switch (item.type) {
    case 'XP_BOOST': {
      return await prisma.$transaction(async (tx) => {
        const invEntry = await tx.inventoryEntry.findUnique({
          where: { guildId_userId_itemId: { guildId, userId, itemId } },
        });
        if (!invEntry || invEntry.quantity < 1) {
          return { success: false, message: "Erreur lors de la consommation de l'item." };
        }

        if (invEntry.quantity === 1) {
          await tx.inventoryEntry.delete({
            where: { guildId_userId_itemId: { guildId, userId, itemId } },
          });
        } else {
          await tx.inventoryEntry.update({
            where: { guildId_userId_itemId: { guildId, userId, itemId } },
            data: { quantity: { decrement: 1 } },
          });
        }

        const boostEndsAt = new Date(Date.now() + (item.duration || 3600) * 1000);
        await tx.economyWallet.update({
          where: { guildId_userId: { guildId, userId } },
          data: {
            xpBoostEndsAt: boostEndsAt,
            xpBoostMultiplier: item.effectValue || 2,
          },
        });

        return {
          success: true,
          message: `Boost XP activé ! Multiplicateur x${item.effectValue || 2} pour ${item.duration || 3600} secondes.`,
          effect: {
            type: 'XP_BOOST',
            value: item.effectValue || 2,
            duration: item.duration || 3600,
          },
        };
      });
    }

    case 'ANTI_THEFT': {
      return await prisma.$transaction(async (tx) => {
        const invEntry = await tx.inventoryEntry.findUnique({
          where: { guildId_userId_itemId: { guildId, userId, itemId } },
        });
        if (!invEntry || invEntry.quantity < 1) {
          return { success: false, message: "Erreur lors de la consommation de l'item." };
        }

        if (invEntry.quantity === 1) {
          await tx.inventoryEntry.delete({
            where: { guildId_userId_itemId: { guildId, userId, itemId } },
          });
        } else {
          await tx.inventoryEntry.update({
            where: { guildId_userId_itemId: { guildId, userId, itemId } },
            data: { quantity: { decrement: 1 } },
          });
        }

        const antiTheftEndsAt = new Date(Date.now() + (item.duration || 3600) * 1000);
        await tx.economyWallet.update({
          where: { guildId_userId: { guildId, userId } },
          data: { antiTheftEndsAt },
        });

        return {
          success: true,
          message: `Protection anti-vol activée pour ${item.duration || 3600} secondes !`,
          effect: {
            type: 'ANTI_THEFT',
            duration: item.duration || 3600,
          },
        };
      });
    }

    case 'LOTTO_TICKET': {
      return await prisma.$transaction(async (tx) => {
        const invEntry = await tx.inventoryEntry.findUnique({
          where: { guildId_userId_itemId: { guildId, userId, itemId } },
        });
        if (!invEntry || invEntry.quantity < 1) {
          return { success: false, message: "Erreur lors de la consommation de l'item." };
        }

        if (invEntry.quantity === 1) {
          await tx.inventoryEntry.delete({
            where: { guildId_userId_itemId: { guildId, userId, itemId } },
          });
        } else {
          await tx.inventoryEntry.update({
            where: { guildId_userId_itemId: { guildId, userId, itemId } },
            data: { quantity: { decrement: 1 } },
          });
        }

        await tx.economyWallet.update({
          where: { guildId_userId: { guildId, userId } },
          data: { lottoTicketsCount: { increment: 1 } },
        });

        return {
          success: true,
          message: "Ticket de loto utilisé ! Participation au prochain tirage enregistrée.",
          effect: { type: 'LOTTO_TICKET' },
        };
      });
    }

    default:
      return {
        success: false,
        message: "Type d'item non reconnu.",
      };
  }
}

/**
 * Trouve un item par son nom ou ID dans les settings d'économie
 */
export async function findShopItem(guildId: string, query: string) {
  const settings = await prisma.economySettings.findUnique({
    where: { guildId },
    include: { shopItems: true },
  });

  if (!settings) {
    return null;
  }

  return settings.shopItems.find(
    (item) => item.name.toLowerCase() === query.toLowerCase() || item.id === query
  );
}
