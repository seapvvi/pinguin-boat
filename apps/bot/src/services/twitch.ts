import { getConfig } from '@pinguin/config';

let accessToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiresAt) {
    return accessToken;
  }

  const config = getConfig();
  if (!config.TWITCH_CLIENT_ID || !config.TWITCH_CLIENT_SECRET) {
    throw new Error('TWITCH_CLIENT_ID et TWITCH_CLIENT_SECRET doivent être configurés.');
  }

  const params = new URLSearchParams({
    client_id: config.TWITCH_CLIENT_ID,
    client_secret: config.TWITCH_CLIENT_SECRET,
    grant_type: 'client_credentials',
  });

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  if (!res.ok) {
    throw new Error(`Erreur auth Twitch: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000 - 60000;
  return accessToken!;
}

export interface TwitchStreamData {
  userName: string;
  gameName: string;
  title: string;
  thumbnailUrl: string;
  streamUrl: string;
  startedAt: string;
  profileImageUrl?: string;
}

export async function fetchStream(userLogin: string): Promise<TwitchStreamData | null> {
  const config = getConfig();
  const token = await getAccessToken();

  const res = await fetch(
    `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(userLogin)}`,
    {
      headers: {
        'Client-ID': config.TWITCH_CLIENT_ID!,
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Erreur API Twitch: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as { data: Array<{ user_login: string; game_name: string; title: string; thumbnail_url: string; started_at: string }> };
  if (!data.data || data.data.length === 0) return null;

  const stream = data.data[0];

  const userRes = await fetch(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(userLogin)}`,
    {
      headers: {
        'Client-ID': config.TWITCH_CLIENT_ID!,
        Authorization: `Bearer ${token}`,
      },
    }
  );

  let profileImageUrl: string | undefined;
  if (userRes.ok) {
    const userData = await userRes.json() as { data: Array<{ profile_image_url: string }> };
    profileImageUrl = userData.data?.[0]?.profile_image_url;
  }

  return {
    userName: stream.user_login,
    gameName: stream.game_name,
    title: stream.title,
    thumbnailUrl: stream.thumbnail_url.replace('{width}', '640').replace('{height}', '360'),
    streamUrl: `https://twitch.tv/${stream.user_login}`,
    startedAt: stream.started_at,
    profileImageUrl,
  };
}
