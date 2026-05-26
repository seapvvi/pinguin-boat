import { GuildMember, VoiceChannel, TextChannel } from 'discord.js';
import {
  joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus,
  VoiceConnectionStatus, entersState, NoSubscriberBehavior,
  AudioPlayer, VoiceConnection, StreamType,
} from '@discordjs/voice';
import type { TrackInfo } from '@pinguin/shared';
import { prisma } from '@pinguin/db';

async function createStreamFromUrl(url: string): Promise<{ stream: any; type: StreamType }> {
  // Try ytdl-core first (most reliable for YouTube)
  try {
    const ytdl = await import('@distube/ytdl-core');
    if (ytdl.default.validateURL(url)) {
      const stream = ytdl.default(url, {
        filter: 'audioonly',
        quality: 'highestaudio',
        highWaterMark: 1 << 25,
      });
      return { stream, type: StreamType.Arbitrary };
    }
  } catch (e: any) {
    console.warn('[Music] ytdl-core failed, trying play-dl:', e.message);
  }

  // Fallback to play-dl
  const playdl = await import('play-dl');
  const result = await playdl.stream(url, { quality: 2 });
  return { stream: result.stream, type: result.type as unknown as StreamType };
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
      console.error(`[Music] Player error in ${guildId}:`, err.message);
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
    console.error(`[Music] Stream error for "${track.title}":`, streamErr.message);
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
    state.connection.subscribe(player);
    player.play(resource);
    console.log(`[Music] Now playing: "${track.title}" in guild ${guildId}`);

    prisma.musicHistoryEntry.create({
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
    console.error(`[Music] Error playing "${track.title}":`, err.message);
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

  // If direct YouTube URL, validate and get info directly
  try {
    const ytdl = await import('@distube/ytdl-core');
    if (ytdl.default.validateURL(query)) {
      const info = await ytdl.default.getInfo(query);
      const details = info.videoDetails;
      track = {
        title: details.title ?? 'Inconnu',
        url: details.video_url,
        duration: parseInt(details.lengthSeconds, 10) || 0,
        thumbnail: details.thumbnails?.[details.thumbnails.length - 1]?.url ?? '',
        author: details.author?.name ?? 'Inconnu',
        source: 'YOUTUBE',
      };
      trackUrl = details.video_url;
    } else {
      throw new Error('Not a direct URL');
    }
  } catch {
    // Search via play-dl
    const searchResult = await playdl.search(query, { limit: 1, source: { youtube: 'video' } });
    if (!searchResult.length) throw new Error('Aucun résultat trouvé.');
    const r = searchResult[0];
    trackUrl = (r as any).url ?? r.url ?? '';
    if (!trackUrl) throw new Error('URL introuvable dans le résultat de recherche.');
    track = {
      title: (r as any).title ?? 'Inconnu',
      url: trackUrl,
      duration: (r as any).durationInSec ?? 0,
      thumbnail: (r as any).thumbnails?.[0]?.url ?? (r as any).thumbnail ?? '',
      author: r.channel?.name ?? 'Inconnu',
      source: trackUrl.includes('youtube') || trackUrl.includes('youtu.be') ? 'YOUTUBE' : 'OTHER',
    };
  }

  console.log(`[Music] Resolved track: "${track.title}" -> ${track.url}`);

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
      state.connection.destroy();
      state.connection = null;
    }
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });
    connection.on('stateChange', (_oldState: any, newState: any) => {
      if (newState.status === VoiceConnectionStatus.Disconnected) {
        state.connection = null;
        state.voiceChannelId = null;
      }
    });
    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    } catch {
      connection.destroy();
      throw new Error('Impossible de se connecter au salon vocal.');
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
  // Save loop mode so the stop->idle->playNext flow doesn't lose it during a skip
  const savedLoop = state.loopMode;
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
    console.error('[Music] Erreur sauvegarde queue:', error);
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
    console.error('[Music] Erreur chargement queue:', error);
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

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
