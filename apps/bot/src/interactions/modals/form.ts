import { ModalSubmitInteraction, Client } from 'discord.js';
import { registry } from '../registry';
import { errorEmbed, successEmbed, createEmbed } from '../../services/embed';
import { getFormTemplate, createFormSubmission, getFormSettings } from '../../services/forms';
import { logger } from '@pinguin/shared';

async function handleFormSubmit(interaction: ModalSubmitInteraction, client: Client): Promise<void> {
  if (!interaction.guild) return;

  const templateId = interaction.customId.replace('form_submit_', '');
  
  const template = await getFormTemplate(templateId);
  if (!template) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Formulaire introuvable.')], ephemeral: true });
    return;
  }

  let fields: any[];
  try {
    fields = JSON.parse(template.fields);
  } catch {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Formulaire corrompu.')], ephemeral: true });
    return;
  }
  const responses: any[] = [];

  for (const field of fields) {
    const value = interaction.fields.getTextInputValue(`field_${field.label}`);
    responses.push({
      label: field.label,
      value,
    });
  }

  // Create submission
  const submission = await createFormSubmission(
    interaction.guild.id,
    templateId,
    interaction.user.id,
    responses
  );

  // Send to submission channel
  const settings = await getFormSettings(interaction.guild.id);
  if (settings.channelId) {
    try {
      const channel = await interaction.guild.channels.fetch(settings.channelId);
      if (channel && channel.isTextBased()) {
        const embed = createEmbed('form')
          .setTitle(`📋 Nouvelle soumission: ${template.name}`)
          .setAuthor({
            name: interaction.user.username,
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setDescription(template.description || '')
          .setTimestamp();

        responses.forEach((response, index) => {
          embed.addFields({
            name: response.label,
            value: response.value || '*Non renseigné*',
            inline: false,
          });
        });

        embed.addFields({
          name: 'ID de soumission',
          value: submission.id,
          inline: true,
        });

        embed.addFields({
          name: 'Utilisateur',
          value: `<@${interaction.user.id}>`,
          inline: true,
        });

        await channel.send({ embeds: [embed] });
      }
    } catch (err) {
      logger.error('Error sending form submission', { err: err instanceof Error ? err.message : String(err) });
    }
  }

  // Send to log channel if configured
  if (settings.logChannel) {
    try {
      const logChannel = await interaction.guild.channels.fetch(settings.logChannel);
      if (logChannel && logChannel.isTextBased()) {
        await logChannel.send({
          content: `📝 Nouvelle soumission de formulaire par ${interaction.user} (${interaction.user.id})\nFormulaire: ${template.name}\nID: ${submission.id}`,
        });
      }
    } catch (err) {
      logger.error('Error sending form log', { err: err instanceof Error ? err.message : String(err) });
    }
  }

  await interaction.reply({
    embeds: [successEmbed('Formulaire soumis', 'Votre réponse a été enregistrée avec succès !')],
    ephemeral: true,
  });
}

registry.registerModal('form_submit_', 'prefix', handleFormSubmit);
