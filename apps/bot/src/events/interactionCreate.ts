import { CommandInteraction, Client, Interaction, AutocompleteInteraction, ButtonInteraction, ModalSubmitInteraction } from 'discord.js';
import { getConfig } from '@pinguin/config';
import { checkCooldown } from '../guards/cooldown';
import { checkModPermissions } from '../guards/permissions';
import { checkInteractionBlacklist } from '../guards/blacklist';
import { requireModule } from '../guards/module';
import { errorEmbed, successEmbed, createEmbed } from '../services/embed';
import { getFormTemplate, createFormSubmission, getFormSettings } from '../services/forms';

async function replyButtonError(interaction: ButtonInteraction, message: string): Promise<void> {
  const payload = { embeds: [errorEmbed('Erreur', message)], ephemeral: true as const };
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload).catch(() => {});
  } else {
    await interaction.reply(payload).catch(() => {});
  }
}

export async function execute(interaction: Interaction, client: Client): Promise<void> {
  if (interaction.isAutocomplete()) {
    await handleAutocomplete(interaction, client);
    return;
  }

  if (interaction.isModalSubmit()) {
    await handleModalSubmit(interaction, client);
    return;
  }

  if (interaction.isButton()) {
    if (!interaction.guildId) {
      await interaction.reply({ embeds: [errorEmbed('Erreur', 'Utilisable uniquement sur un serveur.')], ephemeral: true }).catch(() => {});
      return;
    }

    try {
      if (interaction.customId.startsWith('ticket_')) {
        const moduleCheck = await requireModule(interaction.guildId, 'tickets');
        if (!moduleCheck.enabled) {
          await interaction.reply({ embeds: [errorEmbed('Module désactivé', moduleCheck.message!)], ephemeral: true });
          return;
        }
        const { handleTicketButton } = await import('../commands/tickets/ticket-button');
        await handleTicketButton(interaction, client);
        return;
      }

      if (interaction.customId === 'giveaway_join' || interaction.customId === 'giveaway_join_api') {
        const { handleGiveawayJoin } = await import('../commands/giveaways/giveaway-join');
        await handleGiveawayJoin(interaction, client);
        return;
      }

      // Minigame buttons (blackjack, morpion) are handled by their own
      // per-message component collectors. We must NOT acknowledge them here:
      // doing so races with the collector's i.update() and triggers
      // "Échec de l'interaction" / unhandled rejections that crash the bot.
      if (interaction.customId.startsWith('bj_') || interaction.customId.startsWith('morpion_')) {
        return;
      }
    } catch (err) {
      console.error('[Bot] Erreur bouton:', interaction.customId, err);
      await replyButtonError(interaction, 'Une erreur est survenue. Réessayez dans un instant.');
    }
    return;
  }

  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  const config = getConfig();

  if (!interaction.guildId) {
    await interaction.reply({
      embeds: [errorEmbed('Erreur', 'Cette commande doit être utilisée dans un serveur.')],
      ephemeral: true,
    });
    return;
  }

  const blacklistCheck = await checkInteractionBlacklist(interaction);
  if (blacklistCheck.blacklisted) {
    await interaction.reply({
      embeds: [errorEmbed('Accès refusé', `Vous êtes blacklisté pour infraction.\nRaison : ${blacklistCheck.reason ?? 'Non spécifiée'}\nContestation : ouvrez un ticket sur https://discord.gg/EJHhcYkXMQ`)],
      ephemeral: true,
    });
    return;
  }

  if (command.guards?.cooldown !== false) {
    const cooldownSeconds = command.cooldown ?? 3;
    const cooldownCheck = checkCooldown(interaction, command.data.name, cooldownSeconds);
    if (!cooldownCheck.allowed) {
      await interaction.reply({
        embeds: [errorEmbed('Trop rapide', cooldownCheck.message!)],
        ephemeral: true,
      });
      return;
    }
  }

  if (command.module) {
    const moduleCheck = await requireModule(interaction.guildId, command.module);
    if (!moduleCheck.enabled) {
      await interaction.reply({
        embeds: [errorEmbed('Module désactivé', moduleCheck.message!)],
        ephemeral: true,
      });
      return;
    }
  }

  if (command.permissions) {
    const permCheck = await checkModPermissions(interaction.member as any, command.requireAdmin);
    if (!permCheck.allowed) {
      await interaction.reply({
        embeds: [errorEmbed('Permission refusée', permCheck.message!)],
        ephemeral: true,
      });
      return;
    }
  }

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`[Bot] Erreur commande ${command.data.name}:`, error);

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        embeds: [errorEmbed('Erreur', 'Une erreur inattendue est survenue. Veuillez réessayer.')],
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        embeds: [errorEmbed('Erreur', 'Une erreur inattendue est survenue. Veuillez réessayer.')],
        ephemeral: true,
      });
    }
  }
}

async function handleAutocomplete(interaction: AutocompleteInteraction, client: Client): Promise<void> {
  const command = client.commands.get(interaction.commandName);
  if (!command || !command.autocomplete) return;
  try {
    await command.autocomplete(interaction, client);
  } catch (error) {
    console.error(`[Bot] Erreur autocomplete ${command.data.name}:`, error);
  }
}

async function handleModalSubmit(interaction: ModalSubmitInteraction, client: Client): Promise<void> {
  if (!interaction.guild) return;

  try {
    if (interaction.customId.startsWith('form_submit_')) {
      const templateId = interaction.customId.replace('form_submit_', '');
      
      const template = await getFormTemplate(templateId);
      if (!template) {
        await interaction.reply({ embeds: [errorEmbed('Erreur', 'Formulaire introuvable.')], ephemeral: true });
        return;
      }

      const fields = JSON.parse(template.fields);
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
          console.error('Error sending form submission:', err);
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
          console.error('Error sending form log:', err);
        }
      }

      await interaction.reply({
        embeds: [successEmbed('Formulaire soumis', 'Votre réponse a été enregistrée avec succès !')],
        ephemeral: true,
      });
    }
  } catch (error) {
    console.error('Error handling modal submit:', error);
    await interaction.reply({
      embeds: [errorEmbed('Erreur', 'Une erreur est survenue lors du traitement de votre soumission.')],
      ephemeral: true,
    });
  }
}
