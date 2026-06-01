import { ContextMenuCommandBuilder, UserContextMenuCommandInteraction, Client, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { prisma } from '@pinguin/db';
import { errorEmbed, successEmbed, infoEmbed } from '../../services/embed';
import { log } from '../../services/logger';
import { ensureUser } from '../../services/user';

export const data = new ContextMenuCommandBuilder()
  .setName('👢 Kick')
  .setType(2) // User Context Menu
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers);

export const permissions = true;
export const module = 'moderation';

export async function execute(interaction: UserContextMenuCommandInteraction, client: Client): Promise<void> {
  const targetUser = interaction.targetUser;

  if (!interaction.guild) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Utilisable uniquement sur un serveur.')], ephemeral: true });
    return;
  }

  if (targetUser.id === interaction.user.id) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Vous ne pouvez pas vous expulser vous-même.')], ephemeral: true });
    return;
  }

  const member = interaction.guild.members.cache.get(targetUser.id);
  if (!member) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Cet utilisateur n\'est pas sur le serveur.')], ephemeral: true });
    return;
  }

  if (!member.kickable) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Je ne peux pas expulser cet utilisateur. Vérifiez la hiérarchie des rôles.')], ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`kick_modal_${targetUser.id}`)
    .setTitle(`Expulser ${targetUser.username}`);

  const reasonInput = new TextInputBuilder()
    .setCustomId('kick_reason')
    .setLabel('Raison de l\'expulsion')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Expliquez la raison de cette expulsion...')
    .setRequired(true)
    .setMaxLength(500);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
  modal.addComponents(actionRow);

  await interaction.showModal(modal);
}

export async function handleModalSubmit(interaction: any, client: Client): Promise<void> {
  if (!interaction.guild) return;

  const targetUserId = interaction.customId.replace('kick_modal_', '');
  const reason = interaction.fields.getTextInputValue('kick_reason');

  if (!reason || reason.trim().length === 0) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'La raison est requise.')], ephemeral: true });
    return;
  }

  try {
    const member = await interaction.guild.members.fetch(targetUserId).catch(() => null);
    if (!member) {
      await interaction.reply({ embeds: [errorEmbed('Erreur', 'Utilisateur introuvable sur le serveur.')], ephemeral: true });
      return;
    }

    if (!member.kickable) {
      await interaction.reply({ embeds: [errorEmbed('Erreur', 'Je ne peux pas expulser cet utilisateur. Vérifiez la hiérarchie des rôles.')], ephemeral: true });
      return;
    }

    await member.kick(`Expulsé par ${interaction.user.tag}: ${reason}`);

    await ensureUser(member.user.id, member.user.username, member.user.avatar);
    await prisma.moderationCase.create({
      data: {
        guildId: interaction.guild.id,
        userId: member.user.id,
        moderatorId: interaction.user.id,
        type: 'KICK',
        reason: reason.trim(),
        active: false,
      },
    });

    try {
      const dmEmbed = infoEmbed('Expulsion', `Vous avez été expulsé de **${interaction.guild.name}**.`)
        .addFields({ name: 'Raison', value: reason });
      await member.user.send({ embeds: [dmEmbed] });
    } catch {}

    log({ level: 'info', message: `Kick: ${member.user.tag} par ${interaction.user.tag}`, guildId: interaction.guild.id });

    await interaction.reply({
      embeds: [successEmbed('Utilisateur expulsé', `**${member.user.tag}** a été expulsé.\nRaison : ${reason}`)],
      ephemeral: true,
    });
  } catch (error) {
    console.error(error);
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Impossible d\'expulser cet utilisateur.')], ephemeral: true });
  }
}
