import { GuildMember, VoiceChannel, TextChannel, CommandInteraction, ChatInputCommandInteraction } from 'discord.js';
import {
  joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus,
  VoiceConnectionStatus, entersState, NoSubscriberBehavior,
  AudioPlayer, VoiceConnection, StreamType,
} from '@discordjs/voice';
import type { TrackInfo } from '@pinguin/shared';
import { prisma } from '@pinguin/db';
import { getLogger } from '@pinguin/shared';
import { errorEmbed } from './embed';

const musicLogger = getLogger({ component: 'music' });


// Ensure @discordjs/voice (prism-media) can find an FFmpeg binary even when one
// is not installed system-wide. ffmpeg-static ships a prebuilt binary and
// prism-media honours the FFMPEG_PATH environment variable.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ffmpegPath = require('ffmpeg-static');
    if (ffmpegPath && !process.env.FFMPEG_PATH) {
    process.env.FFMPEG_PATH = ffmpegPath as string;
    musicLogger.info(`Using bundled FFmpeg at ${ffmpegPath}`, { app: 'music' });
  }

  } catch {
    musicLogger.warn('ffmpeg-static not available; relying on system FFmpeg.', { app: 'music' });
  }


export async function initMusicService(): Promise<void> {
  if (process.env.YOUTUBE_COOKIE) {
    try {
      const playdl = await import('play-dl');
      await playdl.setToken({ youtube: { cookie: process.env.YOUTUBE_COOKIE } });
      musicLogger.info('YouTube cookie configured for play-dl');
    } catch (err: any) {
      musicLogger.warn('Failed to set YouTube cookie for play-dl', { err: err.message });
    }
  }
}

async function createStreamFromUrl(url: string): Promise<{ stream: any; type: StreamType }> {
  // Use play-dl as primary (more stable in 2024)
  try {
    const playdl = await import('play-dl');
    const result = await playdl.stream(url, { quality: 2, discordPlayerCompatibility: true });
    // Prevent unhandled 'error' events from crashing the process.
    result.stream.on('error', (err: Error) => {
      musicLogger.error('play-dl stream error', { err: err.message });
    });

    return { stream: result.stream, type: result.type as unknown as StreamType };
  } catch (e: any) {
    musicLogger.warn('play-dl failed, trying ytdl-core fallback', { err: e.message });
  }

  // Fallback to ytdl-core (only for stream creation, not for info/search)
  try {
    const ytdl = await import('@distube/ytdl-core');
    if (ytdl.default.validateURL(url)) {
      const stream = ytdl.default(url, {
        filter: 'audioonly',
        quality: 'highestaudio',
        highWaterMark: 1 << 25,
        requestOptions: { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } },
      });
      // ytdl emits 'error' asynchronously on the returned stream; without a
      // listener Node crashes the whole bot with an unhandled 'error' event.
      stream.on('error', (err: Error) => {
        musicLogger.error('ytdl-core stream error', { err: err.message });
      });

      return { stream, type: StreamType.Arbitrary };
    }
  } catch (e: any) {
    musicLogger.error('ytdl-core fallback also failed', { err: e.message });
  }

  throw new Error('Impossible de créer le stream audio. Vérifiez que l\'URL est valide.');
}

export enum LoopMode {
  NONE = 'NONE',
  TRACK = 'TRACK',
  QUEUE = 'QUEUE',
}

interface GuildMusicState {
  queue: TrackInfo[];
  currentTrack: TrackInfo | null;
  position: number;
  loopMode: LoopMode;
  autoplay: boolean;
  volume: number;
  voiceChannelId: string | null;
  textChannelId: string | null;
  player: AudioPlayer | null;
  connection: VoiceConnection | null;
  destroyed: boolean;
}

const states = new Map<string, GuildMusicState>();

export function getState(guildId: string): GuildMusicState {
  let state = states.get(guildId);
  if (!state) {
    state = {
      queue: [], currentTrack: null, position: 0,
      loopMode: LoopMode.NONE, autoplay: false, volume: 50,
      voiceChannelId: null, textChannelId: null,
      player: null, connection: null, destroyed: false,
    };
    states.set(guildId, state);
  }
  return state;
}

