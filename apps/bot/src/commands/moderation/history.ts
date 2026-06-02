import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } from 'discord.js';
import { prisma, type ModerationCaseType } from '@pinguin/db';
import { errorEmbed, createEmbed } from '../../services/embed';
import { isModuleEnabled } from '../../guards/module';

export const data = new SlashCommandBuilder()
  .setName('history')
  .setDescription('Voir l\'historique de modération d\'un utilisateur')
  .addUserOption((opt) => opt.setName('user').setDescription('Utilisateur').setRequired(true))
  .addStringOption((opt) =>
    opt
      .setName('type')
      .setDescription('Filtrer par type de sanction')
      .addChoices(
        { name: 'Avertissement', value: 'WARN' },
        { name: 'Mute', value: 'MUTE' },
        { name: 'Ban', value: 'BAN' },
        { name: 'Kick', value: 'KICK' },
        { name: 'Tempban', value: 'TEMPBAN' },
        { name: 'Timeout', value: 'TIMEOUT' }
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export const permissions = true;
export const module = 'moderation';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const user = interaction.options.get('user')?.user!;
  const typeFilter = interaction.options.get('type')?.value as ModerationCaseType | undefined;

  if (!interaction.guild) return;

  if (!(await isModuleEnabled(interaction.guild.id, 'moderation'))) {
    await interaction.editReply({ embeds: [errorEmbed('Module désactivé', 'Le module moderation est désactivé sur ce serveur.')] });
    return;
  }

  try {
    const where: { guildId: string; userId: string; type?: ModerationCaseType } = {
      guildId: interaction.guild.id,
      userId: user.id,
    };

    if (typeFilter) {
      where.type = typeFilter;
    }

    const cases = await prisma.moderationCase.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    if (cases.length === 0) {
      await interaction.editReply({
        embeds: [
          errorEmbed(
            'Historique vide',
            typeFilter
              ? `Aucun cas de modération de type **${typeFilter}** pour **${user.username}**.`
              : `Aucun cas de modération pour **${user.username}**.`
          ),
        ],
      });
      return;
    }

    let currentPage = 0;
    const itemsPerPage = 5;
    const totalPages = Math.ceil(cases.length / itemsPerPage);

    const generateEmbed = async (page: number) => {
      const start = page * itemsPerPage;
      const end = Math.min(start + itemsPerPage, cases.length);
      const pageCases = cases.slice(start, end);

      const embed = createEmbed('moderation')
        .setTitle(`📋 Historique de modération - ${user.username}`)
        .setDescription(
          `Total : **${cases.length}** cas${typeFilter ? ` (filtré : ${typeFilter})` : ''}\nPage ${page + 1}/${totalPages}`
        )
        .setTimestamp();

      for (const c of pageCases) {
        const date = c.createdAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const time = c.createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        let status: string;
        if (!c.active) {
          status = '🔴 Expiré/Inactif';
        } else if (c.expiresAt && c.expiresAt < new Date()) {
          status = '🔴 Expiré';
        } else {
          status = '🟢 Actif';
        }

        const moderator = await interaction.guild!.members.fetch(c.moderatorId).catch(() => null);
        const moderatorName = moderator?.displayName || c.moderatorId.slice(0, 8);

        let durationText = '';
        if (c.duration) {
          const hours = Math.floor(c.duration / 3600);
          const minutes = Math.floor((c.duration % 3600) / 60);
          if (hours > 0) {
            durationText = `${hours}h ${minutes}min`;
          } else if (minutes > 0) {
            durationText = `${minutes}min`;
          } else {
            durationText = `${c.duration}s`;
          }
        }

        embed.addFields({
          name: `#${c.id.slice(0, 8)} - ${c.type}`,
          value: `**Raison :** ${c.reason}\n**Modérateur :** ${moderatorName}\n**Date :** ${date} à ${time}\n**Statut :** ${status}${
            durationText ? `\n**Durée :** ${durationText}` : ''
          }`,
        });
      }

      return embed;
    };

    const getActionRow = (page: number) => {
      const row = new ActionRowBuilder<ButtonBuilder>();

      if (page > 0) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('prev')
            .setLabel('◀ Précédent')
            .setStyle(ButtonStyle.Secondary)
        );
      }

      if (page < totalPages - 1) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Suivant ▶')
            .setStyle(ButtonStyle.Secondary)
        );
      }

      return row;
    };

    const embed = await generateEmbed(currentPage);
    const actionRow = getActionRow(currentPage);

    const message = await interaction.editReply({
      embeds: [embed],
      components: actionRow.components.length > 0 ? [actionRow] : [],
    });

    if (totalPages <= 1) return;

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({
          content: 'Seul l\'utilisateur qui a lancé la commande peut naviguer.',
          ephemeral: true,
        });
        return;
      }

      if (i.customId === 'prev') {
        currentPage = Math.max(0, currentPage - 1);
      } else if (i.customId === 'next') {
        currentPage = Math.min(totalPages - 1, currentPage + 1);
      }

      const newEmbed = await generateEmbed(currentPage);
      const newRow = getActionRow(currentPage);

      await i.update({
        embeds: [newEmbed],
        components: newRow.components.length > 0 ? [newRow] : [],
      });
    });

    collector.on('end', async () => {
      await message.edit({ components: [] }).catch(() => {});
    });
  } catch (error) {
    console.error(error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de récupérer l\'historique.')] });
  }
}
