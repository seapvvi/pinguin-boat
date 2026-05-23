import { SlashCommandBuilder, ChatInputCommandInteraction, Client, GuildMember, VoiceChannel } from 'discord.js';
import { infoEmbed, errorEmbed, successEmbed, createEmbed } from '../../services/embed';
import { getState, formatDuration, LoopMode, saveQueueToDb } from '../../services/music';

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
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Vous devez être dans un salon vocal pour utiliser cette commande.')] });
    return;
  }

  if (!interaction.guild) return;

  const state = getState(interaction.guild.id);
  state.voiceChannelId = voiceChannel.id;
  state.textChannelId = interaction.channelId;

  const track: import('@pinguin/shared').TrackInfo = {
    title: query,
    url: query.startsWith('http') ? query : `ytsearch:${query}`,
    duration: 0,
    thumbnail: '',
    author: 'Inconnu',
    source: 'OTHER',
  };

  state.queue.push(track);
  await saveQueueToDb(interaction.guild.id);

  const embed = createEmbed('music')
    .setTitle('Ajouté à la file d\'attente')
    .setDescription(`**${track.title}** a été ajouté à la file d'attente.`)
    .addFields(
      { name: 'Position', value: `${state.queue.length}`, inline: true },
      { name: 'Durée', value: track.duration > 0 ? formatDuration(track.duration) : 'Inconnue', inline: true }
    );

  await interaction.editReply({ embeds: [embed] });
}
