import { Client, ActivityType } from 'discord.js';
import { getConfig } from '@pinguin/config';
import { prisma } from '@pinguin/db';

export const once = true;

export async function execute(client: Client): Promise<void> {
  const config = getConfig();
  const user = client.user!;

  console.log(`[Bot] Connecté en tant que ${user.tag}`);
  console.log(`[Bot] ${client.guilds.cache.size} serveurs`);
  console.log(`[Bot] ${client.users.cache.size} utilisateurs`);

  user.setActivity(config.BOT_ACTIVITY_NAME || '🏔️ Pinguin BOAT | /help', {
    type: config.BOT_ACTIVITY_TYPE as ActivityType,
  });

  for (const guild of client.guilds.cache.values()) {
    try {
      const existing = await prisma.guild.findUnique({ where: { id: guild.id } });
      if (!existing) {
        await prisma.guild.create({
          data: {
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            ownerId: guild.ownerId,
            memberCount: guild.memberCount,
          },
        });
        await prisma.guildSettings.create({
          data: { guildId: guild.id },
        });
        await prisma.moduleEnabled.create({
          data: { guildId: guild.id },
        });
        console.log(`[Bot] Guild créée: ${guild.name} (${guild.id})`);
      } else if (!existing.botPresent) {
        await prisma.guild.update({
          where: { id: guild.id },
          data: { botPresent: true, name: guild.name, icon: guild.icon, memberCount: guild.memberCount },
        });
      }
    } catch (error) {
      console.error(`[Bot] Erreur lors de la vérification de la guild ${guild.id}:`, error);
    }
  }

  // Sync memberCount périodique
  setInterval(async () => {
    for (const guild of client.guilds.cache.values()) {
      try {
        await prisma.guild.update({
          where: { id: guild.id },
          data: {
            memberCount: guild.memberCount,
            name: guild.name,
            icon: guild.icon,
          },
        });
      } catch { /* ignore */ }
    }
  }, 10 * 60 * 1000);

  console.log('[Bot] Prêt !');
}
