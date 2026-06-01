import { SlashCommandBuilder, CommandInteraction, Client } from 'discord.js';
import { isEconomyActive } from '../../services/economy';
import { getUserInventory } from '../../services/inventory';
import { createEmbed, errorEmbed } from '../../services/embed';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('Voir votre inventaire d\'objets consommables');

export const module = 'economy';

export async function execute(interaction: CommandInteraction, _client: Client): Promise<void> {
  if (!interaction.guild) return;

  if (!(await isEconomyActive(interaction.guild.id))) {
    await interaction.reply({ embeds: [errorEmbed('Module désactivé', 'L\'économie n\'est pas activée.')], ephemeral: true });
    return;
  }

  const inventory = await getUserInventory(interaction.guild.id, interaction.user.id);

  const embed = createEmbed('economy')
    .setTitle(`🎒 Inventaire de ${interaction.user.username}`)
    .setTimestamp();

  if (inventory.length === 0) {
    embed.setDescription('Votre inventaire est vide. Utilisez `/shop` pour voir les articles disponibles.');
  } else {
    embed.setDescription('Utilisez `/use <item>` pour consommer un objet.');
    
    for (const entry of inventory) {
      const item = entry.item;
      let description = item.description || '—';
      
      // Ajouter des détails selon le type
      if (item.type === 'XP_BOOST') {
        description += `\n📈 Boost XP x${item.effectValue || 2} (${item.duration || 3600}s)`;
      } else if (item.type === 'ANTI_THEFT') {
        description += `\n🛡️ Protection anti-vol (${item.duration || 3600}s)`;
      } else if (item.type === 'LOTTO_TICKET') {
        description += `\n🎟️ Ticket de loto`;
      }
      
      embed.addFields({
        name: `${item.name} x${entry.quantity}`,
        value: description,
      });
    }
  }

  await interaction.reply({ embeds: [embed] });
}
