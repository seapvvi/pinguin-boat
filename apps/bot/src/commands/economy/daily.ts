import { SlashCommandBuilder, CommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { infoEmbed, errorEmbed, successEmbed } from '../../services/embed';
import { log } from '../../services/logger';

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Réclamer votre récompense quotidienne');

export const module = 'economy';

export async function execute(interaction: CommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guild) return;

  try {
    let wallet = await prisma.economyWallet.findUnique({
      where: { guildId_userId: { guildId: interaction.guild.id, userId: interaction.user.id } },
    });

    if (!wallet) {
      wallet = await prisma.economyWallet.create({
        data: {
          guildId: interaction.guild.id,
          userId: interaction.user.id,
          wallet: 0,
          bank: 0,
          totalEarned: 0,
        },
      });
    }

    if (wallet.lastDailyAt) {
      const now = new Date();
      const diff = now.getTime() - wallet.lastDailyAt.getTime();
      const hoursSinceLast = diff / 3600000;
      if (hoursSinceLast < 24) {
        const remaining = 24 - hoursSinceLast;
        const hours = Math.floor(remaining);
        const minutes = Math.floor((remaining - hours) * 60);
        await interaction.editReply({
          embeds: [errorEmbed('Déjà réclamé', `Vous avez déjà réclamé votre récompense quotidienne. Revenez dans **${hours}h ${minutes}min**.`)],
        });
        return;
      }
    }

    const dailyAmount = 100;
    const newWallet = wallet.wallet + dailyAmount;

    await prisma.economyWallet.update({
      where: { guildId_userId: { guildId: interaction.guild.id, userId: interaction.user.id } },
      data: {
        wallet: newWallet,
        totalEarned: { increment: dailyAmount },
        lastDailyAt: new Date(),
      },
    });

    await prisma.economyTransaction.create({
      data: {
        guildId: interaction.guild.id,
        toUserId: interaction.user.id,
        amount: dailyAmount,
        type: 'DAILY',
        description: 'Récompense quotidienne',
      },
    });

    await interaction.editReply({
      embeds: [successEmbed('Récompense quotidienne', `Vous avez reçu **${dailyAmount} 🪙** !\nNouveau solde : **${newWallet} 🪙**`)],
    });
  } catch (error) {
    console.error(error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de réclamer la récompense.')] });
  }
}
