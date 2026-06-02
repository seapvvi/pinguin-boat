import { SlashCommandBuilder, CommandInteraction, Client, ChannelType } from 'discord.js';
import { createEmbed } from '../../services/embed';

export const data = new SlashCommandBuilder()
  .setName('serverinfo')
  .setDescription('Voir les informations du serveur');

export async function execute(interaction: CommandInteraction, client: Client): Promise<void> {
  if (!interaction.guild) return;

  const guild = interaction.guild;
  const owner = await guild.fetchOwner();
  const channels = guild.channels.cache;
  const textChannels = channels.filter((c) => c.type === ChannelType.GuildText).size;
  const voiceChannels = channels.filter((c) => c.type === ChannelType.GuildVoice).size;
  const categories = channels.filter((c) => c.type === ChannelType.GuildCategory).size;
  const roles = guild.roles.cache.size;
  const boostLevel = guild.premiumTier;
  const boostCount = guild.premiumSubscriptionCount ?? 0;

  const embed = createEmbed('default')
    .setTitle(`ℹ️ ${guild.name}`)
    .setThumbnail(guild.iconURL({ forceStatic: false }))
    .addFields(
      { name: 'ID', value: guild.id, inline: true },
      { name: 'Propriétaire', value: owner.user.username, inline: true },
      { name: 'Membres', value: `${guild.memberCount}`, inline: true },
      { name: 'Salons', value: `📝 ${textChannels} textuels | 🔊 ${voiceChannels} vocaux | 📁 ${categories} catégories`, inline: false },
      { name: 'Rôles', value: `${roles}`, inline: true },
      { name: 'Nitro Boost', value: `Niveau ${boostLevel} (${boostCount} boosts)`, inline: true },
      { name: 'Créé le', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
