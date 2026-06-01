import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits } from 'discord.js';
import { prisma } from '@pinguin/db';
import { errorEmbed, successEmbed, infoEmbed } from '../../services/embed';
import { log } from '../../services/logger';
import { ensureUser } from '../../services/user';
import { parseDuration, formatDuration } from '../../utils/parseDuration';

export const data = new SlashCommandBuilder()
  .setName('mute')
  .setDescription('Rendre muet un utilisateur (timeout)')
  .addUserOption((opt) => opt.setName('user').setDescription('Utilisateur à rendre muet').setRequired(true))
  .addStringOption((opt) =>
    opt.setName('duration')
      .setDescription('Durée du mute (ex: 1h30m, 2d, 1w, 30s)')
      .setRequired(true)
  )
  .addStringOption((opt) => opt.setName('reason').setDescription('Raison du mute').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export const permissions = true;
export const module = 'moderation';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.get('user')?.user!;
  const durationInput = interaction.options.get('duration')?.value as string;
  const reason = interaction.options.get('reason')?.value as string;

  if (!interaction.guild) return;
  const member = interaction.guild.members.cache.get(user.id);

  const parsedDuration = parseDuration(durationInput);
  if (!parsedDuration || parsedDuration.error) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', parsedDuration?.error ?? 'Format de durée invalide.')] });
    return;
  }

  if (!member) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Cet utilisateur n\'est pas sur le serveur.')] });
    return;
  }

  if (user.id === interaction.user.id) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Vous ne pouvez pas vous rendre muet vous-même.')] });
    return;
  }

  if (!member.moderatable) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Je ne peux pas rendre muet cet utilisateur. Vérifiez la hiérarchie des rôles.')] });
    return;
  }

  try {
    const expiresAt = new Date(Date.now() + parsedDuration.milliseconds);
    await member.timeout(parsedDuration.milliseconds, `Muté par ${interaction.user.tag}: ${reason}`);

    await ensureUser(user.id, user.username, user.avatar);
    await prisma.moderationCase.create({
      data: {
        guildId: interaction.guild.id,
        userId: user.id,
        moderatorId: interaction.user.id,
        type: 'MUTE',
        reason,
        duration: Math.floor(parsedDuration.milliseconds / 1000),
        expiresAt,
        active: true,
      },
    });

    try {
      const dmEmbed = infoEmbed('Mute', `Vous avez été rendu muet sur **${interaction.guild.name}**.`)
        .addFields(
          { name: 'Raison', value: reason },
          { name: 'Durée', value: formatDuration(parsedDuration.milliseconds) }
        );
      await user.send({ embeds: [dmEmbed] });
    } catch {}

    log({ level: 'info', message: `Mute: ${user.tag} par ${interaction.user.tag} (${durationInput})`, guildId: interaction.guild.id });

    await interaction.editReply({
      embeds: [successEmbed('Utilisateur rendu muet', `**${user.tag}** a été rendu muet pour **${formatDuration(parsedDuration.milliseconds)}**.\nRaison : ${reason}`)],
    });
  } catch (error) {
    console.error(error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de rendre muet cet utilisateur.')] });
  }
}
