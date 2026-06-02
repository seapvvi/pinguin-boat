import { SlashCommandBuilder, ChatInputCommandInteraction, Client, GuildMember } from 'discord.js';
import { infoEmbed, createEmbed } from '../../services/embed';

export const data = new SlashCommandBuilder()
  .setName('info')
  .setDescription('Voir les informations d\'un utilisateur ou du serveur')
  .addUserOption((opt) => opt.setName('user').setDescription('Utilisateur à consulter'));

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const targetUser = interaction.options.get('user')?.user ?? interaction.user;

  if (!interaction.guild) return;
  const member = interaction.guild.members.cache.get(targetUser.id) as GuildMember | undefined;

  const embed = createEmbed('default')
    .setTitle(`ℹ️ ${targetUser.username}`)
    .setThumbnail(targetUser.displayAvatarURL({ forceStatic: false }))
    .addFields(
      { name: 'ID', value: targetUser.id, inline: true },
      { name: 'Tag', value: targetUser.username, inline: true },
      { name: 'Bot', value: targetUser.bot ? 'Oui' : 'Non', inline: true },
      { name: 'Compte créé', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: true }
    )
    .setTimestamp();

  if (member) {
    embed.addFields(
      { name: 'Surnom', value: member.nickname || 'Aucun', inline: true },
      { name: 'Rejoint le', value: `<t:${Math.floor((member.joinedAt?.getTime() || 0) / 1000)}:R>`, inline: true },
      { name: 'Rôles', value: member.roles.cache.filter((r) => r.id !== interaction.guild!.id).map((r) => r.toString()).join(' ') || 'Aucun', inline: false }
    );
  }

  await interaction.reply({ embeds: [embed] });
}
