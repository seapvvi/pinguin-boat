import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits, TextChannel, ChannelType, OverwriteType } from 'discord.js';
import { errorEmbed, successEmbed } from '../../services/embed';
import { logger } from '@pinguin/shared';

export const data = new SlashCommandBuilder()
  .setName('lock')
  .setDescription('Verrouiller un salon (empêcher @everyone d\'envoyer des messages)')
  .addChannelOption((opt) =>
    opt.setName('channel').setDescription('Salon à verrouiller').addChannelTypes(ChannelType.GuildText)
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
      SendMessages: false,
    }, { reason: `Salon verrouillé par ${interaction.user.username}` });

    await interaction.editReply({ embeds: [successEmbed('Salon verrouillé', `${channel} a été verrouillé. Seuls les membres avec des permissions spécifiques peuvent y parler.`)] });
  } catch (error) {
    logger.error('Erreur lors du verrouillage du salon', { err: error instanceof Error ? error.message : String(error) });
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de verrouiller le salon.')] });
  }
}
