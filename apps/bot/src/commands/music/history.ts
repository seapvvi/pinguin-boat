import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { errorEmbed, createEmbed } from '../../services/embed';
import { logger } from '@pinguin/shared';
import { requireDjRole } from '../../services/music';

export const data = new SlashCommandBuilder()
  .setName('music-history')
  .setDescription('Voir l\'historique des musiques jouées sur ce serveur');

export const module = 'music';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  if (!interaction.guild) return;
  if (!(await requireDjRole(interaction))) return;

  try {
    const history = await prisma.musicHistoryEntry.findMany({
      where: { guildId: interaction.guild.id },
      orderBy: { playedAt: 'desc' },
      take: 20,
    });

    if (history.length === 0) {
      await interaction.reply({ embeds: [errorEmbed('Erreur', 'Aucun historique musical.')], ephemeral: true });
      return;
    }

    const embed = createEmbed()
      .setTitle('📜 Historique musical')
      .setDescription(history.map((h, i) =>
        `**${i + 1}.** ${h.trackTitle} - <t:${Math.floor(h.playedAt.getTime() / 1000)}:R>`
      ).join('\n'))
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    logger.error('Erreur lors de la récupération de l\'historique musical', { err: error instanceof Error ? error.message : String(error) });
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Impossible de récupérer l\'historique.')] });
  }
}
