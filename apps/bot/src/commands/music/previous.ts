import { SlashCommandBuilder, CommandInteraction, Client, GuildMember } from 'discord.js';
import { errorEmbed, successEmbed } from '../../services/embed';
import { getState, requireDjRole } from '../../services/music';

export const data = new SlashCommandBuilder()
  .setName('previous')
  .setDescription('Revenir à la musique précédente');

export const module = 'music';

export async function execute(interaction: CommandInteraction, client: Client): Promise<void> {
  if (!interaction.guild) return;
  if (!(await requireDjRole(interaction))) return;

  const member = interaction.member as GuildMember;
  if (!member.voice.channel) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Vous devez être dans un salon vocal.')], ephemeral: true });
    return;
  }

  const state = getState(interaction.guild.id);

  if (!state.currentTrack) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Aucune musique en cours de lecture.')], ephemeral: true });
    return;
  }

  if (state.queue.length === 0) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Aucune musique précédente.')], ephemeral: true });
    return;
  }

  const previousTrack = state.currentTrack;
  state.currentTrack = state.queue.shift() || null;
  state.queue.unshift(previousTrack);

  if (state.player) {
    try { state.player.stop(); } catch {}
  }

  await interaction.reply({ embeds: [successEmbed('Musique précédente', 'Retour à la musique précédente.')] });
}
