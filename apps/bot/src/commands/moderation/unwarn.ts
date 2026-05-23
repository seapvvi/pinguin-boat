import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits } from 'discord.js';
import { prisma } from '@pinguin/db';
import { errorEmbed, successEmbed } from '../../services/embed';
import { log } from '../../services/logger';

export const data = new SlashCommandBuilder()
  .setName('unwarn')
  .setDescription('Retirer un avertissement')
  .addStringOption((opt) => opt.setName('warn_id').setDescription('ID de l\'avertissement').setRequired(true))
  .addStringOption((opt) => opt.setName('reason').setDescription('Raison du retrait').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export const permissions = true;
export const module = 'moderation';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  const warnId = interaction.options.get('warn_id')?.value as string;
  const reason = interaction.options.get('reason')?.value as string;

  if (!interaction.guild) return;

  try {
    const warning = await prisma.warning.findUnique({ where: { id: warnId } });

    if (!warning || warning.guildId !== interaction.guild.id) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Avertissement introuvable.')] });
      return;
    }

    if (!warning.active) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Cet avertissement a déjà été retiré.')] });
      return;
    }

    await prisma.warning.update({
      where: { id: warnId },
      data: { active: false },
    });

    log({ level: 'info', message: `Unwarn: ${warnId} par ${interaction.user.tag}`, guildId: interaction.guild.id });

    await interaction.editReply({
      embeds: [successEmbed('Avertissement retiré', `L'avertissement **${warnId}** a été retiré.\nRaison : ${reason}`)],
    });
  } catch (error) {
    console.error(error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de retirer cet avertissement.')] });
  }
}
