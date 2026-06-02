import { SlashCommandBuilder, CommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { getEconomySettings, getOrCreateWallet, formatCoins, isEconomyActive, getEconomyMultiplier } from '../../services/economy';
import { successEmbed, enrichedErrorEmbed } from '../../services/embed';
import { updateQuestProgress } from '../../services/quests';

const workCooldowns = new Map<string, number>();

export const data = new SlashCommandBuilder()
  .setName('work')
  .setDescription('Travailler pour gagner de la monnaie');

export const module = 'economy';

export async function execute(interaction: CommandInteraction, _client: Client): Promise<void> {
  await interaction.deferReply();
  if (!interaction.guild) return;

  if (!(await isEconomyActive(interaction.guild.id))) {
    await interaction.editReply({ 
      embeds: [enrichedErrorEmbed(
        'Module désactivé',
        'Le module économie n\'est pas activé sur ce serveur.',
        'Activez le module économie dans les paramètres du serveur ou via le dashboard.'
      )] 
    });
    return;
  }
  const settings = await getEconomySettings(interaction.guild.id);

  await ensureUser(interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL());
  const key = `${interaction.guild.id}:${interaction.user.id}`;
  const last = workCooldowns.get(key) ?? 0;
  const cooldownMs = settings.workCooldown * 1000;
  if (Date.now() - last < cooldownMs) {
    const remaining = Math.ceil((cooldownMs - (Date.now() - last)) / 1000);
    await interaction.editReply({ 
      embeds: [enrichedErrorEmbed(
        'Cooldown',
        `Vous devez attendre encore **${remaining}s** avant de pouvoir travailler à nouveau.`,
        'Le temps d\'attente entre chaque travail peut être configuré dans les paramètres du serveur.'
      )] 
    });
    return;
  }

  const multiplier = await getEconomyMultiplier();
  const baseAmount = Math.floor(Math.random() * (settings.workMax - settings.workMin + 1)) + settings.workMin;
  const amount = baseAmount * multiplier;
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

  await updateQuestProgress(interaction.guild.id, interaction.user.id, 'EARN_MONEY', amount);

  const bonusNote = multiplier > 1 ? ` (x${multiplier} — événement actif !)` : '';
  await interaction.editReply({
    embeds: [successEmbed('Travail terminé', `Tu as gagné ${formatCoins(amount, settings.currencySymbol, settings.currencyName)} !${bonusNote}\nSolde : ${formatCoins(newBalance, settings.currencySymbol, settings.currencyName)}`)],
  });
}
