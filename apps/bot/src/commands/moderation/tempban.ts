import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits } from 'discord.js';
import { prisma } from '@pinguin/db';
import { errorEmbed, successEmbed, infoEmbed } from '../../services/embed';
import { log } from '../../services/logger';
import { ensureUser } from '../../services/user';

const durationMap: Record<string, number> = {
  '60s': 60,
  '5m': 300,
  '10m': 600,
  '30m': 1800,
  '1h': 3600,
  '6h': 21600,
  '12h': 43200,
  '1d': 86400,
  '3d': 259200,
  '7d': 604800,
  '14d': 1209600,
  '30d': 2592000,
};

export const data = new SlashCommandBuilder()
  .setName('tempban')
  .setDescription('Bannir temporairement un utilisateur')
  .addUserOption((opt) => opt.setName('user').setDescription('Utilisateur à bannir').setRequired(true))
  .addStringOption((opt) =>
    opt.setName('duration')
      .setDescription('Durée (60s, 5m, 10m, 30m, 1h, 6h, 12h, 1d, 3d, 7d, 14d, 30d)')
      .setRequired(true)
      .addChoices(
        { name: '60 secondes', value: '60s' },
        { name: '5 minutes', value: '5m' },
        { name: '10 minutes', value: '10m' },
        { name: '30 minutes', value: '30m' },
        { name: '1 heure', value: '1h' },
        { name: '6 heures', value: '6h' },
        { name: '12 heures', value: '12h' },
        { name: '1 jour', value: '1d' },
        { name: '3 jours', value: '3d' },
        { name: '7 jours', value: '7d' },
        { name: '14 jours', value: '14d' },
        { name: '30 jours', value: '30d' }
      )
  )
  .addStringOption((opt) => opt.setName('reason').setDescription('Raison du bannissement').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers);

export const permissions = true;
export const module = 'moderation';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.get('user')?.user!;
  const durationKey = interaction.options.get('duration')?.value as string;
  const reason = interaction.options.get('reason')?.value as string;
  const durationSeconds = durationMap[durationKey] ?? 86400;
  const member = interaction.guild?.members.cache.get(user.id);

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
          { name: 'Durée', value: durationKey }
        );
      await user.send({ embeds: [dmEmbed] });
    } catch {}

    log({ level: 'info', message: `Tempban: ${user.tag} par ${interaction.user.tag} (${durationKey})`, guildId: interaction.guild.id });

    await interaction.editReply({
      embeds: [successEmbed('Utilisateur banni temporairement', `**${user.tag}** a été banni pour **${durationKey}**.\nRaison : ${reason}\nExpire le : ${expiresAt.toLocaleDateString('fr-FR')}`)],
    });
  } catch (error) {
    console.error(error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de bannir cet utilisateur.')] });
  }
}
