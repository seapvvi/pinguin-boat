import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits } from 'discord.js';
import { prisma } from '@pinguin/db';
import { errorEmbed, successEmbed, infoEmbed } from '../../services/embed';
import { log } from '../../services/logger';
import { ensureUser } from '../../services/user';
import { logger } from '@pinguin/shared';

export const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Expulser un utilisateur du serveur')
  .addUserOption((opt) => opt.setName('user').setDescription('Utilisateur à expulser').setRequired(true))
  .addStringOption((opt) => opt.setName('reason').setDescription('Raison de l\'expulsion').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers);

export const permissions = true;
export const module = 'moderation';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  try {
    await interaction.deferReply();
  } catch {
    return;
  }

  const user = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason', true);

  if (!interaction.guild) return;
  const member = interaction.guild.members.cache.get(user.id);

  if (!member) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Cet utilisateur n\'est pas sur le serveur.')] });
    return;
  }

  if (user.id === interaction.user.id) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Vous ne pouvez pas vous expulser vous-même.')] });
    return;
  }

  if (!member.kickable) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Je ne peux pas expulser cet utilisateur. Vérifiez la hiérarchie des rôles.')] });
    return;
  }

  try {
    await member.kick(`Expulsé par ${interaction.user.username}: ${reason}`);

    await ensureUser(user.id, user.username, user.avatar);
    await prisma.moderationCase.create({
      data: {
        guildId: interaction.guild.id,
        userId: user.id,
        moderatorId: interaction.user.id,
        type: 'KICK',
        reason,
        active: false,
      },
    });

    try {
      const dmEmbed = infoEmbed('Expulsion', `Vous avez été expulsé de **${interaction.guild.name}**.`)
        .addFields({ name: 'Raison', value: reason });
      await user.send({ embeds: [dmEmbed] });
    } catch {}

    log({ level: 'info', message: `Kick: ${user.username} par ${interaction.user.username}`, guildId: interaction.guild.id });

    await interaction.editReply({
      embeds: [successEmbed('Utilisateur expulsé', `**${user.username}** a été expulsé.\nRaison : ${reason}`)],
    });
  } catch (error) {
    logger.error('Erreur lors de l\'expulsion', { err: error instanceof Error ? error.message : String(error) });
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible d\'expulser cet utilisateur.')] });
  }
}
