import { SlashCommandBuilder, ChatInputCommandInteraction, Client, GuildMember, TextChannel } from 'discord.js';
import { errorEmbed, successEmbed } from '../../services/embed';
import { play, formatDuration } from '../../services/music';

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Jouer une musique ou ajouter à la file d\'attente')
  .addStringOption((opt) => opt.setName('query').setDescription('Titre ou URL de la musique').setRequired(true));

export const module = 'music';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  const query = interaction.options.get('query')?.value as string;
  const member = interaction.member as GuildMember;
  const voiceChannel = member.voice.channel;

  if (!voiceChannel) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Tu dois être dans un salon vocal.')] });
    return;
  }

  if (!interaction.guild) return;
  const botMember = interaction.guild.members.me!;
  if (!voiceChannel.permissionsFor(botMember)?.has(['Connect', 'Speak'])) {
    await interaction.editReply({ embeds: [errorEmbed('Permission refusée', 'Je n\'ai pas la permission de rejoindre ce salon vocal.')] });
    return;
  }

  try {
    const track = await play(interaction.guild.id, query, member, interaction.channel as TextChannel);
    if (track) {
      await interaction.editReply({
        embeds: [successEmbed('🎵 Ajouté', `**${track.title}** — ${formatDuration(track.duration)}`)]
      });
    }
  } catch (err: any) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', err.message)] });
  }
}
