import { SlashCommandBuilder, CommandInteraction, Client, GuildMember } from 'discord.js';
import { errorEmbed, successEmbed } from '../../services/embed';
import { destroyState } from '../../services/music';

export const data = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('Arrêter la musique et vider la file d\'attente');

export const module = 'music';

export async function execute(interaction: CommandInteraction, client: Client): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!member.voice.channel) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Vous devez être dans un salon vocal.')], ephemeral: true });
    return;
  }

  if (!interaction.guild) return;

  destroyState(interaction.guild.id);

  await interaction.reply({ embeds: [successEmbed('Musique arrêtée', 'La musique a été arrêtée et la file d\'attente vidée.')] });
}
