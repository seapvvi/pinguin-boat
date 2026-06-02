import { SlashCommandBuilder, CommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { getEconomySettings, getOrCreateWallet, formatCoins, isEconomyActive, getEconomyMultiplier } from '../../services/economy';
import { enrichedErrorEmbed, successEmbed } from '../../services/embed';
import { log } from '../../services/logger';
import { updateQuestProgress } from '../../services/quests';
import { logger } from '@pinguin/shared';

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Réclamer votre récompense quotidienne');

export const module = 'economy';

export async function execute(interaction: CommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guild) return;

  try {
    if (!(await isEconomyActive(interaction.guild.id))) {
      await interaction.editReply({ 
        embeds: [enrichedErrorEmbed(
          'Module désactivé',
          'Le module économie n\'est pas activé sur ce serveur.',
          'Activez le module économie dans les paramètres du serveur ou via le dashboard.'
        )] 
      });
      return;
    }
    const settings = await getEconomySettings(interaction.guild.id);

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
          embeds: [enrichedErrorEmbed(
            'Déjà réclamé',
            `Vous avez déjà réclamé votre récompense quotidienne. Revenez dans **${hours}h ${minutes}min**.`,
            'La récompense quotidienne peut être réclamée toutes les 24 heures.'
          )],
        });
        return;
      }
    }

    const multiplier = await getEconomyMultiplier();
    const dailyAmount = settings.dailyAmount * multiplier;
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

    await updateQuestProgress(interaction.guild.id, interaction.user.id, 'EARN_MONEY', dailyAmount);

    const bonusNote = multiplier > 1 ? ` (x${multiplier} — événement actif !)` : '';
    await interaction.editReply({
      embeds: [successEmbed('Récompense quotidienne', `Vous avez reçu ${formatCoins(dailyAmount, settings.currencySymbol, settings.currencyName)} !${bonusNote}\nNouveau solde : ${formatCoins(newWallet, settings.currencySymbol, settings.currencyName)}`)],
    });
  } catch (error) {
    logger.error('Erreur lors de la réclamation de la récompense quotidienne', { err: error instanceof Error ? error.message : String(error) });
    await interaction.editReply({ 
      embeds: [enrichedErrorEmbed(
        'Erreur',
        'Impossible de réclamer votre récompense quotidienne.',
        'Vérifiez que vous avez un portefeuille économique actif et réessayez.'
      )] 
    });
  }
}
