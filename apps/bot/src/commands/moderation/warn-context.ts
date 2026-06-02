import { ContextMenuCommandBuilder, UserContextMenuCommandInteraction, Client, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { prisma } from '@pinguin/db';
import { errorEmbed, successEmbed } from '../../services/embed';
import { log } from '../../services/logger';
import { ensureUser } from '../../services/user';
import { logger } from '@pinguin/shared';

export const data = new ContextMenuCommandBuilder()
  .setName('⚠️ Avertir')
  .setType(2) // User Context Menu
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export const permissions = true;
export const module = 'moderation';

export async function execute(interaction: UserContextMenuCommandInteraction, client: Client): Promise<void> {
  const targetUser = interaction.targetUser;

  if (!interaction.guild) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Utilisable uniquement sur un serveur.')], ephemeral: true });
    return;
  }

  if (targetUser.id === interaction.user.id) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Vous ne pouvez pas vous avertir vous-même.')], ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`warn_modal_${targetUser.id}`)
    .setTitle(`Avertir ${targetUser.username}`);

  const reasonInput = new TextInputBuilder()
    .setCustomId('warn_reason')
    .setLabel('Raison de l\'avertissement')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Expliquez la raison de cet avertissement...')
    .setRequired(true)
    .setMaxLength(500);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
  modal.addComponents(actionRow);

  await interaction.showModal(modal);
}

export async function handleModalSubmit(interaction: any, client: Client): Promise<void> {
  if (!interaction.guild) return;

  const targetUserId = interaction.customId.replace('warn_modal_', '');
  const reason = interaction.fields.getTextInputValue('warn_reason');

  if (!reason || reason.trim().length === 0) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'La raison est requise.')], ephemeral: true });
    return;
  }

  try {
    const targetUser = await interaction.guild.members.fetch(targetUserId).catch(() => null);
    if (!targetUser) {
      await interaction.reply({ embeds: [errorEmbed('Erreur', 'Utilisateur introuvable sur le serveur.')], ephemeral: true });
      return;
    }

    const warning = await prisma.warning.create({
      data: {
        guildId: interaction.guild.id,
        userId: targetUserId,
        moderatorId: interaction.user.id,
        reason: reason.trim(),
      },
    });

    await ensureUser(targetUserId, targetUser.user.username, targetUser.user.avatar);
    await prisma.moderationCase.create({
      data: {
        guildId: interaction.guild.id,
        userId: targetUserId,
        moderatorId: interaction.user.id,
        type: 'WARN',
        reason: reason.trim(),
        active: true,
      },
    });

    try {
      await targetUser.user.send({
        embeds: [successEmbed('Avertissement', `Vous avez reçu un avertissement sur **${interaction.guild.name}**.\nRaison : ${reason}`)],
      });
    } catch {}

    log({ level: 'info', message: `Warn: ${targetUser.user.username} par ${interaction.user.username}`, guildId: interaction.guild.id });

    await interaction.reply({
      embeds: [successEmbed('Utilisateur averti', `**${targetUser.user.username}** a été averti.\nRaison : ${reason}\nID de l'avertissement : ${warning.id}`)],
      ephemeral: true,
    });
  } catch (error) {
    logger.error('Erreur lors de l\'avertissement', { err: error instanceof Error ? error.message : String(error) });
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Impossible d\'avertir cet utilisateur.')], ephemeral: true });
  }
}
