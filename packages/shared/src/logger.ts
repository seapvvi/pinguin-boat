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

export interface BotLogger {
  debug(msg: string, obj?: Record<string, unknown>): void;
  info(msg: string, obj?: Record<string, unknown>): void;
  warn(msg: string, obj?: Record<string, unknown>): void;
  error(msg: string, obj?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): BotLogger;
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

const singletonPinoLogger = isServer ? createBaseLogger() : createNoopLogger();

function wrapLogger(pinoLogger: PinoLogger): BotLogger {
  return {
    debug: (msg, obj) => (obj ? pinoLogger.debug(obj, msg) : pinoLogger.debug(msg)),
    info: (msg, obj) => (obj ? pinoLogger.info(obj, msg) : pinoLogger.info(msg)),
    warn: (msg, obj) => (obj ? pinoLogger.warn(obj, msg) : pinoLogger.warn(msg)),
    error: (msg, obj) => (obj ? pinoLogger.error(obj, msg) : pinoLogger.error(msg)),
    child: (b) => wrapLogger(pinoLogger.child(b)),
  };
}

export function getLogger(context?: LoggerContext): BotLogger {
  if (!context || Object.keys(context).length === 0) return wrappedLogger;

  const bindings: Record<string, string> = {};
  if (context.guildId) bindings.guildId = context.guildId;
  if (context.userId) bindings.userId = context.userId;
  if (context.component) bindings.component = context.component;

  return wrapLogger(singletonPinoLogger.child(bindings));
}

const wrappedLogger = wrapLogger(singletonPinoLogger);
export const logger: BotLogger = wrappedLogger;