export function destroyState(guildId: string): void {
  const state = states.get(guildId);
  if (state) {
    state.destroyed = true;
    state.player?.stop();
    state.connection?.destroy();
    states.delete(guildId);
  }
}

export function getPlayer(guildId: string): AudioPlayer {
  const state = getState(guildId);
  if (!state.player) {
    state.player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Play },
    });
    state.player.on('stateChange', (oldState: any, newState: any) => {
      if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
        playNext(guildId).catch(() => {});
      }
    });
    state.player.on('error', (err: Error) => {
      musicLogger.error('Player error', { guildId, err: err.message });
      playNext(guildId).catch(() => {});
    });

  }
  return state.player;
}

async function playNext(guildId: string): Promise<void> {
  const state = getState(guildId);
  if (state.destroyed) return;

  if (state.loopMode === LoopMode.TRACK && state.currentTrack) {
    state.queue.unshift(state.currentTrack);
  }

  if (state.queue.length === 0) {
    state.currentTrack = null;
    state.player?.stop();
    saveQueueToDb(guildId);
    return;
  }

  if (state.loopMode === LoopMode.QUEUE && state.currentTrack) {
    state.queue.push(state.currentTrack);
  }

  state.currentTrack = state.queue.shift()!;
  state.position = 0;
  saveQueueToDb(guildId);
  await playTrack(guildId, state.currentTrack);
}

async function playTrack(guildId: string, track: TrackInfo): Promise<void> {
  const state = getState(guildId);
  if (state.destroyed || !state.connection) return;

  let streamData: { stream: any; type: StreamType };
  try {
    streamData = await createStreamFromUrl(track.url);
  } catch (streamErr: any) {
    musicLogger.error('Stream error', { guildId, title: track.title, err: streamErr.message });

    playNext(guildId).catch(() => {});
    return;
  }

  try {
    const resource = createAudioResource(streamData.stream, {
      inputType: streamData.type,
      inlineVolume: true,
    });
    resource.volume?.setVolume(state.volume / 100);
    const player = getPlayer(guildId);
    state.player = player;
    
    // Ensure connection is still valid before subscribing
    if (state.connection.state.status !== VoiceConnectionStatus.Ready) {
    musicLogger.warn('Connection not ready, skipping play', { guildId, title: track.title });

      playNext(guildId).catch(() => {});
      return;
    }
    
    state.connection.subscribe(player);
    player.play(resource);
    musicLogger.info('Now playing', { guildId, title: track.title, url: track.url });


    await prisma.musicHistoryEntry.create({
      data: {
        guildId,
        trackTitle: track.title,
        trackUrl: track.url,
        duration: track.duration,
        requestedById: 'internal',
        playedAt: new Date(),
      },
    }).catch(() => {});
  } catch (err: any) {
    musicLogger.error('Error playing', { guildId, title: track.title, err: err.message });

    playNext(guildId).catch(() => {});
  }
}

