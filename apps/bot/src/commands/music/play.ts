import { SlashCommandBuilder, ChatInputCommandInteraction, Client, GuildMember, TextChannel } from 'discord.js';
import { errorEmbed, successEmbed } from '../../services/embed';
import { play, formatDuration, requireDjRole, getMusicSettings, getState } from '../../services/music';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Jouer une musique ou ajouter à la file d\'attente')
  .addStringOption((opt) => opt.setName('query').setDescription('Titre ou URL de la musique').setRequired(true));

export const module = 'music';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  if (!interaction.guild) return;

  if (!(await requireDjRole(interaction))) return;

  const member = interaction.member as GuildMember;
  const voiceChannel = member.voice.channel;

  if (!voiceChannel) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Tu dois être dans un salon vocal.')], ephemeral: true });
    return;
  }

  const botMember = await interaction.guild.members.fetchMe().catch(() => null);
  if (!botMember || !voiceChannel.permissionsFor(botMember)?.has(['Connect', 'Speak'])) {
    await interaction.reply({ embeds: [errorEmbed('Permission refusée', 'Je n\'ai pas la permission de rejoindre ce salon vocal.')], ephemeral: true });
    return;
  }

  const settings = await getMusicSettings(interaction.guild.id);
  const state = getState(interaction.guild.id);
  if (state.queue.length >= settings.maxQueueLength) {
    await interaction.reply({ embeds: [errorEmbed('File pleine', `La file d'attente est limitée à **${settings.maxQueueLength}** musiques.`)], ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const query = interaction.options.get('query')?.value as string;

  try {
    const track = await play(interaction.guild.id, query, member, interaction.channel as TextChannel);
    if (track) {
      await interaction.editReply({
        embeds: [successEmbed('🎵 Ajouté', `**${track.title}** — ${formatDuration(track.duration)}`)]
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Une erreur inattendue est survenue.';
    await interaction.editReply({ embeds: [errorEmbed('Erreur', message)] });
  }
}
