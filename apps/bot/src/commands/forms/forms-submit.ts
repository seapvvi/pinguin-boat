import { SlashCommandBuilder, ChatInputCommandInteraction, Client, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType } from 'discord.js';
import { 
  getFormSettings, 
  getEnabledTemplates, 
  getFormTemplate, 
  createFormSubmission 
} from '../../services/forms';
import { successEmbed, errorEmbed, createEmbed } from '../../services/embed';
import { isModuleEnabled } from '../../guards/module';
import { logger } from '@pinguin/shared';

export const data = new SlashCommandBuilder()
  .setName('form-submit')
  .setDescription('Remplir un formulaire')
  .addStringOption((opt) =>
    opt
      .setName('formulaire')
      .setDescription('Le formulaire à remplir')
      .setRequired(true)
      .setAutocomplete(true)
  );

export const module = 'forms';

export async function execute(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  if (!interaction.guild) return;

  try {
    if (!(await isModuleEnabled(interaction.guild.id, 'forms'))) {
      await interaction.reply({ embeds: [errorEmbed('Module désactivé', 'Le module formulaires est désactivé sur ce serveur.')], ephemeral: true });
      return;
    }

    const templateId = interaction.options.getString('formulaire', true);
    const template = await getFormTemplate(templateId);

    if (!template || !template.enabled) {
      await interaction.reply({ embeds: [errorEmbed('Formulaire introuvable', 'Ce formulaire n\'existe pas ou est désactivé.')], ephemeral: true });
      return;
    }

    if (template.guildId !== interaction.guild.id) {
      await interaction.reply({ embeds: [errorEmbed('Accès refusé', 'Ce formulaire n\'appartient pas à ce serveur.')], ephemeral: true });
      return;
    }

    const fields = JSON.parse(template.fields);

    // Create modal
    const modal = new ModalBuilder()
      .setCustomId(`form_submit_${templateId}`)
      .setTitle(template.name);

    for (const field of fields) {
      // Discord modals only support text inputs. Accept the dashboard's
      // `style` (short/paragraph) and legacy `type` (text/textarea/select).
      const isParagraph = field.style === 'paragraph' || field.type === 'textarea';
      const style = isParagraph ? TextInputStyle.Paragraph : TextInputStyle.Short;
      const textInput = new TextInputBuilder()
        .setCustomId(`field_${field.label}`)
        .setLabel(field.label)
        .setStyle(style)
        .setPlaceholder(field.placeholder || '')
        .setRequired(field.required !== false);

      if (field.maxLength) {
        textInput.setMaxLength(field.maxLength);
      }

      if (field.minLength) {
        textInput.setMinLength(field.minLength);
      }

      const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(textInput);
      modal.addComponents(actionRow);
    }

    await interaction.showModal(modal);

  } catch (error) {
    logger.error('Form submit error', { err: error instanceof Error ? error.message : String(error) });
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Une erreur est survenue lors de l\'ouverture du formulaire.')], ephemeral: true });
  }
}

export async function autocomplete(interaction: any, _client: Client): Promise<void> {
  if (!interaction.guild) return;

  const focusedValue = interaction.options.getFocused();
  const templates = await getEnabledTemplates(interaction.guild.id);

  const filtered = templates
    .filter(t => t.guildId === interaction.guild.id)
    .filter(t => t.name.toLowerCase().includes(focusedValue.toLowerCase()))
    .slice(0, 25);

  await interaction.respond(
    filtered.map(t => ({ name: t.name, value: t.id }))
  );
}