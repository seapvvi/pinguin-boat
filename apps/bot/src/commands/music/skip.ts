import { SlashCommandBuilder, CommandInteraction, Client, GuildMember } from 'discord.js';
import { errorEmbed, successEmbed } from '../../services/embed';
import { skip, getState } from '../../services/music';

export const data = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Passer la musique actuelle');

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
  const skipped = await skip(interaction.guild.id);
  await interaction.reply({ embeds: [successEmbed('Passée', skipped ? `**${skipped.title}** passée.` : 'Musique passée.')] });
}
