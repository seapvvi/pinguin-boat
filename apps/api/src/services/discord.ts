import { getConfig } from '@pinguin/config';

const config = getConfig();
const API_BASE = 'https://discord.com/api/v10';

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  global_name: string | null;
  avatar: string | null;
  email: string | null;
  locale: string;
  verified: boolean;
}

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
}

interface DiscordBotGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
}

async function discordFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Discord API error ${response.status}: ${text.slice(0, 200)}`
    );
  }

  return response.json() as Promise<T>;
}

export async function exchangeCode(code: string): Promise<DiscordTokenResponse> {
  const data = new URLSearchParams({
    client_id: config.DISCORD_CLIENT_ID,
    client_secret: config.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.NEXT_PUBLIC_DISCORD_REDIRECT_URI,
  });

  const response = await fetch(`${API_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: data.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Échec d'échange du code OAuth2: ${text.slice(0, 200)}`);
  }

  return response.json() as Promise<DiscordTokenResponse>;
}

export async function getUser(accessToken: string): Promise<DiscordUser> {
  return discordFetch<DiscordUser>('/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function getUserGuilds(
  accessToken: string
): Promise<DiscordGuild[]> {
  return discordFetch<DiscordGuild[]>('/users/@me/guilds', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function getBotGuilds(): Promise<DiscordBotGuild[]> {
  return discordFetch<DiscordBotGuild[]>('/users/@me/guilds', {
    headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
  });
}

export async function getBotGuild(id: string): Promise<DiscordBotGuild | null> {
  try {
    return await discordFetch<DiscordBotGuild>(`/guilds/${id}`, {
      headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
    });
  } catch {
    return null;
  }
}

export async function getGuildChannels(guildId: string): Promise<any[]> {
  return discordFetch<any[]>(`/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
  });
}

export async function getGuildRoles(guildId: string): Promise<any[]> {
  return discordFetch<any[]>(`/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
  });
}

export async function getGuildMember(
  guildId: string,
  userId: string
): Promise<any> {
  return discordFetch<any>(`/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
  });
}

export function hasDiscordPermission(
  memberPermissions: string,
  requiredPermission: bigint
): boolean {
  const perms = BigInt(memberPermissions);
  return (perms & requiredPermission) === requiredPermission;
}

export const DISCORD_PERMISSIONS = {
  ADMINISTRATOR: 1n << 3n,
  MANAGE_GUILD: 1n << 5n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_CHANNELS: 1n << 16n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  MODERATE_MEMBERS: 1n << 40n,
  SEND_MESSAGES: 1n << 11n,
  MANAGE_MESSAGES: 1n << 13n,
  VIEW_CHANNEL: 1n << 10n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
} as const;

export function canManageGuild(permissions: string): boolean {
  const perms = BigInt(permissions);
  return (
    (perms & DISCORD_PERMISSIONS.ADMINISTRATOR) ===
      DISCORD_PERMISSIONS.ADMINISTRATOR ||
    (perms & DISCORD_PERMISSIONS.MANAGE_GUILD) ===
      DISCORD_PERMISSIONS.MANAGE_GUILD
  );
}

export function isAdmin(permissions: string): boolean {
  return (
    BigInt(permissions) & DISCORD_PERMISSIONS.ADMINISTRATOR
  ) === DISCORD_PERMISSIONS.ADMINISTRATOR;
}
