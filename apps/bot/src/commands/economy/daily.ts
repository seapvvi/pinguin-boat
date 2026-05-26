import { SlashCommandBuilder, CommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { getEconomySettings, getOrCreateWallet, formatCoins } from '../../services/economy';
import { errorEmbed, successEmbed } from '../../services/embed';
import { log } from '../../services/logger';

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Réclamer votre récompense quotidienne');

export const module = 'economy';

export async function execute(interaction: CommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guild) return;

  try {
    const settings = await getEconomySettings(interaction.guild.id);
    if (!settings.enabled) {
      await interaction.editReply({ embeds: [errorEmbed('Module désactivé', 'L\'économie n\'est pas activée.')] });
      return;
    }

    await ensureUser(interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL());
    const wallet = await getOrCreateWallet(interaction.guild.id, interaction.user.id, settings.startupBalance);

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

    const dailyAmount = settings.dailyAmount;
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
      embeds: [successEmbed('Récompense quotidienne', `Vous avez reçu ${formatCoins(dailyAmount, settings.currencySymbol, settings.currencyName)} !\nNouveau solde : ${formatCoins(newWallet, settings.currencySymbol, settings.currencyName)}`)],
    });
  } catch (error) {
    console.error(error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de réclamer la récompense.')] });
  }
}
