import type { APIResponse, PaginationInfo } from '@pinguin/shared';

export function success<T>(data: T, message?: string): APIResponse<T> {
  const res: APIResponse<T> = { success: true, data };
  if (message) res.message = message;
  return res;
}

export function error(message: string, details?: unknown): APIResponse<never> {
  const res: APIResponse<never> = { success: false, error: message };
  if (details !== undefined) res.data = details as never;
  return res;
}

export function notFound(message = 'Ressource introuvable'): APIResponse<never> {
  return { success: false, error: message };
}

export function badRequest(message: string): APIResponse<never> {
  return { success: false, error: message };
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Erreur inconnue';
}

export function sanitizeError(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) {
    const prismaErr = err as { code?: string };
    if (prismaErr.code?.startsWith?.('P')) return 'Erreur de base de données';
    if (err.message.includes('Discord API error')) return 'Erreur de communication avec Discord';
    if (err.message === 'BOT_OFFLINE') return 'Le bot est actuellement hors ligne';
    return err.message;
  }
  return 'Une erreur interne est survenue';
}

export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): APIResponse<T[]> {
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export function paginationInfo(
  total: number,
  page: number,
  limit: number
): PaginationInfo {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
