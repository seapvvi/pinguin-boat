import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { ensureUser } from '../../services/user';
import { infoEmbed, errorEmbed, successEmbed, createEmbed } from '../../services/embed';
import { log } from '../../services/logger';
import { logger } from '@pinguin/shared';

export const data = new SlashCommandBuilder()
  .setName('suggest')
  .setDescription('Faire une suggestion pour le serveur')
  .addStringOption((opt) => opt.setName('content').setDescription('Contenu de votre suggestion').setRequired(true));

export const module = 'suggestions';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const content = interaction.options.getString('content', true);

  if (!interaction.guild) return;

  try {
    const settings = await prisma.guildSettings.findUnique({ where: { guildId: interaction.guild.id } });
    const suggestionChannelId = settings?.suggestionChannelId || settings?.modLogChannel;

    await ensureUser(interaction.user.id, interaction.user.username, interaction.user.displayAvatarURL());

    const suggestion = await prisma.suggestion.create({
      data: {
        guildId: interaction.guild.id,
        channelId: interaction.channelId,
        authorId: interaction.user.id,
        content,
        status: 'PENDING',
      },
    });

    const embed = createEmbed('suggestion')
      .setTitle('💡 Nouvelle suggestion')
      .setDescription(content)
      .addFields(
        { name: 'Auteur', value: interaction.user.toString(), inline: true },
        { name: 'Statut', value: '⏳ En attente', inline: true },
        { name: 'ID', value: suggestion.id, inline: true }
      )
      .setTimestamp();

    const targetChannelId = suggestionChannelId || interaction.channelId;
    const channel = interaction.guild.channels.cache.get(targetChannelId);
    if (channel?.isTextBased()) {
      const msg = await channel.send({ embeds: [embed] });
      await msg.react('👍');
      await msg.react('👎');
      await prisma.suggestion.update({
        where: { id: suggestion.id },
        data: { messageId: msg.id, channelId: channel.id },
      });
    }

    await interaction.editReply({
      embeds: [successEmbed('Suggestion envoyée', 'Votre suggestion a été envoyée avec succès.')],
    });

    log({ level: 'info', message: `Suggestion: ${content.slice(0, 50)}...`, guildId: interaction.guild.id });
  } catch (error) {
    logger.error('Erreur lors de l\'envoi de la suggestion', { err: error instanceof Error ? error.message : String(error) });
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible d\'envoyer votre suggestion.')] });
  }
}
