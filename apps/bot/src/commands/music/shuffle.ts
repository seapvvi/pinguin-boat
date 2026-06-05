import { SlashCommandBuilder, CommandInteraction, Client, GuildMember } from 'discord.js';
import { errorEmbed, successEmbed } from '../../services/embed';
import { toggleShuffle, getState, saveQueueToDb, requireDjRole } from '../../services/music';

export const data = new SlashCommandBuilder()
  .setName('shuffle')
  .setDescription('Mélanger la file d\'attente');

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

  if (state.queue.length < 2) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Pas assez de musiques dans la file pour mélanger.')], ephemeral: true });
    return;
  }

  toggleShuffle(interaction.guild.id);
  await saveQueueToDb(interaction.guild.id);

  await interaction.reply({ embeds: [successEmbed('File mélangée', `La file d'attente de **${state.queue.length}** musiques a été mélangée.`)] });
}
