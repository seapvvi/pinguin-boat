import { Guild, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { logger } from '@pinguin/shared';

export const name = 'guildCreate';

export async function execute(guild: Guild, client: Client): Promise<void> {
  try {
    await prisma.guild.upsert({
      where: { id: guild.id },
      update: {
        name: guild.name,
        icon: guild.icon,
        ownerId: guild.ownerId,
        memberCount: guild.memberCount,
        botPresent: true,
      },
      create: {
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        ownerId: guild.ownerId,
        memberCount: guild.memberCount,
        botPresent: true,
      },
    });

    await prisma.guildSettings.upsert({
      where: { guildId: guild.id },
      update: {},
      create: { guildId: guild.id },
    });

    await prisma.moduleEnabled.upsert({
      where: { guildId: guild.id },
      update: {},
      create: { guildId: guild.id },
    });

    logger.info(`[Bot] Rejoint le serveur: ${guild.name} (${guild.id})`);
  } catch (error) {
    logger.error(`[Bot] Erreur lors de l'ajout de la guild ${guild.id}`, { err: error instanceof Error ? error.message : String(error) });
  }
}
