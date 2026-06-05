import { SlashCommandBuilder, ChatInputCommandInteraction, Client, GuildMember } from 'discord.js';
import { errorEmbed, successEmbed } from '../../services/embed';
import { getState, saveQueueToDb, requireDjRole } from '../../services/music';

export const data = new SlashCommandBuilder()
  .setName('remove')
  .setDescription('Retirer une musique de la file d\'attente')
  .addIntegerOption((opt) =>
    opt.setName('position').setDescription('Position de la musique à retirer').setRequired(true).setMinValue(1)
  );

export const module = 'music';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  if (!interaction.guild) return;
  if (!(await requireDjRole(interaction))) return;

  const member = interaction.member as GuildMember;
  if (!member.voice.channel) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Vous devez être dans un salon vocal.')], ephemeral: true });
    return;
  }

  const position = interaction.options.get('position')?.value as number;

  const state = getState(interaction.guild.id);

  if (position < 1 || position > state.queue.length) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', `Position invalide. La file contient **${state.queue.length}** musique(s).`)] });
    return;
  }

  const removed = state.queue.splice(position - 1, 1)[0];
  await saveQueueToDb(interaction.guild.id);

  await interaction.reply({ embeds: [successEmbed('Musique retirée', `**${removed.title}** a été retirée de la file d'attente.`)] });
}
