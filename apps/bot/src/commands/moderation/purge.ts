import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits, TextChannel } from 'discord.js';
import { errorEmbed, successEmbed } from '../../services/embed';
import { log } from '../../services/logger';

export const data = new SlashCommandBuilder()
  .setName('purge')
  .setDescription('Supprimer des messages en masse')
  .addIntegerOption((opt) =>
    opt.setName('amount').setDescription('Nombre de messages à supprimer (1-100)').setRequired(true).setMinValue(1).setMaxValue(100)
  )
  .addUserOption((opt) => opt.setName('user').setDescription('Ne supprimer que les messages d\'un utilisateur'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export const permissions = true;
export const module = 'moderation';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const amount = interaction.options.get('amount')?.value as number;
  const targetUser = interaction.options.get('user')?.user;
  const channel = interaction.channel;

  if (!channel || !channel.isTextBased() || !interaction.guild) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Cette commande doit être utilisée dans un salon textuel.')] });
    return;
  }

  try {
    if (targetUser) {
      const messages = await channel.messages.fetch({ limit: Math.min(amount * 2, 200) });
      const filtered = messages.filter((m) => m.author.id === targetUser.id).first(amount);
      if (filtered.length === 0) {
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Aucun message trouvé de cet utilisateur.')] });
        return;
      }
      await (channel as TextChannel).bulkDelete(filtered, true);
      log({ level: 'info', message: `Purge: ${filtered.length} messages de ${targetUser.tag} dans #${(channel as TextChannel).name}`, guildId: interaction.guild.id });
      await interaction.editReply({ embeds: [successEmbed('Messages supprimés', `${filtered.length} messages de ${targetUser.tag} ont été supprimés.`)] });
    } else {
      await (channel as TextChannel).bulkDelete(amount, true);
      log({ level: 'info', message: `Purge: ${amount} messages dans #${(channel as TextChannel).name}`, guildId: interaction.guild.id });
      await interaction.editReply({ embeds: [successEmbed('Messages supprimés', `${amount} messages ont été supprimés.`)] });
    }
  } catch (error: any) {
    if (error.code === 50034) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de supprimer des messages de plus de 14 jours.')] });
    } else {
      console.error(error);
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de supprimer les messages.')] });
    }
  }
}
