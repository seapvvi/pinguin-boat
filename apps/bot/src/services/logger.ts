import { prisma, AuditAction } from '@pinguin/db';
import { getLogger, type LoggerContext } from '@pinguin/shared';
import { EmbedBuilder, Client, TextChannel } from 'discord.js';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  guildId?: string;
  userId?: string;
  details?: Record<string, unknown>;
}

export function log(entry: LogEntry): void {
  const context: LoggerContext = {
    guildId: entry.guildId,
    userId: entry.userId,
    component: 'bot',
  };

  const l = getLogger(context);

  switch (entry.level) {
    case 'debug':
      l.debug(entry.message, entry.details);
      return;
    case 'info':
      l.info(entry.message, entry.details);
      return;
    case 'warn':
      l.warn(entry.message, entry.details);
      return;
    case 'error':
      l.error(entry.message, entry.details);
      return;
  }
}

export async function createAuditLog(
  action: AuditAction,
  guildId: string | null,
  userId: string | null,
  details?: string
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        guildId,
        userId,
        details: details ?? null,
      },
    });
  } catch (error: unknown) {
    getLogger({ component: 'audit' }).error('Erreur lors de la création du log d\'audit', {
      error,
    });
  }
}

export async function logToModChannel(
  client: Client,
  guildId: string,
  embedData: { title: string; description?: string; color?: number }
): Promise<void> {
  try {
    const ls = await prisma.logSettings.findUnique({ where: { guildId } });
    if (!ls?.logChannelId) return;

    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(ls.logChannelId) as TextChannel | undefined;
    if (!channel?.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle(embedData.title)
      .setDescription(embedData.description ?? null)
      .setColor(embedData.color ?? 0x3b82f6);

    await channel.send({ embeds: [embed] }).catch(() => {});
  } catch {
    // Log channel unavailable — silently ignore
  }
}

