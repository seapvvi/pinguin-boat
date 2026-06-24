import { getConfig } from '@pinguin/config';

const config = getConfig();
const BOT_INTERNAL_URL = config.BOT_INTERNAL_URL;
const BOT_INTERNAL_SECRET = config.BOT_INTERNAL_SECRET;
const BOT_TIMEOUT_MS = 5000;

if (!BOT_INTERNAL_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('BOT_INTERNAL_SECRET must be set in production');
  }
  console.warn('[bot-proxy] Using default dev secret — DO NOT use in production');
}
const SECRET = BOT_INTERNAL_SECRET || 'dev-secret';

export async function botFetch(path: string, options?: { method?: string; body?: unknown }): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BOT_TIMEOUT_MS);
  try {
    const res = await fetch(`${BOT_INTERNAL_URL}${path}`, {
      method: options?.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': SECRET,
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const errBody: unknown = await res.json().catch(() => ({ error: 'Bot API error' }));
      const err = errBody as { error?: string };
      throw new Error(err.error || `Bot API error: ${res.status}`);
    }
    return res.json();
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') throw new Error('BOT_OFFLINE');
    throw err;
  }
}

export async function getGuildData(guildId: string): Promise<unknown> {
  return botFetch(`/internal/guilds/${guildId}`);
}

export async function getQueueState(guildId: string): Promise<unknown> {
  return botFetch(`/internal/guilds/${guildId}/queue`);
}

export async function botPlay(guildId: string, query: string, voiceChannelId: string): Promise<unknown> {
  return botFetch(`/internal/guilds/${guildId}/play`, {
    method: 'POST',
    body: { query, voiceChannelId },
  });
}

export async function botControl(guildId: string, action: string, value?: unknown): Promise<unknown> {
  return botFetch(`/internal/guilds/${guildId}/control`, {
    method: 'POST',
    body: { action: action.toUpperCase(), value },
  });
}

export async function notifyModuleChange(guildId: string, disabledModules: string[]): Promise<void> {
  await botFetch(`/internal/guilds/${guildId}/modules`, {
    method: 'POST',
    body: { disabledModules },
  }).catch(() => { /* bot offline */ });
}

export async function invalidateBotAutoModCache(guildId: string): Promise<void> {
  await botFetch(`/internal/guilds/${guildId}/automod/invalidate`, {
    method: 'POST',
  });
}

export async function botSearch(guildId: string, query: string): Promise<unknown> {
  return botFetch(`/internal/guilds/${guildId}/search?q=${encodeURIComponent(query)}`);
}

export async function createTicketChannel(guildId: string, params: {
  userId: string;
  channelName: string;
  categoryId?: string | null;
  modRoles?: string[];
  reason?: string;
}): Promise<{ channelId: string; channelMention: string }> {
  const res = await botFetch(`/internal/guilds/${guildId}/create-channel`, {
    method: 'POST',
    body: params,
  });
  return (res as { data: { channelId: string; channelMention: string } }).data;
}

export async function leaveGuildViaBot(guildId: string): Promise<void> {
  await botFetch(`/internal/guilds/${guildId}/leave`, { method: 'POST' });
}

export async function botEmergencyMode(guildId: string, enable: boolean): Promise<unknown> {
  return botFetch(`/internal/guilds/${guildId}/emergency`, {
    method: 'POST',
    body: { enable },
  });
}

export async function sendTestNotification(guildId: string, notificationId: string): Promise<void> {
  await botFetch(`/internal/guilds/${guildId}/send-test-notification`, {
    method: 'POST',
    body: { notificationId },
  });
}

export async function botRestoreBackup(
  guildId: string,
  backupData: { channels: { id: string; name: string; type: number }[]; roles: { id: string; name: string; color: number }[] }
): Promise<{ channelsRestored: number; rolesRestored: number }> {
  const res = await botFetch(`/internal/guilds/${guildId}/restore`, {
    method: 'POST',
    body: { backupData },
  });
  return (res as { data: { channelsRestored: number; rolesRestored: number } }).data;
}
