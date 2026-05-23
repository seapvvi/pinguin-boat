import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits } from 'discord.js';
import { prisma } from '@pinguin/db';
import { errorEmbed, successEmbed, infoEmbed } from '../../services/embed';
import { log } from '../../services/logger';
import { ensureUser } from '../../services/user';

const durationMap: Record<string, { seconds: number; label: string }> = {
  '60s': { seconds: 60, label: '60 secondes' },
  '5m': { seconds: 300, label: '5 minutes' },
  '10m': { seconds: 600, label: '10 minutes' },
  '30m': { seconds: 1800, label: '30 minutes' },
  '1h': { seconds: 3600, label: '1 heure' },
  '6h': { seconds: 21600, label: '6 heures' },
  '12h': { seconds: 43200, label: '12 heures' },
  '1d': { seconds: 86400, label: '1 jour' },
  '3d': { seconds: 259200, label: '3 jours' },
  '7d': { seconds: 604800, label: '7 jours' },
  '14d': { seconds: 1209600, label: '14 jours' },
  '28d': { seconds: 2419200, label: '28 jours' },
};

export const data = new SlashCommandBuilder()
  .setName('mute')
  .setDescription('Rendre muet un utilisateur (timeout)')
  .addUserOption((opt) => opt.setName('user').setDescription('Utilisateur à rendre muet').setRequired(true))
  .addStringOption((opt) =>
    opt.setName('duration')
      .setDescription('Durée du mute')
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
        { name: '28 jours', value: '28d' }
      )
  )
  .addStringOption((opt) => opt.setName('reason').setDescription('Raison du mute').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export const permissions = true;
export const module = 'moderation';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  const user = interaction.options.get('user')?.user!;
  const durationKey = interaction.options.get('duration')?.value as string;
  const reason = interaction.options.get('reason')?.value as string;

  if (!interaction.guild) return;
  const member = interaction.guild.members.cache.get(user.id);

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

  const duration = durationMap[durationKey];
  if (!duration) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Durée invalide.')] });
    return;
  }

  try {
    const expiresAt = new Date(Date.now() + duration.seconds * 1000);
    await member.timeout(duration.seconds * 1000, `Muté par ${interaction.user.tag}: ${reason}`);

    await ensureUser(user.id, user.username, user.avatar);
    await prisma.moderationCase.create({
      data: {
        guildId: interaction.guild.id,
        userId: user.id,
        moderatorId: interaction.user.id,
        type: 'MUTE',
        reason,
        duration: duration.seconds,
        expiresAt,
        active: true,
      },
    });

    try {
      const dmEmbed = infoEmbed('Mute', `Vous avez été rendu muet sur **${interaction.guild.name}**.`)
        .addFields(
          { name: 'Raison', value: reason },
          { name: 'Durée', value: duration.label }
        );
      await user.send({ embeds: [dmEmbed] });
    } catch {}

    log({ level: 'info', message: `Mute: ${user.tag} par ${interaction.user.tag} (${durationKey})`, guildId: interaction.guild.id });

    await interaction.editReply({
      embeds: [successEmbed('Utilisateur rendu muet', `**${user.tag}** a été rendu muet pour **${duration.label}**.\nRaison : ${reason}`)],
    });
  } catch (error) {
    console.error(error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de rendre muet cet utilisateur.')] });
  }
}
