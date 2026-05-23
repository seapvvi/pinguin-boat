import { SlashCommandBuilder, ChatInputCommandInteraction, Client, GuildMember } from 'discord.js';
import { errorEmbed, successEmbed } from '../../services/embed';
import { getState, saveQueueToDb, formatDuration } from '../../services/music';

export const data = new SlashCommandBuilder()
  .setName('seek')
  .setDescription('Avancer à une position spécifique dans la musique')
  .addIntegerOption((opt) =>
    opt.setName('position').setDescription('Position en secondes').setRequired(true).setMinValue(0)
  );

export const module = 'music';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!member.voice.channel) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Vous devez être dans un salon vocal.')], ephemeral: true });
    return;
  }

  const position = interaction.options.get('position')?.value as number;

  if (!interaction.guild) return;
  const state = getState(interaction.guild.id);

  if (!state.currentTrack) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Aucune musique en cours de lecture.')], ephemeral: true });
    return;
  }

  if (position > state.currentTrack.duration && state.currentTrack.duration > 0) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', `La position dépasse la durée de la musique (${formatDuration(state.currentTrack.duration)}).`)] });
    return;
  }

  if (state.player) {
    try { state.player.seek(position * 1000); } catch {}
  }

  await interaction.reply({ embeds: [successEmbed('Position changée', `Musique avancée à **${formatDuration(position)}**.`)] });
}
