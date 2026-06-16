import { getConfig } from '@pinguin/config';
import { getCache, setCache, invalidateCache } from '../utils/cache';

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

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
}

export interface DiscordBotGuild {
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

export async function exchangeCode(code: string, redirectUri: string): Promise<DiscordTokenResponse> {
  const data = new URLSearchParams({
    client_id: config.DISCORD_CLIENT_ID,
    client_secret: config.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
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

export async function refreshDiscordToken(refreshToken: string): Promise<DiscordTokenResponse> {
  const data = new URLSearchParams({
    client_id: config.DISCORD_CLIENT_ID,
    client_secret: config.DISCORD_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await fetch(`${API_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: data.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Échec du rafraîchissement du token OAuth2: ${text.slice(0, 200)}`);
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
  const allGuilds: DiscordBotGuild[] = [];
  let after: string | undefined;

  while (true) {
    let endpoint = '/users/@me/guilds?limit=200';
    if (after) endpoint += `&after=${after}`;

    const batch = await discordFetch<DiscordBotGuild[]>(endpoint, {
      headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
    });

    allGuilds.push(...batch);
    if (batch.length < 200) break;

    const last = batch[batch.length - 1];
    after = last.id;
  }

  return allGuilds;
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
  const cacheKey = `channels:${guildId}`;
  const cached = getCache<any[]>(cacheKey);
  if (cached) return cached;
  const channels = await discordFetch<any[]>(`/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
  });
  setCache(cacheKey, channels, 60_000);
  return channels;
}

export async function getGuildRoles(guildId: string): Promise<any[]> {
  const cacheKey = `roles:${guildId}`;
  const cached = getCache<any[]>(cacheKey);
  if (cached) return cached;
  const roles = await discordFetch<any[]>(`/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
  });
  setCache(cacheKey, roles, 60_000);
  return roles;
}

export async function getGuildMember(
  guildId: string,
  userId: string
): Promise<any> {
  return discordFetch<any>(`/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
  });
}

export async function getGuild(guildId: string): Promise<{ id: string; name: string; owner_id: string }> {
  return discordFetch(`/guilds/${guildId}`, {
    headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
  });
}

let cachedBotUserId: string | null = null;

export async function getBotUserId(): Promise<string> {
  if (cachedBotUserId) return cachedBotUserId;
  const me = await discordFetch<{ id: string }>('/users/@me', {
    headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
  });
  cachedBotUserId = me.id;
  return cachedBotUserId;
}

export function hasDiscordPermission(
  memberPermissions: string,
  requiredPermission: bigint
): boolean {
  const perms = BigInt(memberPermissions);
  return (perms & requiredPermission) === requiredPermission;
}

export async function sendDM(userId: string, content: { embeds?: any[], content?: string }): Promise<void> {
  const dm = await discordFetch<{ id: string }>(`/users/${userId}/channels`, {
    method: 'POST',
    headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
    body: JSON.stringify({ recipient_id: userId }),
  });
  await discordFetch(`/channels/${dm.id}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
    body: JSON.stringify(content),
  });
}

interface OutgoingFile {
  name: string;
  content: string;
  contentType?: string;
}

async function postMessageWithFile(channelId: string, payload: any, file: OutgoingFile): Promise<any> {
  const form = new FormData();
  form.set('payload_json', JSON.stringify(payload));
  const blob = new Blob([file.content], { type: file.contentType ?? 'text/html' });
  form.set('files[0]', blob, file.name);
  const res = await fetch(`${API_BASE}/channels/${channelId}/messages`, {
    method: 'POST',
    // Do NOT set Content-Type: fetch sets the multipart boundary automatically.
    headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
    body: form as any,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord file message error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function sendDMWithFile(
  userId: string,
  content: { embeds?: any[]; content?: string },
  file: OutgoingFile
): Promise<void> {
  const dm = await discordFetch<{ id: string }>(`/users/${userId}/channels`, {
    method: 'POST',
    headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
    body: JSON.stringify({ recipient_id: userId }),
  });
  await postMessageWithFile(dm.id, content, file);
}

export async function sendChannelMessageWithFile(
  channelId: string,
  content: any,
  file: OutgoingFile
): Promise<any> {
  return postMessageWithFile(channelId, content, file);
}

export async function timeoutMember(guildId: string, userId: string, durationMs: number | null): Promise<void> {
  await discordFetch(`/guilds/${guildId}/members/${userId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
    body: JSON.stringify({
      communication_disabled_until: durationMs ? new Date(Date.now() + durationMs).toISOString() : null,
    }),
  });
}

export async function kickMember(guildId: string, userId: string, reason: string): Promise<void> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/members/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Discord kick error ${res.status}: ${text.slice(0, 200)}`);
  }
}

export async function banMember(guildId: string, userId: string, reason: string, deleteMessageDays = 0): Promise<void> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/bans/${userId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${config.DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason, delete_message_seconds: deleteMessageDays * 86400 }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord ban error ${res.status}: ${text.slice(0, 200)}`);
  }
}

export async function unbanMember(guildId: string, userId: string, reason: string): Promise<void> {
  const res = await fetch(`${API_BASE}/guilds/${guildId}/bans/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Discord unban error ${res.status}: ${text.slice(0, 200)}`);
  }
}

export async function sendChannelMessage(channelId: string, content: any): Promise<any> {
  return discordFetch(`/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
    body: JSON.stringify(content),
  });
}

export async function editMessage(channelId: string, messageId: string, content: any): Promise<any> {
  return discordFetch(`/channels/${channelId}/messages/${messageId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
    body: JSON.stringify(content),
  });
}

export async function addMessageReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
  const encoded = encodeURIComponent(emoji);
  const res = await fetch(`${API_BASE}/channels/${channelId}/messages/${messageId}/reactions/${encoded}/@me`, {
    method: 'PUT',
    headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord reaction error ${res.status}: ${text.slice(0, 200)}`);
  }
}

export async function getChannelMessages(channelId: string, limit = 100): Promise<any[]> {
  const messages: any[] = [];
  const batchSize = Math.min(limit, 100);
  let lastId: string | undefined;

  while (messages.length < limit) {
    let endpoint = `/channels/${channelId}/messages?limit=${batchSize}`;
    if (lastId) endpoint += `&before=${lastId}`;
    const batch = await discordFetch<any[]>(endpoint, {
      headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
    });
    messages.push(...batch);
    if (batch.length < batchSize) break;
    lastId = batch[batch.length - 1].id;
  }

  return messages.slice(0, limit);
}

export async function createGuildChannel(guildId: string, options: { name: string; type?: number; parent_id?: string; permission_overwrites?: any[]; topic?: string }): Promise<any> {
  invalidateCache(`channels:${guildId}`);
  return discordFetch(`/guilds/${guildId}/channels`, {
    method: 'POST',
    headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
    body: JSON.stringify(options),
  });
}

export async function deleteChannel(channelId: string, guildId?: string): Promise<void> {
  if (guildId) invalidateCache(`channels:${guildId}`);
  const res = await fetch(`${API_BASE}/channels/${channelId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Discord delete channel error ${res.status}: ${text.slice(0, 200)}`);
  }
}

export async function editChannel(channelId: string, options: any, guildId?: string): Promise<void> {
  if (guildId) invalidateCache(`channels:${guildId}`);
  await discordFetch(`/channels/${channelId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bot ${config.DISCORD_TOKEN}` },
    body: JSON.stringify(options),
  });
}

