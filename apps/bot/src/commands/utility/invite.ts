import { SlashCommandBuilder, CommandInteraction, Client } from 'discord.js';
import { infoEmbed, createEmbed } from '../../services/embed';
import { getConfig } from '@pinguin/config';

export const data = new SlashCommandBuilder()
  .setName('invite')
  .setDescription('Obtenir le lien d\'invitation du bot');

export async function execute(interaction: CommandInteraction, client: Client): Promise<void> {
  const config = getConfig();

  const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${config.DISCORD_CLIENT_ID}&permissions=8&scope=bot%20applications.commands`;

  const embed = createEmbed('default')
    .setTitle('🔗 Inviter Pinguin BOAT')
    .setDescription(`[Cliquez ici pour m'inviter sur votre serveur !](${inviteUrl})`)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
