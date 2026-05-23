import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { errorEmbed, createEmbed } from '../../services/embed';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Voir le classement XP du serveur');

export const module = 'levels';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guild) return;

  try {
    const profiles = await prisma.xPProfile.findMany({
      where: { guildId: interaction.guild.id },
      orderBy: { xp: 'desc' },
      take: 20,
    });

    if (profiles.length === 0) {
      await interaction.editReply({ embeds: [errorEmbed('Classement vide', 'Aucun membre n\'a encore d\'XP sur ce serveur. Commencez à parler !')] });
      return;
    }

    const lines = await Promise.all(profiles.map(async (p, i) => {
      const member = await interaction.guild!.members.fetch(p.userId).catch(() => null);
      const name = member?.displayName || p.userId.slice(0, 8);
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
      return `${medal} **${name}** — Niveau ${p.level} (${p.xp} XP)`;
    }));

    const embed = createEmbed('level')
      .setTitle('🏆 Classement XP')
      .setDescription(lines.join('\n'))
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error(error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de récupérer le classement.')] });
  }
}