export const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

export const DISCORD_PERMISSIONS = {
  ADMINISTRATOR: 1n << 3n,
  MANAGE_GUILD: 1n << 5n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_CHANNELS: 1n << 4n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  MODERATE_MEMBERS: 1n << 40n,
  SEND_MESSAGES: 1n << 11n,
  MANAGE_MESSAGES: 1n << 13n,
  VIEW_CHANNEL: 1n << 10n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
} as const;

export function canManageGuild(permissions: string | number): boolean {
  const perms = BigInt(String(permissions));
  if ((perms & DISCORD_PERMISSIONS.ADMINISTRATOR) === DISCORD_PERMISSIONS.ADMINISTRATOR) {
    return true;
  }
  if ((perms & DISCORD_PERMISSIONS.MANAGE_GUILD) === DISCORD_PERMISSIONS.MANAGE_GUILD) {
    return true;
  }
  if ((perms & DISCORD_PERMISSIONS.MANAGE_ROLES) === DISCORD_PERMISSIONS.MANAGE_ROLES) {
    return true;
  }
  return false;
}

export function isAdmin(permissions: string): boolean {
  return (
    BigInt(permissions) & DISCORD_PERMISSIONS.ADMINISTRATOR
  ) === DISCORD_PERMISSIONS.ADMINISTRATOR;
}
