import { SlashCommandBuilder, CommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { getEconomySettings, getOrCreateWallet, formatCoins } from '../../services/economy';
import { successEmbed, errorEmbed } from '../../services/embed';

const weeklyCooldowns = new Map<string, number>();

export const data = new SlashCommandBuilder()
  .setName('weekly')
  .setDescription('Réclamer votre récompense hebdomadaire');

export const module = 'economy';

export async function execute(interaction: CommandInteraction, _client: Client): Promise<void> {
  await interaction.deferReply();
  if (!interaction.guild) return;

  const settings = await getEconomySettings(interaction.guild.id);
  if (!settings.enabled) {
    await interaction.editReply({ embeds: [errorEmbed('Module désactivé', 'L\'économie n\'est pas activée.')] });
    return;
  }

  await ensureUser(interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL());
  const wallet = await getOrCreateWallet(interaction.guild.id, interaction.user.id, settings.startupBalance);

  const key = `${interaction.guild.id}:${interaction.user.id}`;
  const last = weeklyCooldowns.get(key) ?? 0;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - last < weekMs) {
    const days = Math.ceil((weekMs - (Date.now() - last)) / (24 * 60 * 60 * 1000));
    await interaction.editReply({ embeds: [errorEmbed('Déjà réclamé', `Reviens dans **${days} jour(s)**.`)] });
    return;
  }
  weeklyCooldowns.set(key, Date.now());

  const amount = settings.weeklyAmount;
  const newBalance = wallet.wallet + amount;

  await prisma.economyWallet.update({
    where: { guildId_userId: { guildId: interaction.guild.id, userId: interaction.user.id } },
    data: { wallet: newBalance, totalEarned: { increment: amount } },
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

  await interaction.editReply({
    embeds: [successEmbed('Récompense hebdomadaire', `+${formatCoins(amount, settings.currencySymbol, settings.currencyName)}\nSolde : ${formatCoins(newBalance, settings.currencySymbol, settings.currencyName)}`)],
  });
}
