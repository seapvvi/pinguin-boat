import { SlashCommandBuilder, ChatInputCommandInteraction, Client, GuildMember } from 'discord.js';
import { errorEmbed, successEmbed } from '../../services/embed';
import { setVolume, saveQueueToDb, requireDjRole } from '../../services/music';

export const data = new SlashCommandBuilder()
  .setName('volume')
  .setDescription('Régler le volume de la musique')
  .addIntegerOption((opt) =>
    opt.setName('level').setDescription('Niveau de volume (0-100)').setRequired(true).setMinValue(0).setMaxValue(100)
  );

export const module = 'music';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  if (!interaction.guild) return;
  if (!(await requireDjRole(interaction))) return;

  const member = interaction.member as GuildMember;
  if (!member.voice.channel) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Tu dois être dans un salon vocal.')], ephemeral: true });
    return;
  }

  const level = interaction.options.get('level')?.value as number;

  setVolume(interaction.guild.id, level);
  await saveQueueToDb(interaction.guild.id);

  await interaction.reply({ embeds: [successEmbed('Volume réglé', `Volume à **${level}%**.`)] });
}
