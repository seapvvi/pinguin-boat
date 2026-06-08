export const webLogger = {
  info:  (msg: string, obj?: Record<string, unknown>) =>
    // eslint-disable-next-line no-console
    console.log('[INFO]', msg, ...(obj ? [obj] : [])),
  warn:  (msg: string, obj?: Record<string, unknown>) =>
    // eslint-disable-next-line no-console
    console.warn('[WARN]', msg, ...(obj ? [obj] : [])),
  error: (msg: string, obj?: Record<string, unknown>) =>
    // eslint-disable-next-line no-console
    console.error('[ERROR]', msg, ...(obj ? [obj] : [])),
  debug: (msg: string, obj?: Record<string, unknown>) =>
    // eslint-disable-next-line no-console
    console.debug('[DEBUG]', msg, ...(obj ? [obj] : [])),
};
