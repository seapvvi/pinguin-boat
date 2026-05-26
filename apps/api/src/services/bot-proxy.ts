const BOT_INTERNAL_URL = process.env.BOT_INTERNAL_URL || 'http://127.0.0.1:3002';
const BOT_INTERNAL_SECRET = process.env.BOT_INTERNAL_SECRET;
const BOT_TIMEOUT_MS = 5000;

if (!BOT_INTERNAL_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('BOT_INTERNAL_SECRET must be set in production');
  }
  console.warn('[bot-proxy] Using default dev secret — DO NOT use in production');
}
const SECRET = BOT_INTERNAL_SECRET || 'dev-secret';

export async function botFetch(path: string, options?: { method?: string; body?: unknown }): Promise<any> {
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
      const err: any = await res.json().catch(() => ({ error: 'Bot API error' }));
      throw new Error(err.error || `Bot API error: ${res.status}`);
    }
    return res.json();
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('BOT_OFFLINE');
    throw err;
  }
}

export async function getGuildData(guildId: string) {
  return botFetch(`/internal/guilds/${guildId}`);
}

export async function getQueueState(guildId: string) {
  return botFetch(`/internal/guilds/${guildId}/queue`);
}

export async function botPlay(guildId: string, query: string, voiceChannelId: string) {
  return botFetch(`/internal/guilds/${guildId}/play`, {
    method: 'POST',
    body: { query, voiceChannelId },
  });
}

export async function botControl(guildId: string, action: string, value?: unknown) {
  return botFetch(`/internal/guilds/${guildId}/control`, {
    method: 'POST',
    body: { action: action.toUpperCase(), value },
  });
}

export async function notifyModuleChange(guildId: string, disabledModules: string[]) {
  return botFetch(`/internal/guilds/${guildId}/modules`, {
    method: 'POST',
    body: { disabledModules },
  }).catch(() => { /* bot offline */ });
}

export async function botSearch(guildId: string, query: string): Promise<any> {
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
  return res.data;
}

export async function leaveGuildViaBot(guildId: string): Promise<void> {
  await botFetch(`/internal/guilds/${guildId}/leave`, { method: 'POST' });
}

export async function botEmergencyMode(guildId: string, enable: boolean): Promise<any> {
  return botFetch(`/internal/guilds/${guildId}/emergency`, {
    method: 'POST',
    body: { enable },
  });
}
