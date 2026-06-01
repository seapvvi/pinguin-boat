import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { isEconomyActive } from '../../services/economy';
import { useConsumable, findShopItem } from '../../services/inventory';
import { createEmbed, errorEmbed, successEmbed } from '../../services/embed';

export const data = new SlashCommandBuilder()
  .setName('use')
  .setDescription('Utiliser un objet consommable de votre inventaire')
  .addStringOption((opt) =>
    opt.setName('item').setDescription('Nom ou ID de l\'objet à utiliser').setRequired(true)
  );

export const module = 'economy';

export async function execute(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  await interaction.deferReply();
  if (!interaction.guild) return;

  if (!(await isEconomyActive(interaction.guild.id))) {
    await interaction.editReply({ embeds: [errorEmbed('Module désactivé', 'L\'économie n\'est pas activée.')] });
    return;
  }

  const query = interaction.options.getString('item', true);
  const item = await findShopItem(interaction.guild.id, query);

  if (!item) {
    await interaction.editReply({ embeds: [errorEmbed('Objet introuvable', 'Utilisez `/inventory` pour voir vos objets.')] });
    return;
  }

  if (item.type === 'ROLE') {
    await interaction.editReply({ embeds: [errorEmbed('Objet non consommable', 'Les rôles ne sont pas des objets consommables.')] });
    return;
  }

  const result = await useConsumable(interaction.guild.id, interaction.user.id, item.id);

  if (!result.success) {
    await interaction.editReply({ embeds: [errorEmbed('Échec', result.message)] });
    return;
  }

  const embed = successEmbed('Objet utilisé', result.message);
  
  if (result.effect) {
    embed.addFields({
      name: 'Effet appliqué',
      value: `Type: ${result.effect.type}${result.effect.value ? `\nValeur: x${result.effect.value}` : ''}${result.effect.duration ? `\nDurée: ${result.effect.duration}s` : ''}`,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}
