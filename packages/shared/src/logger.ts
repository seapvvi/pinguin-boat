import pino, { type Logger as PinoLogger } from 'pino';

export type LoggerLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerContext {
  guildId?: string;
  userId?: string;
  component?: string;
}

export interface CreateLoggerOptions {
  level?: LoggerLevel;
}

const isServer = typeof process !== 'undefined' && process.release?.name === 'node';

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

  return pino({
    level,
    base: {
      pid: process.pid,
      hostname: process.env.HOSTNAME,
    },
    messageKey: 'msg',
    timestamp: pino.stdTimeFunctions.isoTime,
    transport: {
      targets: [
        { target: 'pino/file', options: { destination: 1 } },
        { target: 'pino-roll', options: { file: destination, frequency: 'daily', mkdir: true } },
      ],
    },
  });
}

function createNoopLogger(): PinoLogger {
  return pino({ enabled: false });
}

const singletonLogger = isServer ? createBaseLogger() : createNoopLogger();

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
