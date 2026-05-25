import type { AuthCallbackDTO, APIResponse } from '@pinguin/shared';
import { api } from './api';

const SESSION_KEY = 'pinguin_session_token';

export function setSessionToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_KEY, token);
  }
}

export function getSessionToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(SESSION_KEY);
  }
  return null;
}

export function clearSessionToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_KEY);
  }
}

export interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  globalName?: string;
  locale?: string;
  isOwner: boolean;
  premium?: boolean;
}

export function getLoginUrl(): string {
  return '/api/auth/login';
}

export async function handleCallback(code: string): Promise<AuthCallbackDTO> {
  const data = await api.get<APIResponse<AuthCallbackDTO>>(`/api/auth/callback?code=${encodeURIComponent(code)}`);
  if (!data.success || !data.data) {
    throw new Error(data.error || 'Échec de l\'authentification');
  }
  return data.data;
}

export async function logout(): Promise<void> {
  try {
    await api.post('/api/auth/logout', {});
  } finally {
    clearSessionToken();
  }
}

export async function getUser(): Promise<User | null> {
  try {
    const data = await api.get<APIResponse<User>>('/api/auth/me');
    if (!data.success || !data.data) {
      return null;
    }
    return data.data;
  } catch {
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const user = await getUser();
  return user !== null;
}
