import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits } from 'discord.js';
import { prisma } from '@pinguin/db';
import { infoEmbed, errorEmbed, successEmbed, createEmbed } from '../../services/embed';
import { log } from '../../services/logger';
import { sendDM } from '../../services/dm';

export const data = new SlashCommandBuilder()
  .setName('approve')
  .setDescription('Approuver une suggestion')
  .addStringOption((opt) => opt.setName('message_id').setDescription('ID du message de la suggestion').setRequired(true))
  .addStringOption((opt) => opt.setName('response').setDescription('Réponse du staff'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers);

export const permissions = true;
export const module = 'suggestions';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const messageId = interaction.options.get('message_id')?.value as string;
  const response = interaction.options.get('response')?.value as string | undefined;

  if (!interaction.guild) return;

  try {
    const suggestion = await prisma.suggestion.findFirst({
      where: { messageId, guildId: interaction.guild.id },
    });

    if (!suggestion) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Suggestion introuvable.')] });
      return;
    }

    if (suggestion.status !== 'PENDING') {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Cette suggestion a déjà été traitée.')] });
      return;
    }

    await prisma.suggestion.update({
      where: { id: suggestion.id },
      data: {
        status: 'APPROVED',
        staffResponse: response ?? null,
        staffResponderId: interaction.user.id,
      },
    });

    await sendDM(client, suggestion.authorId, [
      createEmbed('suggestion')
        .setTitle('💡 Suggestion approuvée ✅')
        .setDescription(`Ta suggestion a été approuvée :\n\n${suggestion.content}`)
        .addFields(
          { name: 'Votes', value: `👍 ${suggestion.upvotes} | 👎 ${suggestion.downvotes}`, inline: false },
          ...(response ? [{ name: 'Réponse du staff', value: response, inline: false } as const] : []),
        )
        .setTimestamp(),
    ]);

    try {
      const channel = await interaction.guild.channels.fetch(suggestion.channelId);
      if (channel?.isTextBased()) {
        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (msg) {
          const author = await client.users.fetch(suggestion.authorId).catch(() => null);
          const embed = createEmbed('suggestion')
            .setTitle('💡 Suggestion approuvée ✅')
            .setDescription(suggestion.content)
            .setAuthor({ name: author?.username || 'Utilisateur inconnu', iconURL: author?.displayAvatarURL() })
            .addFields(
              { name: 'Suggestion proposée par', value: author?.toString() || 'Utilisateur inconnu', inline: true },
              { name: 'Approuvé par', value: interaction.user.toString(), inline: true },
              { name: 'Réponse', value: response || 'Aucune réponse fournie.', inline: false },
              { name: 'ID Discord', value: suggestion.authorId, inline: false }
            )
            .setTimestamp();
          await msg.edit({ embeds: [embed] });
        }
      }
    } catch {}

    await interaction.editReply({ embeds: [successEmbed('Suggestion approuvée', 'La suggestion a été approuvée.')] });
    log({ level: 'info', message: `Suggestion approuvée: ${suggestion.id}`, guildId: interaction.guild.id, userId: interaction.user.id });
  } catch (error) {
    console.error(error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible d\'approuver la suggestion.')] });
  }
}
