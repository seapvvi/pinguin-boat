import { GuildMember, Client } from 'discord.js';
import { prisma } from '@pinguin/db';

export async function execute(member: GuildMember, client: Client): Promise<void> {
  if (member.user.bot) return;
  const guildId = member.guild.id;

  const welcome = await prisma.welcomeSettings.findUnique({ where: { guildId } });
  if (!welcome || !welcome.enabled) return;

  if (welcome.welcomeChannelId) {
    const channel = member.guild.channels.cache.get(welcome.welcomeChannelId);
    if (channel?.isTextBased()) {
      const msg = welcome.welcomeMessage
        ? welcome.welcomeMessage
            .replace('{user}', member.toString())
            .replace('{server}', member.guild.name)
            .replace('{members}', String(member.guild.memberCount))
        : `Bienvenue ${member.toString()} sur **${member.guild.name}** !`;
      await channel.send(msg).catch(() => {});
    }
  }

  if (welcome.welcomeDM && welcome.welcomeDMMessage) {
    const dmMsg = welcome.welcomeDMMessage
      .replace('{user}', member.user.username)
      .replace('{server}', member.guild.name);
    await member.send(dmMsg).catch(() => {});
  }

  const ar = await prisma.autoroleSettings.findUnique({ where: { guildId }, include: { entries: true } });
  if (ar?.enabled) {
    const joinRoles = ar.entries.filter((e) => e.type === 'JOIN');
    for (const entry of joinRoles) {
      if (member.roles.cache.has(entry.roleId)) continue;
      await member.roles.add(entry.roleId).catch(() => {});
    }
  }
}
