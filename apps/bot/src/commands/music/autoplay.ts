import { SlashCommandBuilder, CommandInteraction, Client, GuildMember } from 'discord.js';
import { errorEmbed, successEmbed, infoEmbed } from '../../services/embed';
import { getState, saveQueueToDb, requireDjRole } from '../../services/music';

export const data = new SlashCommandBuilder()
  .setName('autoplay')
  .setDescription('Activer ou désactiver la lecture automatique de musiques similaires');

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
  state.autoplay = !state.autoplay;

  await saveQueueToDb(interaction.guild.id);

  await interaction.reply({
    embeds: [state.autoplay
      ? successEmbed('Autoplay activé', 'La lecture automatique de musiques similaires est maintenant activée.')
      : infoEmbed('Autoplay désactivé', 'La lecture automatique de musiques similaires est maintenant désactivée.')],
  });
}
