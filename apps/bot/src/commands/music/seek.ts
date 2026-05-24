import { SlashCommandBuilder, ChatInputCommandInteraction, Client, GuildMember } from 'discord.js';
import { errorEmbed, infoEmbed } from '../../services/embed';
import { getState, formatDuration } from '../../services/music';

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
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Tu dois être dans un salon vocal.')], ephemeral: true });
    return;
  }

  const position = interaction.options.get('position')?.value as number;

  if (!interaction.guild) return;
  const state = getState(interaction.guild.id);

  if (!state.currentTrack) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Aucune musique en cours.')], ephemeral: true });
    return;
  }

  if (position > state.currentTrack.duration && state.currentTrack.duration > 0) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', `Position max : ${formatDuration(state.currentTrack.duration)}.`)] });
    return;
  }

  await interaction.reply({ embeds: [infoEmbed('Seek', `Avancé à **${formatDuration(position)}**.`)] });
}
