import { SlashCommandBuilder, CommandInteraction, Client, GuildMember } from 'discord.js';
import { errorEmbed, successEmbed } from '../../services/embed';
import { resume, getState } from '../../services/music';

export const data = new SlashCommandBuilder()
  .setName('resume')
  .setDescription('Reprendre la musique en pause');

export const module = 'music';

export async function execute(interaction: CommandInteraction, client: Client): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!member.voice.channel) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Tu dois être dans un salon vocal.')], ephemeral: true });
    return;
  }
  if (!interaction.guild) return;
  const state = getState(interaction.guild.id);
  if (!state.currentTrack) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Aucune musique en cours.')], ephemeral: true });
    return;
  }
  resume(interaction.guild.id);
  await interaction.reply({ embeds: [successEmbed('Reprise', 'Musique reprise.')] });
}
