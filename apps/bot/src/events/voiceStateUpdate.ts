import { VoiceState, Client, GuildMember } from 'discord.js';
import { prisma } from '@pinguin/db';
import { addVoiceXp } from '../services/xp';
import { isModuleEnabled } from '../guards/module';

export const name = 'voiceStateUpdate';

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
    const settings = await prisma.xPSettings.findUnique({ where: { guildId } });
    const ignoredChannels: string[] = settings ? JSON.parse(settings.ignoredChannels) : [];
    if (newState.channelId && ignoredChannels.includes(newState.channelId)) {
      return;
    }
    voiceTimers.set(key, {
      startTime: Date.now(),
      channelId: newState.channelId!,
    });
  }

  if (left || moved) {
    const timer = voiceTimers.get(key);
    if (timer) {
      const oldSettings = await prisma.xPSettings.findUnique({ where: { guildId } });
      const oldIgnoredChannels: string[] = oldSettings ? JSON.parse(oldSettings.ignoredChannels) : [];
      if (oldState.channelId && oldIgnoredChannels.includes(oldState.channelId)) {
        voiceTimers.delete(key);
        return;
      }

      const minutes = Math.floor((Date.now() - timer.startTime) / 60000);
      if (minutes >= 1) {
        const member = newState.member;
        if (!member) return;
        const result = await addVoiceXp(guildId, userId, minutes, [...member.roles.cache.keys()]);
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

          const notifSettings = await prisma.xPSettings.findUnique({ where: { guildId } });
          const notificationType = profile?.levelUpNotification ?? 'CHANNEL';
          const msg = notifSettings?.announcementMessage
            ? notifSettings.announcementMessage
                .replace('{user}', `<@${userId}>`)
                .replace('{level}', result.level.toString())
            : `Bravo <@${userId}>, tu as atteint le niveau **${result.level}** !`;

          if (notificationType === 'DM') {
            try {
              await newState.member.send(msg);
            } catch {}
          } else if (notificationType === 'CHANNEL' && notifSettings?.announcementChannelId) {
            const channel = newState.guild.channels.cache.get(notifSettings.announcementChannelId);
            if (channel?.isTextBased()) {
              await channel.send(msg);
            }
          }
        }
      }
      voiceTimers.delete(key);
    }
  }
}
