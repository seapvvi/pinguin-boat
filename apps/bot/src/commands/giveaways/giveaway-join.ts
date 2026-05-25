import { ButtonInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { errorEmbed, successEmbed } from '../../services/embed';
import { requireModule } from '../../guards/module';

export async function handleGiveawayJoin(interaction: ButtonInteraction, _client: Client): Promise<void> {
  if (!interaction.guild) return;

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }

  const moduleCheck = await requireModule(interaction.guild.id, 'giveaways');
  if (!moduleCheck.enabled) {
    await interaction.editReply({ embeds: [errorEmbed('Module désactivé', moduleCheck.message!)] });
    return;
  }

  const giveaway = await prisma.giveaway.findFirst({
    where: { messageId: interaction.message.id, guildId: interaction.guild.id, status: 'RUNNING' },
  });

  if (!giveaway) {
    await interaction.editReply({ embeds: [errorEmbed('Terminé', 'Ce giveaway n\'est plus actif.')] });
    return;
  }

  const dbUser = await ensureUser(
    interaction.user.id,
    interaction.user.username,
    interaction.user.displayAvatarURL()
  );

  const existing = await prisma.giveawayEntry.findUnique({
    where: { giveawayId_userId: { giveawayId: giveaway.id, userId: dbUser.id } },
  });

  if (existing) {
    await interaction.editReply({ embeds: [errorEmbed('Déjà inscrit', 'Tu participes déjà à ce giveaway.')] });
    return;
  }

  await prisma.giveawayEntry.create({
    data: { giveawayId: giveaway.id, userId: dbUser.id },
  });

  await interaction.editReply({ embeds: [successEmbed('Inscrit', 'Tu participes au giveaway !')] });
}
