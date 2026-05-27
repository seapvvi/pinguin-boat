import { CommandInteraction, Client, Interaction, AutocompleteInteraction, ButtonInteraction } from 'discord.js';
import { getConfig } from '@pinguin/config';
import { checkCooldown } from '../guards/cooldown';
import { checkModPermissions } from '../guards/permissions';
import { checkInteractionBlacklist } from '../guards/blacklist';
import { requireModule } from '../guards/module';
import { errorEmbed } from '../services/embed';

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
