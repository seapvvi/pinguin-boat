import { prisma, AuditAction } from '@pinguin/db';
import { getLogger, type LoggerContext } from '@pinguin/shared';

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
  guildId: string,
  _embed: { title: string; description?: string; color?: number }
): Promise<void> {
  void guildId;
}

