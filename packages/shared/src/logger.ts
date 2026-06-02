import pino, { type Logger as PinoLogger } from 'pino';
import pinoRoll from 'pino-roll';

export type LoggerLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerContext {
  guildId?: string;
  userId?: string;
  component?: string;
}

export interface CreateLoggerOptions {
  level?: LoggerLevel;
}

function resolveLogLevel(envLevel: string | undefined): LoggerLevel {
  switch (envLevel) {
    case 'debug':
    case 'info':
    case 'warn':
    case 'error':
      return envLevel;
    default:
      return 'info';
  }
}

function createBaseLogger(options?: CreateLoggerOptions): PinoLogger {
  const level = resolveLogLevel(options?.level ?? process.env.LOG_LEVEL);

  const destination = process.env.LOG_DESTINATION ?? 'logs/pinguin.log';

  const base = pino(
    {
      level,
      base: {
        pid: process.pid,
        hostname: process.env.HOSTNAME,
      },
      messageKey: 'msg',
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.destination(destination),
  );

  return pinoRoll({
    logger: base,
    // Rotation quotidienne + répertoire dédié pour éviter les collisions.
    // pino-roll gère aussi les suppressions selon la config par défaut.
    // Format: logs/pinguin-YYYY-MM-DD.log
    interval: '1d',
    path: destination.replace(/\.log$/, '-%Y-%m-%d.log'),
    // Ne pas dupliquer des niveaux si pino-roll ajoute ses propres labels.
    // On garde le comportement de pino.
  });
}

const singletonLogger = createBaseLogger();

export function getLogger(context?: LoggerContext): PinoLogger {
  if (!context || Object.keys(context).length === 0) return singletonLogger;

  const { guildId, userId, component } = context;
  const bindings: Record<string, string> = {};

  if (guildId) bindings.guildId = guildId;
  if (userId) bindings.userId = userId;
  if (component) bindings.component = component;

  return singletonLogger.child(bindings);
}

export const logger: PinoLogger = singletonLogger;

