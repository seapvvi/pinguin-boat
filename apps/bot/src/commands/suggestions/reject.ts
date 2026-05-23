import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits } from 'discord.js';
import { prisma } from '@pinguin/db';
import { infoEmbed, errorEmbed, successEmbed, createEmbed } from '../../services/embed';
import { log } from '../../services/logger';

export const data = new SlashCommandBuilder()
  .setName('reject')
  .setDescription('Rejeter une suggestion')
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
        status: 'REJECTED',
        staffResponse: response ?? null,
        staffResponderId: interaction.user.id,
      },
    });

    try {
      const channel = await interaction.guild.channels.fetch(suggestion.channelId);
      if (channel?.isTextBased()) {
        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (msg) {
          const embed = createEmbed('suggestion')
            .setTitle('💡 Suggestion refusée ❌')
            .setDescription(suggestion.content)
            .addFields(
              { name: 'Refusé par', value: interaction.user.toString(), inline: true },
              { name: 'Réponse', value: response || 'Aucune réponse fournie.', inline: false }
            )
            .setTimestamp();
          await msg.edit({ embeds: [embed] });
        }
      }
    } catch {}

    await interaction.editReply({ embeds: [successEmbed('Suggestion refusée', 'La suggestion a été refusée.')] });
    log({ level: 'info', message: `Suggestion refusée: ${suggestion.id}`, guildId: interaction.guild.id, userId: interaction.user.id });
  } catch (error) {
    console.error(error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Impossible de refuser la suggestion.')] });
  }
}
