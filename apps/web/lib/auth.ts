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
  isDonor?: boolean;
  premium?: boolean;
}

export function getLoginUrl(): string {
  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!clientId || !appUrl) return '#';
  const redirectUri = encodeURIComponent(`${appUrl}/auth/callback`);
  return `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify+guilds`;
}

export async function handleCallback(code: string, state: string): Promise<AuthCallbackDTO> {
  const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL;

  if (!NEXT_PUBLIC_APP_URL) {
    throw new Error('Variable d\'environnement NEXT_PUBLIC_APP_URL requise');
  }

  const redirect_uri = encodeURIComponent(`${NEXT_PUBLIC_APP_URL}/auth/callback`);

  const data = await api.get<APIResponse<AuthCallbackDTO>>(
    `/api/auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}&redirect_uri=${redirect_uri}`
  );
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
