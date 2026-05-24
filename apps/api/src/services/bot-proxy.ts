const BOT_INTERNAL_URL = process.env.BOT_INTERNAL_URL || 'http://127.0.0.1:3002';
const BOT_INTERNAL_SECRET = process.env.BOT_INTERNAL_SECRET || 'dev-secret';

async function botFetch(path: string, options?: { method?: string; body?: unknown }): Promise<any> {
  const url = `${BOT_INTERNAL_URL}${path}`;
  const res = await fetch(url, {
    method: options?.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': BOT_INTERNAL_SECRET,
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err: any = await res.json().catch(() => ({ error: 'Bot API error' }));
    throw new Error(err.error || `Bot API error: ${res.status}`);
  }
  return res.json();
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
    body: { action, value },
  });
}
