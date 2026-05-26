import { SlashCommandBuilder, CommandInteraction, Client } from 'discord.js';
import { getEconomySettings } from '../../services/economy';
import { createEmbed, errorEmbed } from '../../services/embed';

export const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('Voir la boutique du serveur');

export const module = 'economy';

export async function execute(interaction: CommandInteraction, _client: Client): Promise<void> {
  if (!interaction.guild) return;

  const settings = await getEconomySettings(interaction.guild.id);
  if (!settings.enabled) {
    await interaction.reply({ embeds: [errorEmbed('Module désactivé', 'L\'économie n\'est pas activée.')], ephemeral: true });
    return;
  }

  const embed = createEmbed('economy')
    .setTitle(`🛒 Boutique — ${settings.currencyName}`)
    .setDescription('Utilisez `/buy` avec le nom de l\'article.')
    .setTimestamp();

  if (settings.shopItems.length === 0) {
    embed.addFields({ name: 'Vide', value: 'Aucun article configuré sur le dashboard.' });
  } else {
    for (const item of settings.shopItems) {
      embed.addFields({
        name: `${item.name} — ${item.price} ${settings.currencySymbol}`,
        value: item.description || (item.roleId ? `Rôle: <@&${item.roleId}>` : '—'),
      });
    }
  }

  await interaction.reply({ embeds: [embed] });
}
