import { Guild, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { deleteGuildInvites } from '../services/invite-cache';
import { logger } from '@pinguin/shared';

export const name = 'guildDelete';

export async function execute(guild: Guild, client: Client): Promise<void> {
  try {
    await prisma.guild.update({
      where: { id: guild.id },
      data: { botPresent: false },
    });
    deleteGuildInvites(guild.id);
    logger.info(`[Bot] Quitté le serveur: ${guild.name} (${guild.id})`);
  } catch (error) {
    logger.error(`[Bot] Erreur lors du départ de la guild ${guild.id}`, { err: error instanceof Error ? error.message : String(error) });
  }
}
