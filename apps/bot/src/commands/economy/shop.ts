import { SlashCommandBuilder, CommandInteraction, Client } from 'discord.js';
import { infoEmbed, errorEmbed, createEmbed } from '../../services/embed';

interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
}

const defaultShop: ShopItem[] = [
  { id: 'role_color', name: 'Rôle coloré', description: 'Un rôle avec une couleur personnalisée', price: 500 },
  { id: 'nickname', name: 'Changer de surnom', description: 'Permet de changer le surnom d\'un membre', price: 200 },
  { id: 'lucky', name: 'Ticket de loterie', description: 'Un ticket pour la loterie hebdomadaire', price: 100 },
];

export const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('Voir la boutique du serveur');

export const module = 'economy';

export async function execute(interaction: CommandInteraction, client: Client): Promise<void> {
  const embed = createEmbed('economy')
    .setTitle('🛒 Boutique')
    .setDescription('Voici les articles disponibles à l\'achat.')
    .setTimestamp();

  for (const item of defaultShop) {
    embed.addFields({
      name: `${item.name} — ${item.price} 🪙`,
      value: item.description,
    });
  }

  await interaction.reply({ embeds: [embed] });
}
