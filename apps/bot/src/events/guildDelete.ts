import { Guild, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { logger } from '@pinguin/shared';

export async function execute(guild: Guild, client: Client): Promise<void> {
  try {
    await prisma.guild.update({
      where: { id: guild.id },
      data: { botPresent: false },
    });
    logger.info(`[Bot] Quitté le serveur: ${guild.name} (${guild.id})`);
  } catch (error) {
    logger.error(`[Bot] Erreur lors du départ de la guild ${guild.id}`, { err: error instanceof Error ? error.message : String(error) });
  }
}
