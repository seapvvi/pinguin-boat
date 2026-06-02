import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits } from 'discord.js';
import { prisma } from '@pinguin/db';
import { errorEmbed, successEmbed } from '../../services/embed';
import { log } from '../../services/logger';
import { logger } from '@pinguin/shared';
import { ensureUser } from '../../services/user';

export const data = new SlashCommandBuilder()
  .setName('unban')
  .setDescription('Débannir un utilisateur')
  .addStringOption((opt) => opt.setName('user_id').setDescription('ID de l\'utilisateur à débannir').setRequired(true))
  .addStringOption((opt) => opt.setName('reason').setDescription('Raison du débannissement').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export const permissions = true;
export const module = 'moderation';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  const userId = interaction.options.get('user_id')?.value as string;
  const reason = interaction.options.get('reason')?.value as string;

  if (!interaction.guild) return;

  try {
    const ban = await interaction.guild.bans.fetch(userId).catch(() => null);
    if (!ban) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Cet utilisateur n\'est pas banni.')] });
      return;
    }

    await interaction.guild.members.unban(userId, `Débanni par ${interaction.user.username}: ${reason}`);

    const activeCase = await prisma.moderationCase.findFirst({
      where: { guildId: interaction.guild.id, userId, type: { in: ['BAN', 'TEMPBAN'] }, active: true },
    });

    if (activeCase) {
      await prisma.moderationCase.update({
        where: { id: activeCase.id },
        data: { active: false },
      });
    }

    await ensureUser(userId);
    await prisma.moderationCase.create({
      data: {
        guildId: interaction.guild.id,
        userId,
        moderatorId: interaction.user.id,
        type: 'UNBAN',
        reason,
        active: false,
      },
    });

    log({ level: 'info', message: `Unban: ${userId} par ${interaction.user.username}`, guildId: interaction.guild.id });

    await interaction.editReply({
      embeds: [successEmbed('Utilisateur débanni', `<@${userId}> a été débanni.\nRaison : ${reason}`)],
    });
  } catch (error) {
    logger.error('Erreur lors du débannissement', { err: error instanceof Error ? error.message : String(error) });
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de débannir cet utilisateur.')] });
  }
}
