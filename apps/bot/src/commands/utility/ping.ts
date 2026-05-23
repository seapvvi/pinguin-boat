import { SlashCommandBuilder, CommandInteraction, Client } from 'discord.js';
import { createEmbed } from '../../services/embed';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Voir la latence du bot');

export async function execute(interaction: CommandInteraction, client: Client): Promise<void> {
  const sent = await interaction.reply({ content: 'Calcul de la latence...', fetchReply: true });
  const latency = sent.createdTimestamp - interaction.createdTimestamp;
  const apiLatency = Math.round(client.ws.ping);

  const embed = createEmbed('info')
    .setTitle('🏓 Pong !')
    .addFields(
      { name: 'Latence du bot', value: `${latency}ms`, inline: true },
      { name: 'Latence API', value: `${apiLatency}ms`, inline: true }
    );

  await interaction.editReply({ content: null, embeds: [embed] });
}
