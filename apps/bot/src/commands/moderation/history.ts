import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits } from 'discord.js';
import { prisma } from '@pinguin/db';
import { infoEmbed, errorEmbed } from '../../services/embed';
import { createEmbed } from '../../services/embed';

export const data = new SlashCommandBuilder()
  .setName('history')
  .setDescription('Voir l\'historique de modération d\'un utilisateur')
  .addUserOption((opt) => opt.setName('user').setDescription('Utilisateur').setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export const permissions = true;
export const module = 'moderation';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const user = interaction.options.get('user')?.user!;

  if (!interaction.guild) return;

  try {
    const cases = await prisma.moderationCase.findMany({
      where: { guildId: interaction.guild.id, userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (cases.length === 0) {
      await interaction.editReply({ embeds: [infoEmbed('Historique', `Aucun cas de modération pour **${user.tag}**.`)] });
      return;
    }

    const warnings = await prisma.warning.findMany({
      where: { guildId: interaction.guild.id, userId: user.id, active: true },
    });

    const embed = createEmbed('moderation')
      .setTitle(`Historique de modération - ${user.tag}`)
      .setDescription(`Total : **${cases.length}** cas | Avertissements actifs : **${warnings.length}**`)
      .setTimestamp();

    const recentCases = cases.slice(0, 10);
    for (const c of recentCases) {
      const date = c.createdAt.toLocaleDateString('fr-FR');
      const status = c.active ? '🟢 Actif' : '🔴 Inactif';
      embed.addFields({
        name: `#${c.id.slice(0, 8)} - ${c.type} (${date})`,
        value: `Raison : ${c.reason}\nModérateur : <@${c.moderatorId}>\nStatut : ${status}${c.duration ? `\nDurée : ${c.duration}s` : ''}`,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error(error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de récupérer l\'historique.')] });
  }
}
