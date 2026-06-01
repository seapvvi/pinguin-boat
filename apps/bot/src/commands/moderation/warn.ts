import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits } from 'discord.js';
import { prisma } from '@pinguin/db';
import { errorEmbed, successEmbed, infoEmbed } from '../../services/embed';
import { log } from '../../services/logger';
import { ensureUser } from '../../services/user';
import { checkWarnEscalation } from '../../services/moderation-escalation';

export const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Avertir un utilisateur')
  .addUserOption((opt) => opt.setName('user').setDescription('Utilisateur à avertir').setRequired(true))
  .addStringOption((opt) => opt.setName('reason').setDescription('Raison de l\'avertissement').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export const permissions = true;
export const module = 'moderation';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.get('user')?.user!;
  const reason = interaction.options.get('reason')?.value as string;

  if (!interaction.guild) return;

  if (user.id === interaction.user.id) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Vous ne pouvez pas vous avertir vous-même.')] });
    return;
  }

  try {
    const warning = await prisma.warning.create({
      data: {
        guildId: interaction.guild.id,
        userId: user.id,
        moderatorId: interaction.user.id,
        reason,
      },
    });

    await ensureUser(user.id, user.username, user.avatar);
    await prisma.moderationCase.create({
      data: {
        guildId: interaction.guild.id,
        userId: user.id,
        moderatorId: interaction.user.id,
        type: 'WARN',
        reason,
        active: true,
      },
    });

    try {
      await user.send({
        embeds: [successEmbed('Avertissement', `Vous avez reçu un avertissement sur **${interaction.guild.name}**.\nRaison : ${reason}`)],
      });
    } catch {}

    log({ level: 'info', message: `Warn: ${user.tag} par ${interaction.user.tag}`, guildId: interaction.guild.id });

    const escalationResult = await checkWarnEscalation(interaction.guild, user, interaction.user.id);

    let replyEmbed = successEmbed('Utilisateur averti', `**${user.tag}** a été averti.\nRaison : ${reason}\nID de l'avertissement : ${warning.id}`);

    if (escalationResult.escalated) {
      replyEmbed = infoEmbed('Avertissement + Escalade automatique', `**${user.tag}** a été averti et une sanction automatique a été appliquée.`)
        .addFields(
          { name: 'Raison du warn', value: reason },
          { name: 'Sanction appliquée', value: escalationResult.action === 'MUTE' ? '🔇 Mute' : '🔨 Ban' },
          { name: 'Détails', value: escalationResult.reason }
        );
    }

    await interaction.editReply({ embeds: [replyEmbed] });
  } catch (error) {
    console.error(error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible d\'avertir cet utilisateur.')] });
  }
}
