import { SlashCommandBuilder, CommandInteraction, Client, version } from 'discord.js';
import { createEmbed } from '../../services/embed';
import { prisma } from '@pinguin/db';

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('Voir les statistiques du bot');

export async function execute(interaction: CommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guild) return;

  const guildCount = client.guilds.cache.size;
  const userCount = client.users.cache.size;
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);

  let totalCases = 0;
  try {
    totalCases = await prisma.moderationCase.count();
  } catch {}

  const embed = createEmbed('default')
    .setTitle('📊 Statistiques')
    .addFields(
      { name: 'Serveurs', value: `${guildCount}`, inline: true },
      { name: 'Utilisateurs', value: `${userCount}`, inline: true },
      { name: 'Uptime', value: `${days}j ${hours}h ${minutes}m`, inline: true },
      { name: 'Discord.js', value: `v${version}`, inline: true },
      { name: 'Node.js', value: process.version, inline: true },
      { name: 'Cas de modération', value: `${totalCases}`, inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
