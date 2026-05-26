import { Message, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { addMessageXp } from '../services/xp';
import { isModuleEnabled } from '../guards/module';
import { handleMessage as handleProtectionMessage } from '../services/protection';
import { checkAutoMod } from '../services/automod';
import { handleCaptchaDM } from '../services/captcha';

export async function execute(message: Message, client: Client): Promise<void> {
  if (message.author.bot) return;

  if (!message.guild) {
    await handleCaptchaDM(message);
    return;
  }

  if (await handleProtectionMessage(message)) return;
  if (await checkAutoMod(message)) return;

  const levelsEnabled = await isModuleEnabled(message.guild.id, 'levels');
  if (!levelsEnabled) return;

  const settings = await prisma.xPSettings.findUnique({ where: { guildId: message.guild.id } });

  const result = await addMessageXp(message.guild.id, message.author.id, {
    channelId: message.channel.id,
    roleIds: message.member ? [...message.member.roles.cache.keys()] : [],
    contentLength: message.content.length,
    isThread: message.channel.isThread(),
  });

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
