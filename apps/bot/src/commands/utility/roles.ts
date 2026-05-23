import { SlashCommandBuilder, CommandInteraction, Client } from 'discord.js';
import { infoEmbed, createEmbed } from '../../services/embed';

export const data = new SlashCommandBuilder()
  .setName('roles')
  .setDescription('Voir la liste des rôles du serveur');

export async function execute(interaction: CommandInteraction, client: Client): Promise<void> {
  if (!interaction.guild) return;

  const roles = interaction.guild.roles.cache
    .filter((r) => r.id !== interaction.guild!.id)
    .sort((a, b) => b.position - a.position);

  if (roles.size === 0) {
    await interaction.reply({ embeds: [infoEmbed('Rôles', 'Aucun rôle sur ce serveur.')], ephemeral: true });
    return;
  }

  const roleList = roles.map((r) => `${r.toString()} — **${r.members.size}** membre(s)`).join('\n');

  const embed = createEmbed('default')
    .setTitle(`📋 Rôles (${roles.size})`)
    .setDescription(roleList.length > 2000 ? roleList.substring(0, 1900) + '\n...' : roleList)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
