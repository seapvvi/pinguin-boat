import { getConfig } from '@pinguin/config';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeStreamData {
  channelName: string;
  channelId: string;
  videoTitle: string;
  videoId: string;
  thumbnailUrl: string;
  streamUrl: string;
  channelAvatarUrl?: string;
}

function getApiKey(): string {
  const config = getConfig();
  if (!config.YOUTUBE_API_KEY) {
    throw new Error('YOUTUBE_API_KEY doit être configurée.');
  }
  return config.YOUTUBE_API_KEY;
}

export async function searchChannel(channelName: string): Promise<{ channelId: string; channelTitle: string; avatarUrl?: string } | null> {
  const apiKey = getApiKey();

  const res = await fetch(
    `${YOUTUBE_API_BASE}/search?part=snippet&type=channel&q=${encodeURIComponent(channelName)}&key=${apiKey}&maxResults=1`
  );

  if (!res.ok) {
    throw new Error(`Erreur API YouTube: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as {
    items?: Array<{
      id: { channelId: string };
      snippet: { title: string; thumbnails: { default?: { url: string } } };
    }>;
  };

  if (!data.items || data.items.length === 0) return null;

  const item = data.items[0];
  return {
    channelId: item.id.channelId,
    channelTitle: item.snippet.title,
    avatarUrl: item.snippet.thumbnails?.default?.url,
  };
}

export async function fetchLiveStream(channelId: string): Promise<YouTubeStreamData | null> {
  const apiKey = getApiKey();

  const res = await fetch(
    `${YOUTUBE_API_BASE}/search?part=snippet&channelId=${channelId}&type=video&eventType=live&key=${apiKey}&maxResults=1`
  );

  if (!res.ok) {
    throw new Error(`Erreur API YouTube: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as {
    items?: Array<{
      id: { videoId: string };
      snippet: {
        title: string;
        channelTitle: string;
        channelId: string;
        thumbnails: { high?: { url: string }; medium?: { url: string } };
      };
    }>;
  };

  if (!data.items || data.items.length === 0) return null;

  const item = data.items[0];

  const channelRes = await fetch(
    `${YOUTUBE_API_BASE}/channels?part=snippet&id=${channelId}&key=${apiKey}`
  );

  let channelAvatarUrl: string | undefined;
  if (channelRes.ok) {
    const channelData = await channelRes.json() as {
      items?: Array<{ snippet: { thumbnails: { default?: { url: string } } } }>;
    };
    channelAvatarUrl = channelData.items?.[0]?.snippet?.thumbnails?.default?.url;
  }

  return {
    channelName: item.snippet.channelTitle,
    channelId: item.snippet.channelId,
    videoTitle: item.snippet.title,
    videoId: item.id.videoId,
    thumbnailUrl: item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.medium?.url ?? '',
    streamUrl: `https://youtube.com/watch?v=${item.id.videoId}`,
    channelAvatarUrl,
  };
}
