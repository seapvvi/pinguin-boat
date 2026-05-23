import { prisma, AuditAction } from '@pinguin/db';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  guildId?: string;
  userId?: string;
  details?: Record<string, unknown>;
}

export function log(entry: LogEntry): void {
  const prefix = entry.guildId ? `[${entry.guildId}]` : '';
  const timestamp = new Date().toISOString();

  switch (entry.level) {
    case 'info':
      console.log(`[${timestamp}] [INFO] ${prefix} ${entry.message}`);
      break;
    case 'warn':
      console.warn(`[${timestamp}] [WARN] ${prefix} ${entry.message}`);
      break;
    case 'error':
      console.error(`[${timestamp}] [ERROR] ${prefix} ${entry.message}`);
      break;
    case 'debug':
      console.debug(`[${timestamp}] [DEBUG] ${prefix} ${entry.message}`);
      break;
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
  } catch (error) {
    console.error('[Logger] Erreur lors de la création du log d\'audit:', error);
  }
}

export async function logToModChannel(
  guildId: string,
  embed: { title: string; description?: string; color?: number }
): Promise<void> {
  try {
    const { Client, GatewayIntentBits } = require('discord.js');
    const settings = await prisma.guildSettings.findUnique({ where: { guildId } });
    if (!settings?.modLogChannel) return;
  } catch {
  }
}
