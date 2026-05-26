import { SlashCommandBuilder, CommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { getEconomySettings, getOrCreateWallet, formatCoins } from '../../services/economy';
import { successEmbed, errorEmbed } from '../../services/embed';

export const data = new SlashCommandBuilder()
  .setName('deposit')
  .setDescription('Déposer de la monnaie en banque')
  .addIntegerOption((o) => o.setName('montant').setDescription('Montant à déposer').setRequired(true).setMinValue(1));

export const module = 'economy';

export async function execute(interaction: CommandInteraction, _client: Client): Promise<void> {
  await interaction.deferReply();
  if (!interaction.guild) return;

  const settings = await getEconomySettings(interaction.guild.id);
  const amount = interaction.options.getInteger('montant', true);
  const wallet = await getOrCreateWallet(interaction.guild.id, interaction.user.id, settings.startupBalance);

  if (wallet.wallet < amount) {
    await interaction.editReply({ embeds: [errorEmbed('Fonds insuffisants', 'Tu n\'as pas assez dans ton portefeuille.')] });
    return;
  }
  if (wallet.bank + amount > settings.bankCapacity) {
    await interaction.editReply({
      embeds: [errorEmbed('Banque pleine', `Capacité max : **${settings.bankCapacity}** ${settings.currencySymbol}`)],
    });
    return;
  }

  await prisma.economyWallet.update({
    where: { guildId_userId: { guildId: interaction.guild.id, userId: interaction.user.id } },
    data: { wallet: { decrement: amount }, bank: { increment: amount } },
  });

  await interaction.editReply({
    embeds: [successEmbed('Dépôt', `${formatCoins(amount, settings.currencySymbol, settings.currencyName)} déposés en banque.`)],
  });
}
