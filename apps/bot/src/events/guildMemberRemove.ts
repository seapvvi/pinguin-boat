import { GuildMember, Client, PartialGuildMember, EmbedBuilder } from 'discord.js';
import { prisma } from '@pinguin/db';

export async function execute(member: GuildMember | PartialGuildMember, client: Client): Promise<void> {
  if (member.user?.bot) return;
  const guildId = member.guild.id;

  const welcome = await prisma.welcomeSettings.findUnique({ where: { guildId } });
  if (!welcome || !welcome.goodbyeEnabled) return;

  if (welcome.goodbyeChannelId) {
    const channel = member.guild.channels.cache.get(welcome.goodbyeChannelId);
    if (channel?.isTextBased()) {
      const replacements = (s: string) => s
        .replace('{user}', member.user?.toString() ?? 'Un membre')
        .replace('{server}', member.guild.name)
        .replace('{members}', String(member.guild.memberCount));

      if (welcome.goodbyeEmbed) {
        const embed = new EmbedBuilder()
          .setColor((welcome.goodbyeEmbedColor || '#FF0000') as any);
        if (welcome.goodbyeMessage) embed.setDescription(replacements(welcome.goodbyeMessage));
        await channel.send({ embeds: [embed] }).catch(() => {});
      } else {
        const msg = welcome.goodbyeMessage
          ? replacements(welcome.goodbyeMessage)
          : `${member.user?.username ?? 'Un membre'} a quitté **${member.guild.name}**.`;
        await channel.send(msg).catch(() => {});
      }
    }
  }
}
