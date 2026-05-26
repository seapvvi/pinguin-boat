import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { ensureUser } from '../../services/user';
import { getEconomySettings, getOrCreateWallet } from '../../services/economy';
import { errorEmbed, createEmbed } from '../../services/embed';

export const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription('Voir votre solde ou celui d\'un autre membre')
  .addUserOption((opt) => opt.setName('user').setDescription('Utilisateur à consulter'));

export const module = 'economy';

export async function execute(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  await interaction.deferReply();
  if (!interaction.guild) return;

  const targetUser = interaction.options.getUser('user') ?? interaction.user;
  const settings = await getEconomySettings(interaction.guild.id);

  try {
    await ensureUser(targetUser.id, targetUser.username, targetUser.displayAvatarURL());
    const wallet = await getOrCreateWallet(interaction.guild.id, targetUser.id, settings.startupBalance);
    const sym = settings.currencySymbol;

    const embed = createEmbed('economy')
      .setTitle(`💰 Solde de ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: 'Portefeuille', value: `${wallet.wallet} ${sym}`, inline: true },
        { name: 'Banque', value: `${wallet.bank} ${sym}`, inline: true },
        { name: 'Total', value: `${wallet.wallet + wallet.bank} ${sym}`, inline: true },
        { name: 'Gagné au total', value: `${wallet.totalEarned} ${sym}`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch {
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de récupérer le solde.')] });
  }
}
