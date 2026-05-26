import { SlashCommandBuilder, CommandInteraction, Client, EmbedBuilder } from 'discord.js';
import { prisma } from '@pinguin/db';
import { getEconomySettings } from '../../services/economy';
import { errorEmbed } from '../../services/embed';

export const data = new SlashCommandBuilder()
  .setName('economyleaderboard')
  .setDescription('Classement économique du serveur');

export const module = 'economy';

export async function execute(interaction: CommandInteraction, _client: Client): Promise<void> {
  await interaction.deferReply();
  if (!interaction.guild) return;

  const settings = await getEconomySettings(interaction.guild.id);
  const wallets = await prisma.economyWallet.findMany({
    where: { guildId: interaction.guild.id },
    orderBy: { wallet: 'desc' },
    take: 10,
  });

  const embed = new EmbedBuilder()
    .setTitle(`🏆 Classement — ${settings.currencyName}`)
    .setColor(0xffd700);

  if (wallets.length === 0) {
    embed.setDescription('Aucun joueur pour le moment.');
  } else {
    const lines = await Promise.all(
      wallets.map(async (w, i) => {
        const user = await interaction.client.users.fetch(w.userId).catch(() => null);
        const total = w.wallet + w.bank;
        return `**${i + 1}.** ${user?.username ?? w.userId} — ${total} ${settings.currencySymbol}`;
      })
    );
    embed.setDescription(lines.join('\n'));
  }

  await interaction.editReply({ embeds: [embed] });
}
