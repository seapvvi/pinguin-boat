import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits, TextChannel, ChannelType } from 'discord.js';
import { errorEmbed, successEmbed } from '../../services/embed';
import { logger } from '@pinguin/shared';

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
    logger.error('Erreur lors du déverrouillage du salon', { err: error instanceof Error ? error.message : String(error) });
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de déverrouiller le salon.')] });
  }
}
