import { SlashCommandBuilder, CommandInteraction, Client, GuildMember } from 'discord.js';
import { errorEmbed, successEmbed } from '../../services/embed';
import { getState, saveQueueToDb } from '../../services/music';

export const data = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Passer la musique actuelle');

export const module = 'music';

export async function execute(interaction: CommandInteraction, client: Client): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!member.voice.channel) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Vous devez être dans un salon vocal.')], ephemeral: true });
    return;
  }

  if (!interaction.guild) return;
  const state = getState(interaction.guild.id);

  if (!state.currentTrack) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Aucune musique en cours de lecture.')], ephemeral: true });
    return;
  }

  if (state.player) {
    try { state.player.stop(); } catch {}
  }

  state.currentTrack = state.queue.shift() || null;
  state.position = 0;
  if (!state.currentTrack) {
    state.currentTrack = null;
  }
  await saveQueueToDb(interaction.guild.id);

  await interaction.reply({ embeds: [successEmbed('Musique passée', 'La musique a été passée.')] });
}