export async function play(guildId: string, query: string, requester: GuildMember, textChannel: TextChannel): Promise<TrackInfo | null> {
  const state = getState(guildId);
  const voiceChannel = requester.voice.channel as VoiceChannel;
  if (!voiceChannel) throw new Error('Tu dois être dans un salon vocal.');

  const playdl = await import('play-dl');

  let trackUrl: string;
  let track: TrackInfo;

  // Use play-dl as primary engine for both direct URLs and searches
  try {
    // Check if query is a direct YouTube URL
    const isYouTubeUrl = playdl.yt_validate(query) === 'video';

    if (isYouTubeUrl) {
      // Direct YouTube URL: use playdl.video_info
      const videoInfo = await playdl.video_info(query);
      const videoDetails = videoInfo.video_details;
      track = {
        title: videoDetails.title ?? 'Inconnu',
        url: videoDetails.url,
        duration: videoDetails.durationInSec ?? 0,
        thumbnail: videoDetails.thumbnails?.[0]?.url ?? '',
        author: videoDetails.channel?.name ?? 'Inconnu',
        source: 'YOUTUBE',
      };
      trackUrl = videoDetails.url;
    } else {
      // Text search: use playdl.search
      const searchResult = await playdl.search(query, { limit: 1, source: { youtube: 'video' } });
      if (!searchResult.length) throw new Error('Aucun résultat trouvé.');
      const r = searchResult[0];
      trackUrl = r.url ?? '';
      if (!trackUrl) throw new Error('URL introuvable dans le résultat de recherche.');
      track = {
        title: r.title ?? 'Inconnu',
        url: trackUrl,
        duration: r.durationInSec ?? 0,
        thumbnail: r.thumbnails?.[0]?.url ?? '',
        author: r.channel?.name ?? 'Inconnu',
        source: trackUrl.includes('youtube') || trackUrl.includes('youtu.be') ? 'YOUTUBE' : 'OTHER',
      };
    }
  } catch (err: any) {
    musicLogger.error('play-dl search/info failed', { err: err.message, query });
    // Better error message mentioning YOUTUBE_COOKIE if YouTube blocks the request
    if (err.message?.includes('429') || err.message?.includes('Too Many Requests') || err.message?.includes('cookie')) {
      throw new Error('YouTube bloque les requêtes. Vérifiez la variable d\'environnement YOUTUBE_COOKIE dans le fichier .env.');
    }
    throw new Error(`Erreur lors de la recherche: ${err.message}`);
  }

  musicLogger.info('Resolved track', { title: track.title, url: track.url });


  const botMember = voiceChannel.guild.members.me!;
  if (!voiceChannel.permissionsFor(botMember)?.has(['Connect', 'Speak'])) {
    throw new Error('Je n\'ai pas la permission de rejoindre ce salon vocal.');
  }

  const needsJoin =
    !state.connection ||
    state.connection.state.status === VoiceConnectionStatus.Disconnected ||
    state.voiceChannelId !== voiceChannel.id;

  if (needsJoin) {
    if (state.connection) {
      try {
        state.connection.destroy();
      } catch {}
      state.connection = null;
    }
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });
    connection.on('stateChange', async (_oldState: any, newState: any) => {
      if (newState.status === VoiceConnectionStatus.Disconnected) {
        musicLogger.warn('Voice disconnected, attempting reconnect', { guildId });
        try {
          await entersState(connection, VoiceConnectionStatus.Ready, 10_000);
        } catch {
          musicLogger.error('Reconnect failed, cleaning up', { guildId });
          state.connection = null;
          state.voiceChannelId = null;
        }
      }
    });
    connection.on('error', (err: Error) => {
      musicLogger.error('Voice connection error', { guildId, err: err.message });
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    } catch (err) {
      connection.destroy();
      throw new Error('Impossible de se connecter au salon vocal. Vérifiez les permissions.');
    }
    state.connection = connection;
    connection.subscribe(getPlayer(guildId));
    state.voiceChannelId = voiceChannel.id;
  } else {
    const connection = state.connection;
    if (connection && connection.state.status !== VoiceConnectionStatus.Ready) {
      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
      } catch {
        connection.destroy();
        state.connection = null;
        state.voiceChannelId = null;
        throw new Error('Connexion vocale instable, réessayez.');
      }
      connection.subscribe(getPlayer(guildId));
    }
  }

  state.voiceChannelId = voiceChannel.id;
  state.textChannelId = textChannel.id;

  if (state.currentTrack) {
    state.queue.push(track);
    saveQueueToDb(guildId);
    return track;
  }

  state.currentTrack = track;
  saveQueueToDb(guildId);
  await playTrack(guildId, track);
  return track;
}

export async function skip(guildId: string): Promise<TrackInfo | null> {
  const state = getState(guildId);
  const savedLoop = state.loopMode;
  if (savedLoop === LoopMode.TRACK) {
    state.loopMode = LoopMode.NONE;
  }
  state.player?.stop();
  state.loopMode = savedLoop;
  return state.currentTrack;
}

export async function stop(guildId: string): Promise<void> {
  const state = getState(guildId);
  state.queue = [];
  state.currentTrack = null;
  state.player?.stop();
  destroyState(guildId);
  await saveQueueToDb(guildId);
}

export async function pause(guildId: string): Promise<void> {
  getState(guildId).player?.pause();
}

export async function resume(guildId: string): Promise<void> {
  getState(guildId).player?.unpause();
}

