import { SlashCommandBuilder, ChatInputCommandInteraction, Client, ChannelType } from 'discord.js';
import { 
  getFormSettings, 
  setFormChannel, 
  createFormTemplate, 
  getEnabledTemplates,
  deleteFormTemplate 
} from '../../services/forms';
import { successEmbed, errorEmbed, createEmbed } from '../../services/embed';
import { isModuleEnabled } from '../../guards/module';

export const data = new SlashCommandBuilder()
  .setName('forms')
  .setDescription('Configurer les formulaires')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('channel')
      .setDescription('Définir les canaux pour les formulaires')
      .addChannelOption((opt) =>
        opt
          .setName('soumissions')
          .setDescription('Le canal où les formulaires seront envoyés')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)
      )
      .addChannelOption((opt) =>
        opt
          .setName('logs')
          .setDescription('Le canal où les logs des formulaires seront envoyés')
          .setRequired(false)
          .addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('create')
      .setDescription('Créer un nouveau formulaire')
      .addStringOption((opt) =>
        opt
          .setName('nom')
          .setDescription('Le nom du formulaire')
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('description')
          .setDescription('La description du formulaire')
          .setRequired(false)
      )
      .addStringOption((opt) =>
        opt
          .setName('champs')
          .setDescription('Les champs du formulaire en JSON')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('list')
      .setDescription('Lister tous les formulaires')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('delete')
      .setDescription('Supprimer un formulaire')
      .addStringOption((opt) =>
        opt
          .setName('id')
          .setDescription('L\'ID du formulaire à supprimer')
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('toggle')
      .setDescription('Activer ou désactiver le module formulaires')
  );

export const module = 'forms';

export async function execute(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guild) return;

  try {
    if (!(await isModuleEnabled(interaction.guild.id, 'forms'))) {
      await interaction.editReply({ embeds: [errorEmbed('Module désactivé', 'Le module formulaires est désactivé sur ce serveur.')] });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'channel': {
        const submissionsChannel = interaction.options.getChannel('soumissions', true);
        const logsChannel = interaction.options.getChannel('logs');
        
        await setFormChannel(
          interaction.guild.id, 
          submissionsChannel.id, 
          logsChannel?.id || null
        );
        
        const embed = successEmbed(
          'Canaux formulaires configurés',
          `Les soumissions seront envoyées dans ${submissionsChannel}.` +
          (logsChannel ? `\nLes logs seront envoyés dans ${logsChannel}.` : '')
        );
        
        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'create': {
        const name = interaction.options.getString('nom', true);
        const description = interaction.options.getString('description');
        const fieldsJson = interaction.options.getString('champs', true);

        let fields;
        try {
          fields = JSON.parse(fieldsJson);
        } catch (e) {
          await interaction.editReply({ 
            embeds: [errorEmbed('JSON invalide', 'Le format des champs est invalide. Utilisez un format JSON valide.')] 
          });
          return;
        }

        if (!Array.isArray(fields) || fields.length === 0) {
          await interaction.editReply({ 
            embeds: [errorEmbed('Champs invalides', 'Les champs doivent être un tableau non vide.')] 
          });
          return;
        }

        // Validate field structure
        for (const field of fields) {
          if (!field.label || !field.type) {
            await interaction.editReply({ 
              embeds: [errorEmbed('Champ invalide', 'Chaque champ doit avoir un "label" et un "type".')] 
            });
            return;
          }
        }

        const template = await createFormTemplate(
          interaction.guild.id,
          name,
          description,
          fields
        );

        const embed = successEmbed(
          'Formulaire créé',
          `Le formulaire "${name}" a été créé avec l'ID: \`${template.id}\`\n\n` +
          `Utilisez \`/forms submit\` avec cet ID pour remplir le formulaire.`
        );

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'list': {
        const settings = await getFormSettings(interaction.guild.id);
        const templates = settings.templates || [];

        if (templates.length === 0) {
          await interaction.editReply({ 
            embeds: [errorEmbed('Aucun formulaire', 'Aucun formulaire n\'a été créé. Utilisez `/forms create` pour en créer un.')] 
          });
          return;
        }

        const embed = createEmbed('form')
          .setTitle('📋 Formulaires')
          .setDescription(`${templates.length} formulaire(s) disponible(s)`)
          .setTimestamp();

        templates.forEach((template, index) => {
          embed.addFields({
            name: `${index + 1}. ${template.name}`,
            value: `ID: \`${template.id}\`\n${template.description ? template.description : 'Pas de description'}\n${template.enabled ? '✅ Activé' : '❌ Désactivé'}`,
            inline: false,
          });
        });

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'delete': {
        const templateId = interaction.options.getString('id', true);

        await deleteFormTemplate(templateId);

        const embed = successEmbed(
          'Formulaire supprimé',
          `Le formulaire avec l'ID \`${templateId}\` a été supprimé.`
        );

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'toggle': {
        const currentSettings = await getFormSettings(interaction.guild.id);
        const newState = !currentSettings.enabled;

        await setFormChannel(
          interaction.guild.id, 
          currentSettings.channelId, 
          currentSettings.logChannel
        );

        const embed = successEmbed(
          'Module formulaires ' + (newState ? 'activé' : 'désactivé'),
          `Le module formulaires est maintenant ${newState ? 'activé' : 'désactivé'}.`
        );

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      default:
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Sous-commande inconnue.')] });
    }
  } catch (error) {
    console.error('Forms config error:', error);
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Une erreur est survenue lors de la configuration.')] });
  }
}