import { SlashCommandBuilder, CommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { getEconomySettings, getOrCreateWallet, formatCoins, isEconomyActive } from '../../services/economy';
import { successEmbed, errorEmbed } from '../../services/embed';
import { updateQuestProgress } from '../../services/quests';

export const data = new SlashCommandBuilder()
  .setName('weekly')
  .setDescription('Réclamer votre récompense hebdomadaire');

export const module = 'economy';

export async function execute(interaction: CommandInteraction, _client: Client): Promise<void> {
  await interaction.deferReply();
  if (!interaction.guild) return;

  if (!(await isEconomyActive(interaction.guild.id))) {
    await interaction.editReply({ embeds: [errorEmbed('Module désactivé', 'L\'économie n\'est pas activée.')] });
    return;
  }
  const settings = await getEconomySettings(interaction.guild.id);

  await ensureUser(interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL());
  const wallet = await getOrCreateWallet(interaction.guild.id, interaction.user.id, settings.startupBalance);

  if (wallet.lastWeeklyAt) {
    const now = new Date();
    const diff = now.getTime() - wallet.lastWeeklyAt.getTime();
    const daysSinceLast = diff / (24 * 60 * 60 * 1000);
    if (daysSinceLast < 7) {
      const remaining = 7 - daysSinceLast;
      const days = Math.floor(remaining);
      await interaction.editReply({ embeds: [errorEmbed('Déjà réclamé', `Reviens dans **${days} jour(s)**.`)] });
      return;
    }
  }

  const amount = settings.weeklyAmount;
  const newBalance = wallet.wallet + amount;

  await prisma.economyWallet.update({
    where: { guildId_userId: { guildId: interaction.guild.id, userId: interaction.user.id } },
    data: { 
      wallet: newBalance, 
      totalEarned: { increment: amount },
      lastWeeklyAt: new Date(),
    },
  });
  await prisma.economyTransaction.create({
    data: {
      guildId: interaction.guild.id,
      toUserId: interaction.user.id,
      amount,
      type: 'EARN',
      description: 'Récompense hebdomadaire',
    },
  });

  await updateQuestProgress(interaction.guild.id, interaction.user.id, 'EARN_MONEY', amount);

  await interaction.editReply({
    embeds: [successEmbed('Récompense hebdomadaire', `+${formatCoins(amount, settings.currencySymbol, settings.currencyName)}\nSolde : ${formatCoins(newBalance, settings.currencySymbol, settings.currencyName)}`)],
  });
}
