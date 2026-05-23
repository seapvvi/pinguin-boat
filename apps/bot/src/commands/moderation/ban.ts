import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits } from 'discord.js';
import { prisma } from '@pinguin/db';
import { errorEmbed, successEmbed, infoEmbed } from '../../services/embed';
import { log } from '../../services/logger';
import { ensureUser } from '../../services/user';

export const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Bannir un utilisateur du serveur')
  .addUserOption((opt) => opt.setName('user').setDescription('Utilisateur à bannir').setRequired(true))
  .addStringOption((opt) => opt.setName('reason').setDescription('Raison du bannissement').setRequired(true))
  .addIntegerOption((opt) =>
    opt.setName('delete_messages').setDescription('Supprimer les messages (jours)').setMinValue(0).setMaxValue(7)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export const permissions = true;
export const requireAdmin = false;
export const module = 'moderation';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.get('user')?.user!;
  const reason = interaction.options.get('reason')?.value as string;
  const deleteDays = (interaction.options.get('delete_messages')?.value as number) ?? 0;
  const member = interaction.guild?.members.cache.get(user.id);

  if (!interaction.guild) return;

  if (user.id === interaction.user.id) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Vous ne pouvez pas vous bannir vous-même.')] });
    return;
  }

  if (member) {
    if (!member.bannable) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Je ne peux pas bannir cet utilisateur. Vérifiez la hiérarchie des rôles.')] });
      return;
    }

    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Vous ne pouvez pas bannir un administrateur.')] });
      return;
    }
  }

  try {
    await interaction.guild.members.ban(user.id, {
      reason: `Banni par ${interaction.user.tag}: ${reason}`,
      deleteMessageSeconds: deleteDays * 86400,
    });

    await ensureUser(user.id, user.username, user.avatar);
    await prisma.moderationCase.create({
      data: {
        guildId: interaction.guild.id,
        userId: user.id,
        moderatorId: interaction.user.id,
        type: 'BAN',
        reason,
        active: true,
      },
    });

    try {
      const dmEmbed = infoEmbed('Bannissement', `Vous avez été banni de **${interaction.guild.name}**.`)
        .addFields({ name: 'Raison', value: reason });
      await user.send({ embeds: [dmEmbed] });
    } catch {}

    log({ level: 'info', message: `Ban: ${user.tag} par ${interaction.user.tag}`, guildId: interaction.guild.id });

    await interaction.editReply({
      embeds: [successEmbed('Utilisateur banni', `**${user.tag}** a été banni.\nRaison : ${reason}`)],
    });
  } catch (error) {
    console.error(error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de bannir cet utilisateur.')] });
  }
}
