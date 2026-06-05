import {
  Client,
  GuildMember,
  Message,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import { prisma } from '@pinguin/db';
import { sendCaptcha, hasPendingCaptcha } from './captcha';

const joinTimestamps = new Map<string, number[]>();
const messageTimestamps = new Map<string, number[]>();

const LINK_REGEX = /https?:\/\/[^\s]+|www\.[^\s]+/i;

async function getSettings(guildId: string) {
  const [protection, modules] = await Promise.all([
    prisma.protectionSettings.findUnique({ where: { guildId } }),
    prisma.moduleEnabled.findUnique({ where: { guildId } }),
  ]);
  if (!modules?.protection) return null;
  if (!protection?.enabled && !protection?.emergencyMode) return null;
  return protection;
}

async function applyPunishment(member: GuildMember, punishment: string, reason: string) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return;
  try {
    if (punishment === 'BAN') {
      await member.ban({ reason });
    } else if (punishment === 'KICK') {
      await member.kick(reason);
    } else {
      await member.timeout(60 * 60 * 1000, reason);
    }
  } catch {}
}

export async function handleMemberJoin(member: GuildMember): Promise<void> {
  if (member.user.bot) return;
  const settings = await getSettings(member.guild.id);
  if (!settings) return;

  const now = Date.now();
  const key = member.guild.id;
  const timestamps = joinTimestamps.get(key) ?? [];
  timestamps.push(now);
  const windowMs = Math.max(settings.raidInterval ?? 10, 1) * 1000;
  const recent = timestamps.filter((t) => now - t < windowMs);
  joinTimestamps.set(key, recent);

  if (settings.emergencyMode || (settings.antiRaid && recent.length >= (settings.raidThreshold ?? 10))) {
    if (settings.antiRaid && recent.length >= (settings.raidThreshold ?? 10)) {
      const everyone = member.guild.roles.everyone;
      for (const ch of member.guild.channels.cache.values()) {
        if (ch.isTextBased() && 'permissionOverwrites' in ch) {
          await (ch as TextChannel).permissionOverwrites
            .edit(everyone.id, { SendMessages: false })
            .catch(() => {});
        }
      }
    }
    await applyPunishment(member, settings.punishment, 'Protection anti-raid');
    return;
  }

  if (settings.antiAlts) {
    const accountAgeDays =
      (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
    if (accountAgeDays < settings.altAccountAge) {
      await applyPunishment(member, settings.punishment, 'Compte trop récent');
      return;
    }
  }

  if (settings.captchaVerification) {
    await sendCaptcha(member, 5);
  }
}

export async function handleMessage(message: Message): Promise<boolean> {
  if (!message.guild || message.author.bot || !message.member) return false;

  if (await hasPendingCaptcha(message.guild.id, message.author.id)) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await message.delete().catch(() => {});
      return true;
    }
  }

  const settings = await getSettings(message.guild.id);
  if (!settings) return false;

  if (settings.emergencyMode) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await message.delete().catch(() => {});
      return true;
    }
    return false;
  }

  const content = message.content;

  const hasLink = LINK_REGEX.test(content) || /discord\.gg\/|discord\.com\/invite\//i.test(content);
  if (settings.antiLink && hasLink) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await message.delete().catch(() => {});
      return true;
    }
  }

  if (settings.antiMassMention) {
    const mentions = message.mentions.users.size + message.mentions.roles.size;
    if (mentions >= settings.mentionThreshold) {
      await message.delete().catch(() => {});
      return true;
    }
  }

  if (settings.antiSpam) {
    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const timestamps = messageTimestamps.get(key) ?? [];
    timestamps.push(now);
    const windowMs = Math.max(settings.spamInterval, 1) * 1000;
    const recent = timestamps.filter((t) => now - t < windowMs);
    messageTimestamps.set(key, recent);
    if (recent.length >= settings.spamThreshold) {
      await message.delete().catch(() => {});
      await applyPunishment(message.member, settings.punishment, 'Anti-spam');
      return true;
    }
  }

  return false;
}

export async function setEmergencyMode(client: Client, guildId: string, enable: boolean): Promise<void> {
  await prisma.protectionSettings.upsert({
    where: { guildId },
    update: { emergencyMode: enable, enabled: enable ? true : undefined },
    create: { guildId, emergencyMode: enable, enabled: true },
  });

  const discordGuild = client.guilds.cache.get(guildId);
  if (!discordGuild) return;

  for (const channel of discordGuild.channels.cache.values()) {
    if (!channel.isTextBased() || channel.isDMBased()) continue;
    const text = channel as TextChannel;
    try {
      if (enable) {
        await text.permissionOverwrites.edit(discordGuild.roles.everyone, {
          SendMessages: false,
          AddReactions: false,
          CreatePublicThreads: false,
          CreatePrivateThreads: false,
        });
      } else {
        await text.permissionOverwrites.delete(discordGuild.roles.everyone);
      }
    } catch {}
  }
}
