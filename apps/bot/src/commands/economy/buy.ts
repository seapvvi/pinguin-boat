import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { getEconomySettings, getOrCreateWallet, formatCoins, isEconomyActive } from '../../services/economy';
import { errorEmbed, successEmbed } from '../../services/embed';

export const data = new SlashCommandBuilder()
  .setName('buy')
  .setDescription('Acheter un article de la boutique')
  .addStringOption((opt) =>
    opt.setName('article').setDescription('Nom de l\'article').setRequired(true)
  );

export const module = 'economy';

export async function execute(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  await interaction.deferReply();
  if (!interaction.guild) return;

  if (!(await isEconomyActive(interaction.guild.id))) {
    await interaction.editReply({ embeds: [errorEmbed('Module désactivé', 'L\'économie n\'est pas activée.')] });
    return;
  }
  const settings = await getEconomySettings(interaction.guild.id);

  const query = interaction.options.getString('article', true).toLowerCase();
  const item = settings.shopItems.find((i: typeof settings.shopItems[number]) => i.name.toLowerCase() === query || i.id === query);
  if (!item) {
    await interaction.editReply({ embeds: [errorEmbed('Article introuvable', 'Utilisez `/shop` pour voir les articles.')] });
    return;
  }

  const wallet = await getOrCreateWallet(interaction.guild.id, interaction.user.id, settings.startupBalance);
  if (wallet.wallet < item.price) {
    await interaction.editReply({
      embeds: [errorEmbed('Solde insuffisant', `${item.name} coûte ${formatCoins(item.price, settings.currencySymbol, settings.currencyName)}.`)],
    });
    return;
  }

  await prisma.economyWallet.update({
    where: { guildId_userId: { guildId: interaction.guild.id, userId: interaction.user.id } },
    data: { wallet: { decrement: item.price } },
  });
  await prisma.economyTransaction.create({
    data: {
      guildId: interaction.guild.id,
      fromUserId: interaction.user.id,
      amount: item.price,
      type: 'SHOP_BUY',
      description: `Achat: ${item.name}`,
    },
  });

  if (item.roleId && interaction.member) {
    const roles = (interaction.member as any).roles;
    if (roles && typeof roles.add === 'function') {
      await roles.add(item.roleId, `Achat boutique: ${item.name}`).catch(() => {});
    }
  }

  await interaction.editReply({
    embeds: [successEmbed('Achat effectué', `**${item.name}** acheté pour ${formatCoins(item.price, settings.currencySymbol, settings.currencyName)} !`)],
  });
}
