import { SlashCommandBuilder, ChatInputCommandInteraction, Client, GuildMember } from 'discord.js';
import { errorEmbed, successEmbed } from '../../services/embed';
import { getState, saveQueueToDb } from '../../services/music';

export const data = new SlashCommandBuilder()
  .setName('volume')
  .setDescription('Régler le volume de la musique')
  .addIntegerOption((opt) =>
    opt.setName('level').setDescription('Niveau de volume (0-100)').setRequired(true).setMinValue(0).setMaxValue(100)
  );

export const module = 'music';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!member.voice.channel) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Vous devez être dans un salon vocal.')], ephemeral: true });
    return;
  }

  const level = interaction.options.get('level')?.value as number;

  if (!interaction.guild) return;
  const state = getState(interaction.guild.id);
  state.volume = level;

  if (state.player) {
    try { state.player.setVolume(level / 100); } catch {}
  }

  await saveQueueToDb(interaction.guild.id);

  await interaction.reply({ embeds: [successEmbed('Volume réglé', `Le volume a été réglé à **${level}%**.`)] });
}
