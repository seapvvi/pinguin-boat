import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { successEmbed, errorEmbed } from '../../services/embed';

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

  const donor = await prisma.donor.findUnique({ where: { userId: interaction.user.id } });

  if (!donor || !donor.isDonor) {
    await interaction.editReply({
      embeds: [errorEmbed('Réservé aux donateurs', 'Cette commande est réservée aux donateurs du projet. Soutenez Pinguin Boat pour y accéder !')],
    });
    return;
  }

  const input = interaction.options.getString('couleur', true).trim();

  if (input.toLowerCase() === 'reset') {
    await prisma.donor.update({ where: { userId: interaction.user.id }, data: { embedColor: null } });
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
  await prisma.donor.update({ where: { userId: interaction.user.id }, data: { embedColor: hex } });
  await interaction.editReply({
    embeds: [successEmbed('Couleur mise à jour', `Votre couleur d'embed est maintenant \`${hex}\`.`)
      .setColor(parseInt(match[1], 16))],
  });
}
