import { CommandInteraction, Client, Interaction, AutocompleteInteraction } from 'discord.js';
import { getConfig } from '@pinguin/config';
import { checkCooldown } from '../guards/cooldown';
import { checkModPermissions } from '../guards/permissions';
import { checkInteractionBlacklist } from '../guards/blacklist';
import { requireModule } from '../guards/module';
import { errorEmbed } from '../services/embed';

export async function execute(interaction: Interaction, client: Client): Promise<void> {
  if (interaction.isAutocomplete()) {
    await handleAutocomplete(interaction, client);
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
      embeds: [errorEmbed('Accès refusé', `Vous êtes blacklisté. Raison : ${blacklistCheck.reason ?? 'Non spécifiée'}`)],
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
