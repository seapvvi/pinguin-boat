import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { errorEmbed, successEmbed } from '../../services/embed';
import { isModuleEnabled } from '../../guards/module';
import { logger } from '@pinguin/shared';

export const data = new SlashCommandBuilder()
  .setName('notify-levelup')
  .setDescription('Configurer vos notifications de level up')
  .addStringOption((opt) =>
    opt
      .setName('type')
      .setDescription('Type de notification')
      .setRequired(true)
      .addChoices(
        { name: 'Message privé (DM)', value: 'DM' },
        { name: 'Salon d\'annonce', value: 'CHANNEL' },
        { name: 'Désactivé', value: 'NONE' }
      )
  );

export const module = 'levels';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Cette commande doit être utilisée sur un serveur.')] });
    return;
  }

  if (!(await isModuleEnabled(interaction.guild.id, 'levels'))) {
    await interaction.editReply({ embeds: [errorEmbed('Module désactivé', 'Le module levels est désactivé sur ce serveur.')] });
    return;
  }

  try {
    await ensureUser(interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL());

    const notificationType = interaction.options.getString('type', true) as 'DM' | 'CHANNEL' | 'NONE';

    const profile = await prisma.xPProfile.upsert({
      where: { guildId_userId: { guildId: interaction.guild.id, userId: interaction.user.id } },
      create: {
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        levelUpNotification: notificationType,
      },
      update: {
        levelUpNotification: notificationType,
      },
    });

    const typeLabels: Record<string, string> = {
      DM: 'Message privé (DM)',
      CHANNEL: 'Salon d\'annonce',
      NONE: 'Désactivé',
    };

    await interaction.editReply({
      embeds: [successEmbed(
        'Notifications de level up',
        `Vos notifications de level up sont maintenant configurées sur : **${typeLabels[notificationType]}**`
      )],
    });
  } catch (error) {
    logger.error('Erreur lors de la modification des préférences de notification', { err: error instanceof Error ? error.message : String(error) });
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de modifier vos préférences de notification.')] });
  }
}
