import { SlashCommandBuilder, CommandInteraction, Client, StringSelectMenuBuilder, ActionRowBuilder, ComponentType } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { enrichedErrorEmbed, successEmbed } from '../../services/embed';
import { logger } from '@pinguin/shared';

export const data = new SlashCommandBuilder()
  .setName('notify')
  .setDescription('Gérer vos rappels de récompenses quotidiennes/hebdomadaires');

export const module = 'economy';

export async function execute(interaction: CommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    await ensureUser(interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL());

    const user = await prisma.user.findUnique({
      where: { discordId: interaction.user.id },
    });

    if (!user) {
      await interaction.editReply({
        embeds: [enrichedErrorEmbed(
          'Erreur',
          'Utilisateur introuvable.',
          'Veuillez réessayer.'
        )],
      });
      return;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('notify_select')
      .setPlaceholder('Choisir les notifications à activer/désactiver')
      .addOptions([
        {
          label: 'Rappel quotidien',
          description: user.notifyDaily ? 'Désactiver' : 'Activer',
          value: 'daily',
          emoji: user.notifyDaily ? '🔔' : '🔕',
        },
        {
          label: 'Rappel hebdomadaire',
          description: user.notifyWeekly ? 'Désactiver' : 'Activer',
          value: 'weekly',
          emoji: user.notifyWeekly ? '🔔' : '🔕',
        },
      ]);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

    await interaction.editReply({
      embeds: [successEmbed(
        'Notifications',
        `**Rappel quotidien :** ${user.notifyDaily ? '🔔 Activé' : '🔕 Désactivé'}\n**Rappel hebdomadaire :** ${user.notifyWeekly ? '🔔 Activé' : '🔕 Désactivé'}\n\nSélectionnez une option pour modifier vos préférences.`
      )],
      components: [row],
    });

    const collector = interaction.channel?.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60_000,
    });

    collector?.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ ephemeral: true, content: "Vous ne pouvez pas utiliser ce menu." });
        return;
      }

      const selected = i.values[0];
      let updates: { notifyDaily?: boolean; notifyWeekly?: boolean } = {};

      if (selected === 'daily') {
        updates.notifyDaily = !user.notifyDaily;
      } else if (selected === 'weekly') {
        updates.notifyWeekly = !user.notifyWeekly;
      }

      const updatedUser = await prisma.user.update({
        where: { discordId: interaction.user.id },
        data: updates,
      });

      const newSelect = new StringSelectMenuBuilder()
        .setCustomId('notify_select')
        .setPlaceholder('Choisir les notifications à activer/désactiver')
        .addOptions([
          {
            label: 'Rappel quotidien',
            description: updatedUser.notifyDaily ? 'Désactiver' : 'Activer',
            value: 'daily',
            emoji: updatedUser.notifyDaily ? '🔔' : '🔕',
          },
          {
            label: 'Rappel hebdomadaire',
            description: updatedUser.notifyWeekly ? 'Désactiver' : 'Activer',
            value: 'weekly',
            emoji: updatedUser.notifyWeekly ? '🔔' : '🔕',
          },
        ]);

      const newRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(newSelect);

      await i.update({
        embeds: [successEmbed(
          'Notifications',
          `**Rappel quotidien :** ${updatedUser.notifyDaily ? '🔔 Activé' : '🔕 Désactivé'}\n**Rappel hebdomadaire :** ${updatedUser.notifyWeekly ? '🔔 Activé' : '🔕 Désactivé'}\n\nSélectionnez une option pour modifier vos préférences.`
        )],
        components: [newRow],
      });

      Object.assign(user, updatedUser);
    });

    collector?.on('end', async () => {
      await interaction.editReply({ components: [] }).catch(() => {});
    });
  } catch (error) {
    logger.error('Erreur lors de la gestion des notifications', { err: error instanceof Error ? error.message : String(error) });
    await interaction.editReply({
      embeds: [enrichedErrorEmbed(
        'Erreur',
        'Impossible de modifier vos préférences de notification.',
        'Veuillez réessayer.'
      )],
    });
  }
}
