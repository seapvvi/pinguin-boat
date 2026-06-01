import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { getEconomySettings, getOrCreateWallet, isEconomyActive, formatCoins } from '../../services/economy';
import { getInventoryEntry, removeItemFromInventory, addItemToInventory } from '../../services/inventory';
import { errorEmbed, successEmbed, createEmbed } from '../../services/embed';

export const data = new SlashCommandBuilder()
  .setName('market')
  .setDescription('Marché entre joueurs')
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('Lister les offres du marché')
  )
  .addSubcommand((sub) =>
    sub.setName('sell')
      .setDescription('Mettre en vente un item de votre inventaire')
      .addStringOption((opt) =>
        opt.setName('item').setDescription('Nom de l\'item à vendre').setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt.setName('prix').setDescription('Prix de vente').setRequired(true).setMinValue(1)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('buy')
      .setDescription('Acheter un item sur le marché')
      .addStringOption((opt) =>
        opt.setName('offre_id').setDescription('ID de l\'offre (ex: #abc123)').setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('cancel')
      .setDescription('Annuler une offre de vente')
      .addStringOption((opt) =>
        opt.setName('offre_id').setDescription('ID de l\'offre (ex: #abc123)').setRequired(true)
      )
  );

export const module = 'economy';

export async function execute(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (!interaction.guild) return;

  switch (subcommand) {
    case 'list': {
      await interaction.deferReply();

      if (!(await isEconomyActive(interaction.guild.id))) {
        await interaction.editReply({ embeds: [errorEmbed('Module désactivé', 'L\'économie n\'est pas activée.')] });
        return;
      }

      const settings = await getEconomySettings(interaction.guild.id);

      const listings = await prisma.marketListing.findMany({
        where: {
          guildId: interaction.guild.id,
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
        include: { item: true },
        orderBy: { createdAt: 'desc' },
        take: 25,
      });

      if (listings.length === 0) {
        await interaction.editReply({
          embeds: [errorEmbed('Marché vide', 'Aucune offre disponible. Utilisez `/market sell` pour vendre un item.')],
        });
        return;
      }

      const embed = createEmbed('economy')
        .setTitle(`🏪 Marché — ${settings.currencyName}`)
        .setDescription(`**${listings.length}** offre(s) disponible(s)\nLes offres expirent après 24h.`)
        .setTimestamp();

      for (const listing of listings) {
        const seller = await interaction.guild.members.fetch(listing.sellerId).catch(() => null);
        const sellerName = seller?.user.username || listing.sellerId;
        const timeLeft = Math.floor((listing.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));
        const timeStr = timeLeft > 0 ? `${timeLeft}h` : '< 1h';

        embed.addFields({
          name: `#${listing.id.slice(-6)} — ${listing.item.name}`,
          value: `Prix: ${formatCoins(listing.price, settings.currencySymbol, settings.currencyName)}\nVendeur: ${sellerName}\nExpire: ${timeStr}`,
        });
      }

      await interaction.editReply({ embeds: [embed] });
      break;
    }

    case 'sell': {
      await interaction.deferReply();

      if (!(await isEconomyActive(interaction.guild.id))) {
        await interaction.editReply({ embeds: [errorEmbed('Module désactivé', 'L\'économie n\'est pas activée.')] });
        return;
      }

      const settings = await getEconomySettings(interaction.guild.id);
      const itemName = interaction.options.getString('item', true).toLowerCase();
      const price = interaction.options.getInteger('prix', true);

      const economySettings = await prisma.economySettings.findUnique({
        where: { guildId: interaction.guild.id },
        include: { shopItems: true },
      });

      if (!economySettings) {
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Configuration économique introuvable.')] });
        return;
      }

      const item = economySettings.shopItems.find(
        (i) => i.name.toLowerCase() === itemName || i.id === itemName
      );

      if (!item) {
        await interaction.editReply({ embeds: [errorEmbed('Item introuvable', 'Utilisez `/inventory` pour voir vos items.')] });
        return;
      }

      if (item.type === 'ROLE') {
        await interaction.editReply({ embeds: [errorEmbed('Item non vendable', 'Les rôles ne peuvent pas être vendus sur le marché.')] });
        return;
      }

      const inventoryEntry = await getInventoryEntry(interaction.guild.id, interaction.user.id, item.id);
      if (!inventoryEntry || inventoryEntry.quantity < 1) {
        await interaction.editReply({ embeds: [errorEmbed('Item manquant', 'Vous ne possédez pas cet item.')] });
        return;
      }

      const existingListing = await prisma.marketListing.findFirst({
        where: {
          guildId: interaction.guild.id,
          sellerId: interaction.user.id,
          itemId: item.id,
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
      });

      if (existingListing) {
        await interaction.editReply({ embeds: [errorEmbed('Offre existante', 'Vous avez déjà une offre active pour cet item.')] });
        return;
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.marketListing.create({
        data: {
          guildId: interaction.guild.id,
          sellerId: interaction.user.id,
          itemId: item.id,
          price,
          status: 'ACTIVE',
          expiresAt,
        },
      });

      await removeItemFromInventory(interaction.guild.id, interaction.user.id, item.id, 1);

      await interaction.editReply({
        embeds: [
          successEmbed(
            'Offre créée',
            `**${item.name}** mis en vente pour ${formatCoins(price, settings.currencySymbol, settings.currencyName)}.\nID de l'offre: #${item.id.slice(-6)}\nExpire dans 24h.`
          ),
        ],
      });
      break;
    }

    case 'buy': {
      await interaction.deferReply();

      if (!(await isEconomyActive(interaction.guild.id))) {
        await interaction.editReply({ embeds: [errorEmbed('Module désactivé', 'L\'économie n\'est pas activée.')] });
        return;
      }

      const settings = await getEconomySettings(interaction.guild.id);
      const offerIdInput = interaction.options.getString('offre_id', true);
      const offerId = offerIdInput.replace('#', '');

      const listing = await prisma.marketListing.findFirst({
        where: {
          id: { contains: offerId, mode: 'insensitive' },
          guildId: interaction.guild.id,
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
        include: { item: true },
      });

      if (!listing) {
        await interaction.editReply({ embeds: [errorEmbed('Offre introuvable', 'Cette offre n\'existe pas ou a expiré.')] });
        return;
      }

      if (listing.sellerId === interaction.user.id) {
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Vous ne pouvez pas acheter votre propre offre.')] });
        return;
      }

      const wallet = await getOrCreateWallet(interaction.guild.id, interaction.user.id, settings.startupBalance);
      if (wallet.wallet < listing.price) {
        await interaction.editReply({
          embeds: [errorEmbed('Solde insuffisant', `Il vous faut ${formatCoins(listing.price, settings.currencySymbol, settings.currencyName)}.`)],
        });
        return;
      }

      const sellerWallet = await getOrCreateWallet(interaction.guild.id, listing.sellerId, settings.startupBalance);

      await prisma.$transaction([
        prisma.economyWallet.update({
          where: { guildId_userId: { guildId: interaction.guild.id, userId: interaction.user.id } },
          data: { wallet: { decrement: listing.price } },
        }),
        prisma.economyWallet.update({
          where: { guildId_userId: { guildId: interaction.guild.id, userId: listing.sellerId } },
          data: { wallet: { increment: listing.price } },
        }),
        prisma.economyTransaction.create({
          data: {
            guildId: interaction.guild.id,
            fromUserId: interaction.user.id,
            toUserId: listing.sellerId,
            amount: listing.price,
            type: 'TRANSFER',
            description: `Achat marché: ${listing.item.name}`,
          },
        }),
        prisma.marketListing.update({
          where: { id: listing.id },
          data: {
            status: 'SOLD',
            buyerId: interaction.user.id,
            soldAt: new Date(),
          },
        }),
      ]);

      await addItemToInventory(interaction.guild.id, interaction.user.id, listing.item.id, 1);

      const buyer = await interaction.guild.members.fetch(interaction.user.id);
      const seller = await interaction.guild.members.fetch(listing.sellerId).catch(() => null);

      await buyer.send({
        embeds: [
          successEmbed(
            'Achat effectué',
            `Vous avez acheté **${listing.item.name}** pour ${formatCoins(listing.price, settings.currencySymbol, settings.currencyName)} sur le serveur ${interaction.guild.name}.`
          ),
        ],
      }).catch(() => {});

      if (seller) {
        await seller.send({
          embeds: [
            successEmbed(
              'Vente effectuée',
              `Votre offre **${listing.item.name}** a été achetée pour ${formatCoins(listing.price, settings.currencySymbol, settings.currencyName)} par ${buyer.user.username} sur le serveur ${interaction.guild.name}.`
            ),
          ],
        }).catch(() => {});
      }

      await interaction.editReply({
        embeds: [
          successEmbed(
            'Achat effectué',
            `Vous avez acheté **${listing.item.name}** pour ${formatCoins(listing.price, settings.currencySymbol, settings.currencyName)}.\nL'item a été ajouté à votre inventaire.`
          ),
        ],
      });
      break;
    }

    case 'cancel': {
      await interaction.deferReply();

      if (!(await isEconomyActive(interaction.guild.id))) {
        await interaction.editReply({ embeds: [errorEmbed('Module désactivé', 'L\'économie n\'est pas activée.')] });
        return;
      }

      const settings = await getEconomySettings(interaction.guild.id);
      const offerIdInput = interaction.options.getString('offre_id', true);
      const offerId = offerIdInput.replace('#', '');

      const listing = await prisma.marketListing.findFirst({
        where: {
          id: { contains: offerId, mode: 'insensitive' },
          guildId: interaction.guild.id,
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
        include: { item: true },
      });

      if (!listing) {
        await interaction.editReply({ embeds: [errorEmbed('Offre introuvable', 'Cette offre n\'existe pas ou a expiré.')] });
        return;
      }

      if (listing.sellerId !== interaction.user.id) {
        await interaction.editReply({ embeds: [errorEmbed('Non autorisé', 'Vous ne pouvez annuler que vos propres offres.')] });
        return;
      }

      await prisma.$transaction([
        prisma.marketListing.update({
          where: { id: listing.id },
          data: { status: 'CANCELLED' },
        }),
      ]);

      await addItemToInventory(interaction.guild.id, interaction.user.id, listing.item.id, 1);

      await interaction.editReply({
        embeds: [
          successEmbed(
            'Offre annulée',
            `Votre offre **${listing.item.name}** a été annulée.\nL'item a été remis dans votre inventaire.`
          ),
        ],
      });
      break;
    }
  }
}
