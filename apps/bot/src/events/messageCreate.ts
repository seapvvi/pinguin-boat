import { Message, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { addMessageXp } from '../services/xp';
import { isModuleEnabled } from '../guards/module';
import { handleMessage as handleProtectionMessage } from '../services/protection';

export async function execute(message: Message, client: Client): Promise<void> {
  if (message.author.bot || !message.guild) return;

  if (await handleProtectionMessage(message)) return;

  const levelsEnabled = await isModuleEnabled(message.guild.id, 'levels');
  if (!levelsEnabled) return;

  const settings = await prisma.xPSettings.findUnique({ where: { guildId: message.guild.id } });

  if (settings) {
    const ignoredChannels: string[] = JSON.parse(settings.ignoredChannels);
    const ignoredRoles: string[] = JSON.parse(settings.ignoredRoles);

    if (ignoredChannels.includes(message.channel.id)) return;
    if (message.member && ignoredRoles.some((r) => message.member!.roles.cache.has(r))) return;
  }

  const result = await addMessageXp(message.guild.id, message.author.id);

  if (result.leveledUp) {
    const rewards = await prisma.xPRoleReward.findMany({
      where: { guildId: message.guild.id, levelRequired: { lte: result.level } },
    });
    for (const reward of rewards) {
      if (message.member && !message.member.roles.cache.has(reward.roleId)) {
        try { await message.member.roles.add(reward.roleId); } catch {}
      }
    }
    if (settings?.announcementChannelId) {
      const channel = message.guild.channels.cache.get(settings.announcementChannelId);
      if (channel?.isTextBased()) {
        const msg = settings.announcementMessage
          ? settings.announcementMessage
              .replace('{user}', message.author.toString())
              .replace('{level}', result.level.toString())
          : `Bravo ${message.author}, tu as atteint le niveau **${result.level}** !`;
        await channel.send(msg);
      }
    }
  }
}
