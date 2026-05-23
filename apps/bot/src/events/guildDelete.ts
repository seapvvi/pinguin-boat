import { Guild, Client } from 'discord.js';
import { prisma } from '@pinguin/db';

export async function execute(guild: Guild, client: Client): Promise<void> {
  try {
    await prisma.guild.update({
      where: { id: guild.id },
      data: { botPresent: false },
    });
    console.log(`[Bot] Quitté le serveur: ${guild.name} (${guild.id})`);
  } catch (error) {
    console.error(`[Bot] Erreur lors du départ de la guild ${guild.id}:`, error);
  }
}
