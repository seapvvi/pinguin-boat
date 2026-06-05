import { SlashCommandBuilder, CommandInteraction, Client, GuildMember } from 'discord.js';
import { errorEmbed, successEmbed } from '../../services/embed';
import { stop, getState, requireDjRole } from '../../services/music';

export const data = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('Arrêter la musique et vider la file d\'attente');

export const module = 'music';

export async function execute(interaction: CommandInteraction, client: Client): Promise<void> {
  if (!interaction.guild) return;
  if (!(await requireDjRole(interaction))) return;

  const member = interaction.member as GuildMember;
  if (!member.voice.channel) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Tu dois être dans un salon vocal.')], ephemeral: true });
    return;
  }
  const state = getState(interaction.guild.id);
  if (!state.currentTrack && state.queue.length === 0) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Aucune lecture en cours.')], ephemeral: true });
    return;
  }
  await stop(interaction.guild.id);
  await interaction.reply({ embeds: [successEmbed('Arrêté', 'Musique arrêtée et file vidée.')] });
}
