import { CommandInteraction, Client, Interaction, AutocompleteInteraction, ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction, GuildMember } from 'discord.js';
import { checkCooldown } from '../guards/cooldown';
import { checkModPermissions } from '../guards/permissions';
import { checkInteractionBlacklist } from '../guards/blacklist';
import { requireModule } from '../guards/module';
import { errorEmbed } from '../services/embed';
import { logger } from '@pinguin/shared';
import { registry } from '../interactions';

async function replyButtonError(interaction: ButtonInteraction, message: string): Promise<void> {
  const payload = { embeds: [errorEmbed('Erreur', message)], ephemeral: true as const };
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload).catch(() => {});
  } else {
    await interaction.reply(payload).catch(() => {});
  }
}

async function replySelectError(interaction: StringSelectMenuInteraction, message: string): Promise<void> {
  const payload = {
    embeds: [errorEmbed('Erreur', message)],
    components: [],
  };
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload).catch(() => {});
  } else {
    await interaction.update(payload).catch(() => {});
  }
}

async function replyModalError(interaction: ModalSubmitInteraction, message: string): Promise<void> {
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
    await handleButton(interaction, client);
    return;
  }

  if (interaction.isStringSelectMenu()) {
    await handleSelectMenu(interaction, client);
    return;
  }

  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

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

  if (command.permissions || command.requireAdmin) {
    if (!interaction.member || !(interaction.member instanceof GuildMember)) {
      await interaction.reply({
        embeds: [errorEmbed('Permission refusée', 'Impossible de vérifier vos permissions.')],
        ephemeral: true,
      });
      return;
    }
    const permCheck = await checkModPermissions(interaction.member, command.requireAdmin ?? false);
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
      logger.error(`Erreur commande ${command.data.name}`, { err: error instanceof Error ? error.message : String(error) });

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
    logger.error(`Erreur autocomplete ${command.data.name}`, { err: error instanceof Error ? error.message : String(error) });
  }
}

async function handleButton(interaction: ButtonInteraction, client: Client): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Utilisable uniquement sur un serveur.')], ephemeral: true }).catch(() => {});
    return;
  }

  // Minigame buttons (blackjack, morpion) are handled by their own
  // per-message component collectors. We must NOT acknowledge them here:
  // doing so races with the collector's i.update() and triggers
  // "Échec de l'interaction" / unhandled rejections that crash the bot.
  if (interaction.customId.startsWith('bj_') || interaction.customId.startsWith('morpion_')) {
    return;
  }

  const handler = registry.findButtonHandler(interaction.customId);
  if (!handler) {
    // Bouton non géré : acknowledge pour éviter "interaction échouée"
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate().catch(() => {});
    }
    return;
  }

  try {
    await handler.handler(interaction, client);
  } catch (err) {
    logger.error('[Bot] Erreur bouton', { customId: interaction.customId, err: err instanceof Error ? err.message : String(err) });
    await replyButtonError(interaction, 'Une erreur est survenue. Réessayez dans un instant.');
  }
}

async function handleSelectMenu(interaction: StringSelectMenuInteraction, client: Client): Promise<void> {
  const handler = registry.findSelectHandler(interaction.customId);
  if (!handler) {
    // Menu non géré : acknowledge pour éviter "interaction échouée"
    if (!interaction.replied && !interaction.deferred) {
      await replySelectError(interaction, 'Action non reconnue.');
    }
    return;
  }

  try {
    await handler.handler(interaction, client);
  } catch (err) {
    logger.error('[Bot] Erreur menu select', { customId: interaction.customId, err: err instanceof Error ? err.message : String(err) });
    await replySelectError(interaction, 'Une erreur est survenue. Réessayez dans un instant.');
  }
}

async function handleModalSubmit(interaction: ModalSubmitInteraction, client: Client): Promise<void> {
  if (!interaction.guild) return;

  const handler = registry.findModalHandler(interaction.customId);
  if (!handler) {
    // Modal non géré : acknowledge pour éviter "interaction échouée"
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ embeds: [errorEmbed('Erreur', 'Action non reconnue.')], ephemeral: true }).catch(() => {});
    }
    return;
  }

  try {
    await handler.handler(interaction, client);
  } catch (error) {
    logger.error('Error handling modal submit', { customId: interaction.customId, err: error instanceof Error ? error.message : String(error) });
    await replyModalError(interaction, 'Une erreur est survenue lors du traitement de votre soumission.');
  }
}
