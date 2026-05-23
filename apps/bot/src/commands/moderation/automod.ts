import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits, ChannelType } from 'discord.js';
import { prisma } from '@pinguin/db';
import { infoEmbed, errorEmbed, successEmbed } from '../../services/embed';

const automodLevels = [
  { name: 'Désactivé', value: 'disabled' },
  { name: 'Faible', value: 'low' },
  { name: 'Moyen', value: 'medium' },
  { name: 'Élevé', value: 'high' },
  { name: 'Personnalisé', value: 'custom' },
];

export const data = new SlashCommandBuilder()
  .setName('automod')
  .setDescription('Configurer la protection anti-spam/anti-lien')
  .addStringOption((opt) =>
    opt.setName('setting')
      .setDescription('Paramètre à configurer')
      .addChoices(
        { name: 'Niveau de protection', value: 'level' },
        { name: 'Anti-spam', value: 'antispam' },
        { name: 'Anti-lien', value: 'antilink' },
        { name: 'Anti-mass-mention', value: 'antiraid' }
      )
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName('value')
      .setDescription('Valeur du paramètre')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const permissions = true;
export const requireAdmin = true;
export const module = 'moderation';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  const setting = interaction.options.get('setting')?.value as string;
  const value = interaction.options.get('value')?.value as string;

  if (!interaction.guild) return;

  let modules = await prisma.moduleEnabled.findUnique({ where: { guildId: interaction.guild.id } });
  if (!modules) {
    modules = await prisma.moduleEnabled.create({ data: { guildId: interaction.guild.id } });
  }

  const updateData: Record<string, boolean> = {};

  switch (setting) {
    case 'level': {
      const levelValue = value.toLowerCase();
      const validLevels = ['disabled', 'low', 'medium', 'high', 'custom'];
      if (!validLevels.includes(levelValue)) {
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Niveau invalide. Valeurs : disabled, low, medium, high, custom')] });
        return;
      }
      if (levelValue === 'disabled') {
        updateData.protection = false;
      } else {
        updateData.protection = true;
      }
      break;
    }
    case 'antispam': {
      if (value !== 'true' && value !== 'false') {
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Valeur invalide. Utilisez true ou false.')] });
        return;
      }
      updateData.protection = value === 'true';
      break;
    }
    case 'antilink': {
      if (value !== 'true' && value !== 'false') {
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Valeur invalide. Utilisez true ou false.')] });
        return;
      }
      updateData.protection = value === 'true';
      break;
    }
    case 'antiraid': {
      if (value !== 'true' && value !== 'false') {
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Valeur invalide. Utilisez true ou false.')] });
        return;
      }
      updateData.protection = value === 'true';
      break;
    }
    default: {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Paramètre invalide.')] });
      return;
    }
  }

  await prisma.moduleEnabled.update({
    where: { guildId: interaction.guild.id },
    data: updateData,
  });

  await interaction.editReply({
    embeds: [successEmbed('Auto-modération configurée', `Le paramètre **${setting}** a été défini sur **${value}**.`)],
  });
}
