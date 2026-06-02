import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits, TextChannel, ChannelType } from 'discord.js';
import { errorEmbed, successEmbed } from '../../services/embed';

export const data = new SlashCommandBuilder()
  .setName('unlock')
  .setDescription('Déverrouiller un salon')
  .addChannelOption((opt) =>
    opt.setName('channel').setDescription('Salon à déverrouiller').addChannelTypes(ChannelType.GuildText)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export const permissions = true;
export const module = 'moderation';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  const channel = (interaction.options.get('channel')?.channel as TextChannel) ?? interaction.channel;

  if (!channel || !interaction.guild) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Salon invalide.')] });
    return;
  }

  try {
    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
      SendMessages: null,
    }, { reason: `Salon déverrouillé par ${interaction.user.username}` });

    await interaction.editReply({ embeds: [successEmbed('Salon déverrouillé', `${channel} a été déverrouillé.`)] });
  } catch (error) {
    console.error(error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de déverrouiller le salon.')] });
  }
}
