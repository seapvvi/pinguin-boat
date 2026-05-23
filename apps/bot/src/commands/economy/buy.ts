import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { infoEmbed, errorEmbed, successEmbed } from '../../services/embed';
import { log } from '../../services/logger';

const shopItems: Record<string, { name: string; price: number }> = {
  role_color: { name: 'Rôle coloré', price: 500 },
  nickname: { name: 'Changer de surnom', price: 200 },
  lucky: { name: 'Ticket de loterie', price: 100 },
};

export const data = new SlashCommandBuilder()
  .setName('buy')
  .setDescription('Acheter un article de la boutique')
  .addStringOption((opt) =>
    opt.setName('item')
      .setDescription('Article à acheter')
      .setRequired(true)
      .addChoices(
        { name: 'Rôle coloré (500 🪙)', value: 'role_color' },
        { name: 'Changer de surnom (200 🪙)', value: 'nickname' },
        { name: 'Ticket de loterie (100 🪙)', value: 'lucky' }
      )
  );

export const module = 'economy';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  const itemId = interaction.options.get('item')?.value as string;
  const item = shopItems[itemId];

  if (!item || !interaction.guild) return;

  try {
    let wallet = await prisma.economyWallet.findUnique({
      where: { guildId_userId: { guildId: interaction.guild.id, userId: interaction.user.id } },
    });

    if (!wallet || wallet.wallet < item.price) {
      await interaction.editReply({
        embeds: [errorEmbed('Solde insuffisant', `**${item.name}** coûte **${item.price} 🪙**. Vous avez **${wallet?.wallet ?? 0} 🪙** en portefeuille.`)],
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
        toUserId: interaction.user.id,
        amount: item.price,
        type: 'SHOP_BUY',
        description: `Achat: ${item.name}`,
      },
    });

    await interaction.editReply({
      embeds: [successEmbed('Achat effectué', `Vous avez acheté **${item.name}** pour **${item.price} 🪙**.`)],
    });
  } catch (error) {
    console.error(error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible d\'effectuer l\'achat.')] });
  }
}
