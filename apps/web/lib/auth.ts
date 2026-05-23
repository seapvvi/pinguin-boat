import type { AuthCallbackDTO, APIResponse } from '@pinguin/shared';
import { api } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface User {
  id: string;
  username: string;
  discriminator: string;
  avatar: string;
  globalName?: string;
  locale?: string;
  isOwner: boolean;
  premium?: boolean;
}

export function getLoginUrl(): string {
  return `${API_URL}/api/auth/login`;
}

export async function handleCallback(code: string): Promise<AuthCallbackDTO> {
  const data = await api.post<APIResponse<AuthCallbackDTO>>('/api/auth/callback', { code });
  if (!data.success || !data.data) {
    throw new Error(data.error || 'Échec de l\'authentification');
  }
  return data.data;
}

export async function logout(): Promise<void> {
  await api.post('/api/auth/logout');
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
