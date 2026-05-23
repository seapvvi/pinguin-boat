import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits, TextChannel, ChannelType } from 'discord.js';
import { errorEmbed, successEmbed } from '../../services/embed';

export const data = new SlashCommandBuilder()
  .setName('slowmode')
  .setDescription('Définir le mode lent d\'un salon')
  .addIntegerOption((opt) =>
    opt.setName('seconds').setDescription('Temps en secondes entre chaque message (0 pour désactiver)').setRequired(true).setMinValue(0).setMaxValue(21600)
  )
  .addChannelOption((opt) =>
    opt.setName('channel').setDescription('Salon cible').addChannelTypes(ChannelType.GuildText)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export const permissions = true;
export const module = 'moderation';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  const seconds = interaction.options.get('seconds')?.value as number;
  const channel = (interaction.options.get('channel')?.channel as TextChannel) ?? interaction.channel;

  if (!channel || !interaction.guild) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Salon invalide.')] });
    return;
  }

  try {
    await channel.setRateLimitPerUser(seconds, `Mode lent défini par ${interaction.user.tag}`);

    if (seconds === 0) {
      await interaction.editReply({ embeds: [successEmbed('Mode lent désactivé', `Le mode lent a été désactivé dans ${channel}.`)] });
    } else {
      await interaction.editReply({ embeds: [successEmbed('Mode lent défini', `Le mode lent est maintenant de **${seconds} seconde${seconds > 1 ? 's' : ''}** dans ${channel}.`)] });
    }
  } catch (error) {
    console.error(error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de définir le mode lent.')] });
  }
}
