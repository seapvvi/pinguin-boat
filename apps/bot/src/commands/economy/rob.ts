import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { getEconomySettings, getOrCreateWallet, formatCoins, isEconomyActive } from '../../services/economy';
import { successEmbed, errorEmbed } from '../../services/embed';

const robCooldowns = new Map<string, number>();

export const data = new SlashCommandBuilder()
  .setName('rob')
  .setDescription('Tenter de voler un autre membre')
  .addUserOption((o) => o.setName('cible').setDescription('Membre à voler').setRequired(true));

export const module = 'economy';

export async function execute(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  await interaction.deferReply();
  if (!interaction.guild) return;

  if (!(await isEconomyActive(interaction.guild.id))) {
    await interaction.editReply({ embeds: [errorEmbed('Module désactivé', 'L\'économie n\'est pas activée.')] });
    return;
  }
  const settings = await getEconomySettings(interaction.guild.id);
  if (!settings.robberyEnabled) {
    await interaction.editReply({ embeds: [errorEmbed('Interdit', 'Le vol n\'est pas activé sur ce serveur.')] });
    return;
  }

  const target = interaction.options.getUser('cible', true);
  if (target.id === interaction.user.id || target.bot) {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Cible invalide.')] });
    return;
  }

  const key = `${interaction.guild.id}:${interaction.user.id}`;
  const last = robCooldowns.get(key) ?? 0;
  if (Date.now() - last < settings.robberyCooldown * 1000) {
    const remaining = Math.ceil((settings.robberyCooldown * 1000 - (Date.now() - last)) / 1000);
    await interaction.editReply({ embeds: [errorEmbed('Cooldown', `Reviens dans **${remaining}s**.`)] });
    return;
  }

  await ensureUser(interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL());
  const victimWallet = await getOrCreateWallet(interaction.guild.id, target.id, settings.startupBalance);
  if (victimWallet.wallet < 10) {
    await interaction.editReply({ embeds: [errorEmbed('Échec', 'La cible n\'a presque rien à voler.')] });
    return;
  }

  robCooldowns.set(key, Date.now());
  const success = Math.random() < 0.4;
  const robberWallet = await getOrCreateWallet(interaction.guild.id, interaction.user.id, settings.startupBalance);

  if (!success) {
    const fine = Math.min(50, robberWallet.wallet);
    await prisma.economyWallet.update({
      where: { guildId_userId: { guildId: interaction.guild.id, userId: interaction.user.id } },
      data: { wallet: { decrement: fine } },
    });
    await interaction.editReply({ embeds: [errorEmbed('Échec', `Tu t'es fait attraper ! Amende : **${fine}** ${settings.currencySymbol}`)] });
    return;
  }

  const stolen = Math.min(
    Math.floor(Math.random() * settings.robberyMaxAmount) + 1,
    victimWallet.wallet
  );

  await prisma.$transaction([
    prisma.economyWallet.update({
      where: { guildId_userId: { guildId: interaction.guild.id, userId: target.id } },
      data: { wallet: { decrement: stolen } },
    }),
    prisma.economyWallet.update({
      where: { guildId_userId: { guildId: interaction.guild.id, userId: interaction.user.id } },
      data: { wallet: { increment: stolen }, totalEarned: { increment: stolen } },
    }),
  ]);

  await interaction.editReply({
    embeds: [successEmbed('Vol réussi', `Tu as volé ${formatCoins(stolen, settings.currencySymbol, settings.currencyName)} à **${target.username}** !`)],
  });
}
