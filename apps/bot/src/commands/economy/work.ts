import { SlashCommandBuilder, CommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { getEconomySettings, getOrCreateWallet, formatCoins } from '../../services/economy';
import { successEmbed, errorEmbed } from '../../services/embed';

const workCooldowns = new Map<string, number>();

export const data = new SlashCommandBuilder()
  .setName('work')
  .setDescription('Travailler pour gagner de la monnaie');

export const module = 'economy';

export async function execute(interaction: CommandInteraction, _client: Client): Promise<void> {
  await interaction.deferReply();
  if (!interaction.guild) return;

  const settings = await getEconomySettings(interaction.guild.id);
  if (!settings.enabled) {
    await interaction.editReply({ embeds: [errorEmbed('Module désactivé', 'L\'économie n\'est pas activée sur ce serveur.')] });
    return;
  }

  await ensureUser(interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL());
  const key = `${interaction.guild.id}:${interaction.user.id}`;
  const last = workCooldowns.get(key) ?? 0;
  const cooldownMs = settings.workCooldown * 1000;
  if (Date.now() - last < cooldownMs) {
    const remaining = Math.ceil((cooldownMs - (Date.now() - last)) / 1000);
    await interaction.editReply({ embeds: [errorEmbed('Cooldown', `Reviens dans **${remaining}s**.`)] });
    return;
  }

  const amount = Math.floor(Math.random() * (settings.workMax - settings.workMin + 1)) + settings.workMin;
  const wallet = await getOrCreateWallet(interaction.guild.id, interaction.user.id, settings.startupBalance);
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
      description: 'Travail',
    },
  });
  workCooldowns.set(key, Date.now());

  await interaction.editReply({
    embeds: [successEmbed('Travail terminé', `Tu as gagné ${formatCoins(amount, settings.currencySymbol, settings.currencyName)} !\nSolde : ${formatCoins(newBalance, settings.currencySymbol, settings.currencyName)}`)],
  });
}
