import { Message, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { addMessageXp } from '../services/xp';
import { isModuleEnabled } from '../guards/module';
import { handleMessage as handleProtectionMessage } from '../services/protection';
import { checkAutoMod } from '../services/automod';
import { handleCaptchaDM } from '../services/captcha';
import { updateQuestProgress } from '../services/quests';
import { isEconomyActive } from '../services/economy';

export async function execute(message: Message, client: Client): Promise<void> {
  if (message.author.bot) return;

  if (!message.guild) {
    await handleCaptchaDM(message);
    return;
  }

  if (await handleProtectionMessage(message)) return;
  if (await checkAutoMod(message)) return;

  // Quest progression (economy) — must run regardless of levels module
  const economyActive = await isEconomyActive(message.guild.id);
  if (economyActive) {
    await updateQuestProgress(message.guild.id, message.author.id, 'SEND_MESSAGES', 1);
  }

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

    const profile = await prisma.xPProfile.findUnique({
      where: { guildId_userId: { guildId: message.guild.id, userId: message.author.id } },
    });

    const notificationType = profile?.levelUpNotification ?? 'CHANNEL';
    const msg = settings?.announcementMessage
      ? settings.announcementMessage
          .replace('{user}', message.author.toString())
          .replace('{level}', result.level.toString())
      : `Bravo ${message.author}, tu as atteint le niveau **${result.level}** !`;

    if (notificationType === 'DM') {
      try {
        await message.author.send(msg);
      } catch {}
    } else if (notificationType === 'CHANNEL' && settings?.announcementChannelId) {
      const channel = message.guild.channels.cache.get(settings.announcementChannelId);
      if (channel?.isTextBased()) {
        await channel.send(msg);
      }
    }
  }
}
