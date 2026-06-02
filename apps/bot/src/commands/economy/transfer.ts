import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { infoEmbed, errorEmbed, successEmbed } from '../../services/embed';
import { log } from '../../services/logger';

export const data = new SlashCommandBuilder()
  .setName('transfer')
  .setDescription('Transférer des pièces à un autre membre')
  .addUserOption((opt) => opt.setName('user').setDescription('Destinataire').setRequired(true))
  .addIntegerOption((opt) =>
    opt.setName('amount').setDescription('Montant à transférer').setRequired(true).setMinValue(1)
  );

export const module = 'economy';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  const targetUser = interaction.options.get('user')?.user!;
  const amount = interaction.options.get('amount')?.value as number;

  if (!interaction.guild) return;

  if (targetUser.id === interaction.user.id) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Vous ne pouvez pas vous transférer des pièces à vous-même.')] });
    return;
  }

  try {
    await ensureUser(interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL());
    await ensureUser(targetUser.id, targetUser.username, targetUser.displayAvatarURL());

    let senderWallet = await prisma.economyWallet.findUnique({
      where: { guildId_userId: { guildId: interaction.guild.id, userId: interaction.user.id } },
    });

    if (!senderWallet || senderWallet.wallet < amount) {
      await interaction.editReply({
        embeds: [errorEmbed('Solde insuffisant', `Vous avez besoin de **${amount} 🪙** mais vous n'avez que **${senderWallet?.wallet ?? 0} 🪙** en portefeuille.`)],
      });
      return;
    }

    let receiverWallet = await prisma.economyWallet.findUnique({
      where: { guildId_userId: { guildId: interaction.guild.id, userId: targetUser.id } },
    });

    if (!receiverWallet) {
      receiverWallet = await prisma.economyWallet.create({
        data: {
          guildId: interaction.guild.id,
          userId: targetUser.id,
          wallet: 0,
          bank: 0,
          totalEarned: 0,
        },
      });
    }

    await prisma.$transaction([
      prisma.economyWallet.update({
        where: { guildId_userId: { guildId: interaction.guild.id, userId: interaction.user.id } },
        data: { wallet: { decrement: amount } },
      }),
      prisma.economyWallet.update({
        where: { guildId_userId: { guildId: interaction.guild.id, userId: targetUser.id } },
        data: { wallet: { increment: amount } },
      }),
      prisma.economyTransaction.create({
        data: {
          guildId: interaction.guild.id,
          fromUserId: interaction.user.id,
          toUserId: targetUser.id,
          amount,
          type: 'TRANSFER',
          description: `Transfert de ${interaction.user.username} vers ${targetUser.username}`,
        },
      }),
    ]);

    await interaction.editReply({
      embeds: [successEmbed('Transfert effectué', `**${amount} 🪙** ont été transférés à **${targetUser.username}**.`)],
    });
  } catch (error) {
    console.error(error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible d\'effectuer le transfert.')] });
  }
}
