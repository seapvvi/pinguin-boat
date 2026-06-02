export const webLogger = {
  info:  (msg: string, obj?: Record<string, unknown>) =>
    console.log('[INFO]', msg, ...(obj ? [obj] : [])),
  warn:  (msg: string, obj?: Record<string, unknown>) =>
    console.warn('[WARN]', msg, ...(obj ? [obj] : [])),
  error: (msg: string, obj?: Record<string, unknown>) =>
    console.error('[ERROR]', msg, ...(obj ? [obj] : [])),
  debug: (msg: string, obj?: Record<string, unknown>) =>
    console.debug('[DEBUG]', msg, ...(obj ? [obj] : [])),
};
