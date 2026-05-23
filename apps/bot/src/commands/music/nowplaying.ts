import { SlashCommandBuilder, CommandInteraction, Client, GuildMember } from 'discord.js';
import { infoEmbed, errorEmbed, createEmbed } from '../../services/embed';
import { getState, formatDuration } from '../../services/music';

export const data = new SlashCommandBuilder()
  .setName('nowplaying')
  .setDescription('Voir la musique en cours de lecture');

export const module = 'music';

export async function execute(interaction: CommandInteraction, client: Client): Promise<void> {
  if (!interaction.guild) return;
  const state = getState(interaction.guild.id);

  if (!state.currentTrack) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Aucune musique en cours de lecture.')], ephemeral: true });
    return;
  }

  const embed = createEmbed('music')
    .setTitle('🎵 En cours de lecture')
    .setDescription(`**${state.currentTrack.title}**`)
    .addFields(
      { name: 'Auteur', value: state.currentTrack.author, inline: true },
      { name: 'Durée', value: state.currentTrack.duration > 0 ? formatDuration(state.currentTrack.duration) : 'Inconnue', inline: true },
      { name: 'Position dans la file', value: state.queue.length > 0 ? `${state.queue.length} musique(s) après` : 'Dernière musique', inline: true }
    );

  if (state.currentTrack.thumbnail) {
    embed.setThumbnail(state.currentTrack.thumbnail);
  }

  await interaction.reply({ embeds: [embed] });
}
