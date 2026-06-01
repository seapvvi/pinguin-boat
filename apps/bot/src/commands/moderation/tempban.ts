import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits } from 'discord.js';
import { prisma } from '@pinguin/db';
import { errorEmbed, successEmbed, infoEmbed } from '../../services/embed';
import { log } from '../../services/logger';
import { ensureUser } from '../../services/user';
import { parseDuration, formatDuration } from '../../utils/parseDuration';

export const data = new SlashCommandBuilder()
  .setName('tempban')
  .setDescription('Bannir temporairement un utilisateur')
  .addUserOption((opt) => opt.setName('user').setDescription('Utilisateur à bannir').setRequired(true))
  .addStringOption((opt) =>
    opt.setName('duration')
      .setDescription('Durée (ex: 1h30m, 2d, 1w, 30s)')
      .setRequired(true)
  )
  .addStringOption((opt) => opt.setName('reason').setDescription('Raison du bannissement').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export const permissions = true;
export const module = 'moderation';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.get('user')?.user!;
  const durationInput = interaction.options.get('duration')?.value as string;
  const reason = interaction.options.get('reason')?.value as string;
  const member = interaction.guild?.members.cache.get(user.id);

  const parsedDuration = parseDuration(durationInput);
  if (!parsedDuration || parsedDuration.error) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', parsedDuration?.error ?? 'Format de durée invalide.')] });
    return;
  }

  const durationSeconds = Math.floor(parsedDuration.milliseconds / 1000);

  if (!interaction.guild) return;

  if (user.id === interaction.user.id) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Vous ne pouvez pas vous bannir vous-même.')] });
    return;
  }

  if (member && !member.bannable) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Je ne peux pas bannir cet utilisateur.')] });
    return;
  }

  const expiresAt = new Date(Date.now() + durationSeconds * 1000);

  try {
    await interaction.guild.members.ban(user.id, {
      reason: `Tempbanni par ${interaction.user.tag}: ${reason}`,
    });

    await ensureUser(user.id, user.username, user.avatar);
    await prisma.moderationCase.create({
      data: {
        guildId: interaction.guild.id,
        userId: user.id,
        moderatorId: interaction.user.id,
        type: 'TEMPBAN',
        reason,
        duration: durationSeconds,
        expiresAt,
        active: true,
      },
    });

    try {
      const dmEmbed = infoEmbed('Bannissement temporaire', `Vous avez été banni temporairement de **${interaction.guild.name}**.`)
        .addFields(
          { name: 'Raison', value: reason },
          { name: 'Durée', value: formatDuration(parsedDuration.milliseconds) }
        );
      await user.send({ embeds: [dmEmbed] });
    } catch {}

    log({ level: 'info', message: `Tempban: ${user.tag} par ${interaction.user.tag} (${durationInput})`, guildId: interaction.guild.id });

    await interaction.editReply({
      embeds: [successEmbed('Utilisateur banni temporairement', `**${user.tag}** a été banni pour **${formatDuration(parsedDuration.milliseconds)}**.\nRaison : ${reason}\nExpire le : ${expiresAt.toLocaleDateString('fr-FR')}`)],
    });
  } catch (error) {
    console.error(error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de bannir cet utilisateur.')] });
  }
}
