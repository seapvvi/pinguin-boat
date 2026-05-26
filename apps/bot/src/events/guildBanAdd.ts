import { GuildBan, Client, EmbedBuilder } from 'discord.js';
import { sendGuildLog } from '../services/logs';

export async function execute(ban: GuildBan, client: Client): Promise<void> {
  await sendGuildLog(
    client,
    ban.guild.id,
    'MEMBER_BAN',
    new EmbedBuilder({
      title: '🔨 Membre banni',
      color: 0xff0000,
      fields: [
        { name: 'Utilisateur', value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: true },
        { name: 'Raison', value: ban.reason?.slice(0, 1024) || 'Aucune raison', inline: false },
      ],
      timestamp: new Date().toISOString(),
    })
  );
}
