import { VoiceState, Client, GuildMember } from 'discord.js';
import { prisma } from '@pinguin/db';
import { addVoiceXp } from '../services/xp';
import { isModuleEnabled } from '../guards/module';

const voiceTimers = new Map<string, { startTime: number; channelId: string }>();

export async function execute(oldState: VoiceState, newState: VoiceState, client: Client): Promise<void> {
  if (!newState.guild) return;

  const userId = newState.member?.id || newState.id;
  const guildId = newState.guild.id;
  const key = `${guildId}-${userId}`;

  const levelsEnabled = await isModuleEnabled(guildId, 'levels');
  if (!levelsEnabled) return;

  const joined = !oldState.channelId && newState.channelId;
  const left = oldState.channelId && !newState.channelId;
  const moved = oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

  if (joined || moved) {
    voiceTimers.set(key, {
      startTime: Date.now(),
      channelId: newState.channelId!,
    });
  }

  if (left || moved) {
    const timer = voiceTimers.get(key);
    if (timer) {
      const minutes = Math.floor((Date.now() - timer.startTime) / 60000);
      if (minutes >= 1) {
        const result = await addVoiceXp(guildId, userId, minutes);
        if (result.leveledUp && newState.member) {
          const rewards = await prisma.xPRoleReward.findMany({
            where: { guildId, levelRequired: { lte: result.level } },
          });
          for (const reward of rewards) {
            if (!newState.member.roles.cache.has(reward.roleId)) {
              try { await newState.member.roles.add(reward.roleId); } catch {}
            }
          }

          const profile = await prisma.xPProfile.findUnique({
            where: { guildId_userId: { guildId, userId } },
          });

          const settings = await prisma.xPSettings.findUnique({ where: { guildId } });
          const notificationType = profile?.levelUpNotification ?? 'CHANNEL';
          const msg = settings?.announcementMessage
            ? settings.announcementMessage
                .replace('{user}', `<@${userId}>`)
                .replace('{level}', result.level.toString())
            : `Bravo <@${userId}>, tu as atteint le niveau **${result.level}** !`;

          if (notificationType === 'DM') {
            try {
              await newState.member.send(msg);
            } catch {}
          } else if (notificationType === 'CHANNEL' && settings?.announcementChannelId) {
            const channel = newState.guild.channels.cache.get(settings.announcementChannelId);
            if (channel?.isTextBased()) {
              await channel.send(msg);
            }
          }
        }
      }
      voiceTimers.delete(key);
    }
  }

  if (joined) {
    const settings = await prisma.xPSettings.findUnique({ where: { guildId } });
    if (settings) {
      const ignoredChannels: string[] = JSON.parse(settings.ignoredChannels);
      if (ignoredChannels.includes(newState.channelId!)) {
        voiceTimers.delete(key);
      }
    }
  }
}
