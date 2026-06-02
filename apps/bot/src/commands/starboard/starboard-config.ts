import { SlashCommandBuilder, ChatInputCommandInteraction, Client, ChannelType } from 'discord.js';
import { getStarboardSettings, setStarboardChannel, setStarboardSettings } from '../../services/starboard';
import { successEmbed, errorEmbed, createEmbed } from '../../services/embed';
import { isModuleEnabled } from '../../guards/module';
import { logger } from '@pinguin/shared';

export const data = new SlashCommandBuilder()
  .setName('starboard')
  .setDescription('Configurer le starboard')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('channel')
      .setDescription('Définir le canal starboard')
      .addChannelOption((opt) =>
        opt
          .setName('canal')
          .setDescription('Le canal où les messages mis en avant seront envoyés')
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('settings')
      .setDescription('Configurer les paramètres du starboard')
      .addStringOption((opt) =>
        opt
          .setName('emoji')
          .setDescription('L\'emoji à utiliser pour les étoiles')
          .setRequired(false)
      )
      .addIntegerOption((opt) =>
        opt
          .setName('min_stars')
          .setDescription('Nombre minimum d\'étoiles pour mettre en avant')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(100)
      )
      .addBooleanOption((opt) =>
        opt
          .setName('self_star')
          .setDescription('Permettre aux utilisateurs de mettre en avant leurs propres messages')
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('toggle')
      .setDescription('Activer ou désactiver le starboard')
  );

export const module = 'starboard';

export async function execute(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  await interaction.deferReply();

  if (!interaction.guild) return;

  try {
    if (!(await isModuleEnabled(interaction.guild.id, 'starboard'))) {
      await interaction.editReply({ embeds: [errorEmbed('Module désactivé', 'Le module starboard est désactivé sur ce serveur.')] });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'channel': {
        const channel = interaction.options.getChannel('canal', true);
        
        await setStarboardChannel(interaction.guild.id, channel.id);
        
        const embed = successEmbed(
          'Canal starboard configuré',
          `Les messages mis en avant seront envoyés dans ${channel}.`
        );
        
        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'settings': {
        const emoji = interaction.options.getString('emoji');
        const minStars = interaction.options.getInteger('min_stars');
        const selfStar = interaction.options.getBoolean('self_star');

        const currentSettings = await getStarboardSettings(interaction.guild.id);
        
        const updates: any = {};
        if (emoji !== null) updates.starEmoji = emoji;
        if (minStars !== null) updates.minStars = minStars;
        if (selfStar !== null) updates.selfStar = selfStar;

        await setStarboardSettings(interaction.guild.id, updates);

        const embed = successEmbed(
          'Paramètres starboard mis à jour',
          `Emoji: ${updates.starEmoji ?? currentSettings.starEmoji}\n` +
          `Minimum d'étoiles: ${updates.minStars ?? currentSettings.minStars}\n` +
          `Auto-étoile: ${updates.selfStar !== undefined ? (updates.selfStar ? 'Oui' : 'Non') : (currentSettings.selfStar ? 'Oui' : 'Non')}`
        );

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'toggle': {
        const currentSettings = await getStarboardSettings(interaction.guild.id);
        const newState = !currentSettings.enabled;

        await setStarboardSettings(interaction.guild.id, { enabled: newState });

        const embed = successEmbed(
          'Starboard ' + (newState ? 'activé' : 'désactivé'),
          `Le starboard est maintenant ${newState ? 'activé' : 'désactivé'}.`
        );

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      default:
        await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Sous-commande inconnue.')] });
    }
  } catch (error) {
    logger.error('Starboard config error', { err: error instanceof Error ? error.message : String(error) });
    await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Une erreur est survenue lors de la configuration.')] });
  }
}