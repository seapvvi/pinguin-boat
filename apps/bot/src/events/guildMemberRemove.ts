import { GuildMember, Client, PartialGuildMember } from 'discord.js';
import { prisma } from '@pinguin/db';

export async function execute(member: GuildMember | PartialGuildMember, client: Client): Promise<void> {
  if (member.user?.bot) return;
  const guildId = member.guild.id;

  const welcome = await prisma.welcomeSettings.findUnique({ where: { guildId } });
  if (!welcome || !welcome.goodbyeEnabled) return;

  if (welcome.goodbyeChannelId) {
    const channel = member.guild.channels.cache.get(welcome.goodbyeChannelId);
    if (channel?.isTextBased()) {
      const msg = welcome.goodbyeMessage
        ? welcome.goodbyeMessage
            .replace('{user}', member.user?.toString() ?? 'Un membre')
            .replace('{server}', member.guild.name)
            .replace('{members}', String(member.guild.memberCount))
        : `${member.user?.username ?? 'Un membre'} a quitté **${member.guild.name}**.`;
      await channel.send(msg).catch(() => {});
    }
  }
}
