import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { infoEmbed, errorEmbed, createEmbed } from '../../services/embed';

export const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription('Voir votre solde ou celui d\'un autre membre')
  .addUserOption((opt) => opt.setName('user').setDescription('Utilisateur à consulter'));

export const module = 'economy';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply();

  const targetUser = interaction.options.get('user')?.user ?? interaction.user;

  if (!interaction.guild) return;

  try {
    await ensureUser(targetUser.id, targetUser.username, targetUser.displayAvatarURL());

    let wallet = await prisma.economyWallet.findUnique({
      where: { guildId_userId: { guildId: interaction.guild.id, userId: targetUser.id } },
    });

    if (!wallet) {
      wallet = await prisma.economyWallet.create({
        data: {
          guildId: interaction.guild.id,
          userId: targetUser.id,
          wallet: 0,
          bank: 0,
          totalEarned: 0,
        },
      });
    }

    const embed = createEmbed('economy')
      .setTitle(`💰 Solde de ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: 'Portefeuille', value: `${wallet.wallet} 🪙`, inline: true },
        { name: 'Banque', value: `${wallet.bank} 🪙`, inline: true },
        { name: 'Total', value: `${wallet.wallet + wallet.bank} 🪙`, inline: true },
        { name: 'Gagné au total', value: `${wallet.totalEarned} 🪙`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error(error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de récupérer le solde.')] });
  }
}
