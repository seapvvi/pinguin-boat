import { SlashCommandBuilder, CommandInteraction, Client, GuildMember } from 'discord.js';
import { infoEmbed, errorEmbed, createEmbed } from '../../services/embed';
import { getState, formatDuration } from '../../services/music';

export const data = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Voir la file d\'attente actuelle');

export const module = 'music';

export async function execute(interaction: CommandInteraction, client: Client): Promise<void> {
  if (!interaction.guild) return;
  const state = getState(interaction.guild.id);

  if (state.queue.length === 0 && !state.currentTrack) {
    await interaction.reply({ embeds: [infoEmbed('File d\'attente', 'La file d\'attente est vide.')], ephemeral: true });
    return;
  }

  const embed = createEmbed('music')
    .setTitle('File d\'attente')
    .setTimestamp();

  if (state.currentTrack) {
    embed.addFields({
      name: '🎵 En cours',
      value: `**${state.currentTrack.title}** - ${state.currentTrack.duration > 0 ? formatDuration(state.currentTrack.duration) : 'Inconnue'}`,
    });
  }

  const queueList = state.queue.slice(0, 20).map((t, i) =>
    `**${i + 1}.** ${t.title} - ${t.duration > 0 ? formatDuration(t.duration) : 'Inconnue'}`
  ).join('\n');

  if (queueList) {
    embed.setDescription(queueList);
    if (state.queue.length > 20) {
      embed.setFooter({ text: `Et ${state.queue.length - 20} autres musiques...` });
    }
  } else {
    embed.setDescription('Aucune musique dans la file d\'attente.');
  }

  await interaction.reply({ embeds: [embed] });
}
