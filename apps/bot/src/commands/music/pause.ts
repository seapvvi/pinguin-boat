import { SlashCommandBuilder, CommandInteraction, Client, GuildMember } from 'discord.js';
import { errorEmbed, successEmbed } from '../../services/embed';
import { getState } from '../../services/music';

export const data = new SlashCommandBuilder()
  .setName('pause')
  .setDescription('Mettre en pause la musique actuelle');

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

  try { state.player.pause(); } catch {}

  await interaction.reply({ embeds: [successEmbed('Musique en pause', 'La musique a été mise en pause.')] });
}
