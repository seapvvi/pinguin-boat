import type { AuthCallbackDTO, APIResponse } from '@pinguin/shared';
import { api } from './api';

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

  const redirect_uri = `${NEXT_PUBLIC_APP_URL}/auth/callback`;
  const params = new URLSearchParams({ code, state, redirect_uri });

  const data = await api.get<APIResponse<AuthCallbackDTO>>(
    `/api/auth/callback?${params.toString()}`
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
    // session cookie is removed server-side via Set-Cookie
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
