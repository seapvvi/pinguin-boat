import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { getConfig } from '@pinguin/config';
import { createEmbed, errorEmbed, successEmbed } from '../../services/embed';

const config = getConfig();

function normalizeModuleName(input: string): string {
  return input.trim().toLowerCase();
}

function listRequireCacheKeysContaining(token: string): string[] {
  const keys: string[] = [];

  for (const raw of Object.keys(require.cache ?? {})) {
    if (typeof raw === 'string' && raw.includes(token)) keys.push(raw);
  }

  return keys;
}

function formatCommandList(commands: string[]): string {
  return commands.map((c) => `\n• /${c}`).join('') || '—';
}

export const data = new SlashCommandBuilder()
  .setName('reload')
  .setDescription('Recharge à chaud un module (sans redémarrer le bot)')
  .setDMPermission(false)
  .addStringOption((opt) =>
    opt
      .setName('module')
      .setDescription('Nom du module à recharger (ex: economy, moderation...)')
      .setRequired(true)
  );

// Le check ModuleEnabled s'applique via la propriété "module" du command.
// Comme cette commande se trouve dans le dossier utility, on l'associe à utility.
export const module = 'utility';

export async function execute(
  interaction: ChatInputCommandInteraction,
  client: Client
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      embeds: [errorEmbed('Erreur', 'Cette commande doit être utilisée dans un serveur.')],
      ephemeral: true,
    });
    return;
  }

  if (interaction.user.id !== config.DISCORD_OWNER_ID) {
    await interaction.reply({
      embeds: [errorEmbed('Accès refusé', 'Commande réservée au créateur du bot.')],
      ephemeral: true,
    });
    return;
  }

  const moduleNameRaw = interaction.options.getString('module', true);
  const moduleName = normalizeModuleName(moduleNameRaw);

  // 1) Invalider le cache require des fichiers du dossier concerné
  const cacheToken = `/commands/${moduleName}/`;
  const cacheKeys = listRequireCacheKeysContaining(cacheToken);

  const commandsBefore = new Map(client.commands);

  for (const k of cacheKeys) {
    delete (require.cache as unknown as Record<string, unknown>)[k];
  }

  // 2) Recharger via le loader existant

  const loaderModule = await import('../_loader');

  const loadCommands = loaderModule.loadCommands;
  if (typeof loadCommands !== 'function') {
    await interaction.reply({
      embeds: [
        createEmbed('error')
          .setTitle('Erreur reload')
          .setDescription('Loader de commandes introuvable ou invalide.'),
      ],
      ephemeral: true,
    });
    return;
  }

  loadCommands(client);

  // 3) Détecter les commandes ajoutées
  const reloaded: string[] = [];

  for (const [name] of client.commands) {
    if (!commandsBefore.has(name)) reloaded.push(name);
  }

  if (reloaded.length === 0) {
    await interaction.reply({
      embeds: [
        createEmbed('warning')
          .setTitle('Module rechargé')
          .setDescription(
            `Aucune commande nouvelle détectée pour le module **${moduleNameRaw}**. (Vérifie que le dossier existe.)`
          )
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    embeds: [
      successEmbed('Reload effectué', `Module **${moduleNameRaw}** rechargé avec succès.`).addFields({
        name: 'Commandes',
        value: formatCommandList(reloaded),
        inline: false,
      }),
    ],
    ephemeral: true,
  });
}