export function setVolume(guildId: string, vol: number): void {
  const state = getState(guildId);
  state.volume = Math.max(0, Math.min(100, vol));
  // Apply to current playback
  const player = state.player;
  if (player?.state.status === AudioPlayerStatus.Playing) {
    const resource = player.state.resource;
    resource.volume?.setVolume(state.volume / 100);
  }
}

export function setLoop(guildId: string, mode: LoopMode): void {
  getState(guildId).loopMode = mode;
}

export function toggleShuffle(guildId: string): void {
  const state = getState(guildId);
  for (let i = state.queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]];
  }
}

export async function saveQueueToDb(guildId: string): Promise<void> {
  const state = getState(guildId);
  try {
    await prisma.musicQueue.upsert({
      where: { guildId },
      update: {
        tracks: JSON.stringify(state.queue),
        currentTrack: state.currentTrack ? JSON.stringify(state.currentTrack) : null,
        position: state.position,
        loopMode: state.loopMode as any,
        autoplay: state.autoplay,
        volume: state.volume,
        voiceChannelId: state.voiceChannelId,
        textChannelId: state.textChannelId,
      },
      create: {
        guildId,
        tracks: JSON.stringify(state.queue),
        currentTrack: state.currentTrack ? JSON.stringify(state.currentTrack) : null,
        position: state.position,
        loopMode: state.loopMode as any,
        autoplay: state.autoplay,
        volume: state.volume,
        voiceChannelId: state.voiceChannelId,
        textChannelId: state.textChannelId,
      },
    });
  } catch (error) {
    musicLogger.error('Erreur sauvegarde queue', { error });
  }

}

export async function loadQueueFromDb(guildId: string): Promise<void> {
  try {
    const data = await prisma.musicQueue.findUnique({ where: { guildId } });
    if (!data) return;
    const state = getState(guildId);
    state.queue = JSON.parse(data.tracks);
    state.currentTrack = data.currentTrack ? JSON.parse(data.currentTrack) : null;
    state.position = data.position;
    state.loopMode = data.loopMode as any;
    state.autoplay = data.autoplay;
    state.volume = data.volume;
    state.voiceChannelId = data.voiceChannelId;
    state.textChannelId = data.textChannelId;
  } catch (error) {
    musicLogger.error('Erreur chargement queue', { error });

  }

}

export function getQueueState(guildId: string) {
  const state = getState(guildId);
  return {
    tracks: state.queue,
    currentTrack: state.currentTrack,
    position: state.position,
    loopMode: state.loopMode,
    autoplay: state.autoplay,
    volume: state.volume,
    playing: state.player?.state.status === AudioPlayerStatus.Playing,
    paused: state.player?.state.status === AudioPlayerStatus.Paused,
  };
}

const musicSettingsCache = new Map<string, { data: any; at: number }>();
const MUSIC_SETTINGS_CACHE_MS = 30_000;

export async function getMusicSettings(guildId: string) {
  const c = musicSettingsCache.get(guildId);
  if (c && Date.now() - c.at < MUSIC_SETTINGS_CACHE_MS) return c.data;
  let settings = await prisma.musicSettings.findUnique({
    where: { guildId },
  });
  if (!settings) {
    settings = await prisma.musicSettings.create({
      data: { guildId },
    });
  }
  musicSettingsCache.set(guildId, { data: settings, at: Date.now() });
  return settings;
}

export function invalidateMusicSettingsCache(guildId: string): void {
  musicSettingsCache.delete(guildId);
}

export async function requireDjRole(interaction: CommandInteraction | ChatInputCommandInteraction): Promise<boolean> {
  if (!interaction.guild || !interaction.member) return true;

  const settings = await getMusicSettings(interaction.guild.id);
  if (!settings.djRoleId) return true;

  const member = interaction.member as GuildMember;
  if (member.permissions.has('Administrator')) return true;

  if (!member.roles.cache.has(settings.djRoleId)) {
    await interaction.reply({
      embeds: [errorEmbed('Permission refusée', 'Vous devez avoir le rôle DJ pour utiliser cette commande.')],
      ephemeral: true,
    });
    return false;
  }

  return true;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
