import { SlashCommandBuilder, CommandInteraction, Client, GuildMember } from 'discord.js';
import { errorEmbed, successEmbed } from '../../services/embed';
import { getState } from '../../services/music';

export const data = new SlashCommandBuilder()
  .setName('resume')
  .setDescription('Reprendre la musique en pause');

export const module = 'music';

export async function execute(interaction: CommandInteraction, client: Client): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!member.voice.channel) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Vous devez être dans un salon vocal.')], ephemeral: true });
    return;
  }

  if (!interaction.guild) return;
  const state = getState(interaction.guild.id);

  if (!state.player) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Aucune musique en cours de lecture.')], ephemeral: true });
    return;
  }

  try { state.player.unpause(); } catch {}

  await interaction.reply({ embeds: [successEmbed('Musique reprise', 'La musique a été reprise.')] });
}
