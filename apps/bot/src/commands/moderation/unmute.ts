import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits } from 'discord.js';
import { prisma } from '@pinguin/db';
import { errorEmbed, successEmbed } from '../../services/embed';
import { log } from '../../services/logger';
import { ensureUser } from '../../services/user';

export const data = new SlashCommandBuilder()
  .setName('unmute')
  .setDescription('Retirer le mute d\'un utilisateur')
  .addUserOption((opt) => opt.setName('user').setDescription('Utilisateur à démuter').setRequired(true))
  .addStringOption((opt) => opt.setName('reason').setDescription('Raison du démute').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export const permissions = true;
export const module = 'moderation';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.get('user')?.user!;
  const reason = interaction.options.get('reason')?.value as string;

  if (!interaction.guild) return;
  const member = interaction.guild.members.cache.get(user.id);

  if (!member) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Cet utilisateur n\'est pas sur le serveur.')] });
    return;
  }

  if (!member.communicationDisabledUntil) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Cet utilisateur n\'est pas muet.')] });
    return;
  }

  try {
    await member.timeout(null, `Démuté par ${interaction.user.username}: ${reason}`);

    const activeCase = await prisma.moderationCase.findFirst({
      where: { guildId: interaction.guild.id, userId: user.id, type: 'MUTE', active: true },
    });

    if (activeCase) {
      await prisma.moderationCase.update({
        where: { id: activeCase.id },
        data: { active: false },
      });
    }

    await ensureUser(user.id, user.username, user.avatar);
    await prisma.moderationCase.create({
      data: {
        guildId: interaction.guild.id,
        userId: user.id,
        moderatorId: interaction.user.id,
        type: 'UNMUTE',
        reason,
        active: false,
      },
    });

    log({ level: 'info', message: `Unmute: ${user.username} par ${interaction.user.username}`, guildId: interaction.guild.id });

    await interaction.editReply({
      embeds: [successEmbed('Utilisateur démuté', `**${user.username}** a été démuté.\nRaison : ${reason}`)],
    });
  } catch (error) {
    console.error(error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de démuter cet utilisateur.')] });
  }
}
