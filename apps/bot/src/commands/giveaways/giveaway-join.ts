import { ButtonInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { errorEmbed, successEmbed } from '../../services/embed';

export async function handleGiveawayJoin(interaction: ButtonInteraction, client: Client): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  if (!interaction.guild) return;

  const giveaway = await prisma.giveaway.findFirst({
    where: { messageId: interaction.message.id, guildId: interaction.guild.id, status: 'RUNNING' },
  });

  if (!giveaway) {
    await interaction.editReply({ embeds: [errorEmbed('Terminé', 'Ce giveaway n\'est plus actif.')] });
    return;
  }

  await ensureUser(interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL());

  const existing = await prisma.giveawayEntry.findUnique({
    where: { giveawayId_userId: { giveawayId: giveaway.id, userId: interaction.user.id } },
  });

  if (existing) {
    await interaction.editReply({ embeds: [errorEmbed('Déjà inscrit', 'Tu participes déjà à ce giveaway.')] });
    return;
  }

  await prisma.giveawayEntry.create({
    data: { giveawayId: giveaway.id, userId: interaction.user.id },
  });

  await interaction.editReply({ embeds: [successEmbed('Inscrit', 'Tu participes au giveaway !')] });
}
