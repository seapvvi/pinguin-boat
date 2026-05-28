import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { getConfig } from '@pinguin/config';
import { successEmbed, errorEmbed } from '../../services/embed';

const config = getConfig();

export const data = new SlashCommandBuilder()
  .setName('embed-color')
  .setDescription('Définissez une couleur personnalisée pour vos embeds (réservé aux donateurs).')
  .addStringOption((opt) =>
    opt
      .setName('couleur')
      .setDescription('Couleur hexadécimale (ex: #ff5733) ou "reset" pour réinitialiser')
      .setRequired(true)
  );

export const cooldown = 10;

export async function execute(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const isOwner = interaction.user.id === config.DISCORD_OWNER_ID;
  const donor = await prisma.donor.findUnique({ where: { userId: interaction.user.id } });

  if (!isOwner && (!donor || !donor.isDonor)) {
    await interaction.editReply({
      embeds: [errorEmbed('Réservé aux donateurs', 'Cette commande est réservée aux donateurs du projet. Soutenez Pinguin Boat pour y accéder !')],
    });
    return;
  }

  const input = interaction.options.getString('couleur', true).trim();

  if (input.toLowerCase() === 'reset') {
    if (donor) {
      await prisma.donor.update({ where: { userId: interaction.user.id }, data: { embedColor: null } });
    }
    await interaction.editReply({ embeds: [successEmbed('Couleur réinitialisée', 'Votre couleur d\'embed a été réinitialisée.')] });
    return;
  }

  const hexRegex = /^#?([0-9a-fA-F]{6})$/;
  const match = input.match(hexRegex);
  if (!match) {
    await interaction.editReply({
      embeds: [errorEmbed('Format invalide', 'Fournissez une couleur hexadécimale valide (ex: `#ff5733` ou `ff5733`).')],
    });
    return;
  }

  const hex = `#${match[1].toUpperCase()}`;
  await prisma.donor.upsert({
    where: { userId: interaction.user.id },
    update: { embedColor: hex },
    create: { userId: interaction.user.id, username: interaction.user.username, embedColor: hex, amount: 0, isDonor: true, isPublic: false },
  });
  await interaction.editReply({
    embeds: [successEmbed('Couleur mise à jour', `Votre couleur d'embed est maintenant \`${hex}\`.`)
      .setColor(parseInt(match[1], 16))],
  });
}
