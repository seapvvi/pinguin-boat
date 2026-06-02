import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import { prisma } from '@pinguin/db';
import { getConfig } from '@pinguin/config';
import { createEmbed, errorEmbed } from '../../services/embed';
import * as path from 'path';
import * as fs from 'fs';

const config = getConfig();

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}j`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}

function formatRam({ used, total, percent }: { used: number; total: number; percent: number }): string {
  return `${used} / ${total} Mo (${percent}%)`;
}

function readBotVersion(): string {
  try {
    // apps/bot/dist -> __dirname est différent, donc on remonte depuis ce fichier.
    const repoRoot = process.cwd();
    const pkgPath = path.join(repoRoot, 'apps', 'bot', 'package.json');

    if (!fs.existsSync(pkgPath)) {
      return 'Inconnu';
    }

    const raw = fs.readFileSync(pkgPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') return 'Inconnu';
    const obj = parsed as { version?: unknown };

    if (typeof obj.version !== 'string') return 'Inconnu';
    return obj.version;
  } catch {
    return 'Inconnu';
  }
}

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Voir le statut du bot (owner uniquement)');

export const module = 'utility';

export async function execute(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  if (!interaction.inGuild()) {
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

  await interaction.deferReply({ ephemeral: true });

  try {
    const snapshot = await prisma.systemMetricsSnapshot.findFirst({
      orderBy: { timestamp: 'desc' },
    });

    const apiLatency = Math.round(client.ws.ping);
    const interactionLatency = Date.now() - interaction.createdTimestamp;

    const uptimeSeconds = snapshot?.uptimeSeconds ?? Math.floor(process.uptime());

    const guildCount = snapshot?.guildCount ?? client.guilds.cache.size;
    const userCount = snapshot?.userCount ?? client.users.cache.size;

    const cpu = snapshot?.cpuUsage ?? 0;

    const ramUsed = snapshot?.ramUsage ?? 0;
    const ramTotal = snapshot?.ramTotal ?? 0;
    const ramPercent =
      snapshot && snapshot.ramTotal > 0 ? parseFloat(((snapshot.ramUsage / snapshot.ramTotal) * 100).toFixed(2)) : 0;

    const version = readBotVersion();

    const embed = createEmbed('default')
      .setTitle('📡 Status (Owner)')
      .addFields(
        { name: '⏱️ Uptime', value: formatUptime(uptimeSeconds), inline: false },
        { name: '🏛️ Guilds', value: `${guildCount}`, inline: true },
        { name: '👥 Utilisateurs', value: `${userCount}`, inline: true },
        { name: '📡 Latence API Discord', value: `${apiLatency}ms`, inline: true },
        { name: '🧩 Latence interaction', value: `${interactionLatency}ms`, inline: true },
        { name: '🧠 CPU (dernier snapshot)', value: `${cpu}%`, inline: true },
        {
          name: '🧮 RAM (dernier snapshot)',
          value: formatRam({ used: ramUsed, total: ramTotal, percent: ramPercent }),
          inline: false,
        }
      )
      .addFields(
        {
          name: '🕒 Dernier snapshot',
          value: snapshot ? `<t:${Math.floor(snapshot.timestamp.getTime() / 1000)}:R>` : 'Aucun snapshot trouvé',
          inline: false,
        },
        { name: '📦 Version', value: `v${version}`, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch {
    await interaction.editReply({
      embeds: [errorEmbed('Erreur', 'Impossible de récupérer le status du bot.')],
    });
  }
}



