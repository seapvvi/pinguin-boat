import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { getEconomySettings, getOrCreateWallet, formatCoins, isEconomyActive } from '../../services/economy';
import { addItemToInventory } from '../../services/inventory';
import { errorEmbed, successEmbed } from '../../services/embed';

export const data = new SlashCommandBuilder()
  .setName('buy')
  .setDescription('Acheter un article de la boutique')
  .addStringOption((opt) =>
    opt.setName('article').setDescription('Nom de l\'article').setRequired(true).setAutocomplete(true)
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

  // Si c'est un item consommable, l'ajouter à l'inventaire
  if (item.type !== 'ROLE') {
    await addItemToInventory(interaction.guild.id, interaction.user.id, item.id, 1);
    await interaction.editReply({
      embeds: [successEmbed('Achat effectué', `**${item.name}** ajouté à votre inventaire ! Utilisez `/inventory` pour voir vos items.`)],
    });
    return;
  }

  // Sinon, c'est un rôle : l'attribuer directement
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

export async function autocomplete(interaction: any, _client: Client): Promise<void> {
  if (!interaction.guild) return;

  const focusedValue = interaction.options.getFocused();
  const settings = await getEconomySettings(interaction.guild.id);

  const filtered = settings.shopItems
    .filter((item: typeof settings.shopItems[number]) => item.name.toLowerCase().includes(focusedValue.toLowerCase()))
    .slice(0, 25);

  await interaction.respond(
    filtered.map((item: typeof settings.shopItems[number]) => ({ name: item.name, value: item.name }))
  );
}
