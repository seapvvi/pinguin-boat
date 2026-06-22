import { GuildMember, VoiceChannel, TextChannel, CommandInteraction, ChatInputCommandInteraction } from 'discord.js';
import {
  joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus,
  VoiceConnectionStatus, entersState, NoSubscriberBehavior,
  AudioPlayer, VoiceConnection, StreamType, AudioPlayerState, VoiceConnectionState,
  AudioPlayerPlayingState, AudioPlayerPausedState,
} from '@discordjs/voice';
import type { TrackInfo } from '@pinguin/shared';
import { prisma } from '@pinguin/db';
import { getLogger } from '@pinguin/shared';
import { errorEmbed } from './embed';
import { spawn } from 'child_process';
import { Readable } from 'stream';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import ytDlp from 'yt-dlp-exec';

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
  // Vérifier que yt-dlp est installé
  try {
    const proc = spawn('yt-dlp', ['--version'], { stdio: ['pipe', 'pipe', 'ignore'] });
    const version = await new Promise<string>((resolve, reject) => {
      proc.stdout.once('data', (d: Buffer) => resolve(d.toString().trim()));
      proc.once('error', (e: NodeJS.ErrnoException) => {
        if (e.code === 'ENOENT') {
          reject(new Error('yt-dlp binary not found in PATH'));
        } else {
          reject(e);
        }
      });
      setTimeout(() => reject(new Error('yt-dlp version check timed out')), 5000);
    });
    musicLogger.info('yt-dlp detected', { version });
  } catch (err: unknown) {
    throw new Error(
      'yt-dlp n\'est pas installé. Installez-le via "pip install yt-dlp" ' +
      'ou téléchargez-le depuis https://github.com/yt-dlp/yt-dlp/releases'
    );
  }

  const rawCookie = process.env.YOUTUBE_COOKIE;
  if (!rawCookie || rawCookie.trim().startsWith('(optionnel') || rawCookie.trim().length < 10) {
    musicLogger.warn('YOUTUBE_COOKIE absent ou invalide — les requêtes YouTube seront non-authentifiées (risque 429)');
  } else {
    musicLogger.info('YouTube cookie will be used by yt-dlp via temp file', { cookieLength: rawCookie.length });
  }
}

const YTDLP_COOKIE_PATH: string | null = (() => {
  const raw = process.env.YOUTUBE_COOKIE;
  if (!raw || raw.trim().startsWith('(optionnel') || raw.trim().length < 10) return null;
  const path = join(tmpdir(), `pinguin-ytdlp-cookies-${Date.now()}.txt`);
  try {
    // Write Netscape HTTP Cookie Format — yt-dlp expects # Netscape HTTP Cookie File header
    const lines = [
      '# Netscape HTTP Cookie File',
      '.youtube.com\tTRUE\t/\tTRUE\t9999999999\tYOUTUBE_COOKIE\t' + raw.replace(/\t/g, ' '),
    ];
    writeFileSync(path, lines.join('\n'), 'utf-8');
    musicLogger.info('Wrote temporary cookies.txt for yt-dlp', { path });
    return path;
  } catch (e) {
    musicLogger.warn('Failed to write cookies.txt for yt-dlp', { err: (e as Error).message });
    return null;
  }
})();

// Clean up the temporary cookies file on exit
export function cleanupCookieFile(): void {
  if (YTDLP_COOKIE_PATH && existsSync(YTDLP_COOKIE_PATH)) {
    try { unlinkSync(YTDLP_COOKIE_PATH); } catch {}
  }
}

if (YTDLP_COOKIE_PATH) {
  process.once('exit', () => {
    cleanupCookieFile();
  });
}

function createYtDlpStream(url: string, startTime?: number): Readable {
  const args = [
    '--no-playlist',
    '-f', 'bestaudio/best',
    '-o', '-',
    '--quiet',
    '--no-warnings',
  ];

  if (startTime !== undefined) {
    args.push('--download-sections', `*${startTime}-inf`);
  }

  if (YTDLP_COOKIE_PATH) {
    args.push('--cookies', YTDLP_COOKIE_PATH);
  }

  args.push(url);

  const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });

  proc.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'ENOENT') {
      throw new Error(
        'yt-dlp n\'est pas installé. Installez-le via "pip install yt-dlp" ' +
        'ou téléchargez-le depuis https://github.com/yt-dlp/yt-dlp/releases'
      );
    }
    throw err;
  });

  proc.stderr.on('data', (d: Buffer) => {
    musicLogger.warn('[yt-dlp]', { stderr: d.toString().trim() });
  });

  proc.stdout.on('error', (err: Error) => {
    musicLogger.error('yt-dlp stream error', { err: err.message });
  });

  return proc.stdout as Readable;
}

async function createStreamFromUrl(url: string, startTime?: number): Promise<{ stream: Readable; type: StreamType }> {
  const stream = createYtDlpStream(url, startTime);
  return { stream, type: StreamType.Arbitrary };
}

export enum LoopMode {
  NONE = 'NONE',
  TRACK = 'TRACK',
  QUEUE = 'QUEUE',
}

interface GuildMusicState {
  queue: TrackInfo[];
  currentTrack: TrackInfo | null;
  history: TrackInfo[];
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
      queue: [], currentTrack: null, history: [], position: 0,
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
    state.player.on('stateChange', (oldState: AudioPlayerState, newState: AudioPlayerState) => {
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
    if (state.autoplay && state.currentTrack) {
      try {
        const raw = await ytDlp(`ytsearch1:${state.currentTrack.title} mix`, {
          dumpSingleJson: true,
          noWarnings: true,
          preferFreeFormats: true,
          skipDownload: true,
          noPlaylist: true,
          cookies: YTDLP_COOKIE_PATH ?? undefined,
        });
        const data = Array.isArray(raw) ? raw[0] : raw;
        if (data && data.webpage_url) {
          state.queue.push({
            title: data.title ?? 'Inconnu',
            url: data.webpage_url,
            duration: data.duration ?? 0,
            thumbnail: data.thumbnail ?? '',
            author: data.channel ?? data.uploader ?? 'Inconnu',
            source: 'YOUTUBE',
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        musicLogger.error('Autoplay search failed', { guildId, err: message });
      }
    }

    if (state.queue.length === 0) {
      state.currentTrack = null;
      state.player?.stop();
      saveQueueToDb(guildId);
      return;
    }
  }

  if (state.loopMode === LoopMode.QUEUE && state.currentTrack) {
    state.queue.push(state.currentTrack);
  }

  if (state.currentTrack) {
    state.history.push(state.currentTrack);
  }
  state.currentTrack = state.queue.shift()!;
  state.position = 0;
  saveQueueToDb(guildId);
  await playTrack(guildId, state.currentTrack);
}

async function playTrack(guildId: string, track: TrackInfo, startTime?: number): Promise<void> {
  const state = getState(guildId);
  if (state.destroyed || !state.connection) return;

  let streamData: { stream: Readable; type: StreamType };
  try {
    streamData = await createStreamFromUrl(track.url, startTime);
  } catch (streamErr: unknown) {
    const message = streamErr instanceof Error ? streamErr.message : String(streamErr);
    musicLogger.error('Stream error', { guildId, title: track.title, err: message });

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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    musicLogger.error('Error playing', { guildId, title: track.title, err: message });

    playNext(guildId).catch(() => {});
  }
}

export async function play(guildId: string, query: string, requester: GuildMember, textChannel: TextChannel): Promise<TrackInfo | null> {
  const state = getState(guildId);
  const voiceChannel = requester.voice.channel as VoiceChannel;
  if (!voiceChannel) throw new Error('Tu dois être dans un salon vocal.');

  let trackUrl: string;
  let track: TrackInfo;

  // yt-dlp-exec for both direct URLs and text searches
  try {
    const isYouTubeUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//.test(query.trim());

    const ytDlpOptions = {
      dumpSingleJson: true,
      noWarnings: true,
      preferFreeFormats: true,
      skipDownload: true,
      noPlaylist: true,
      cookies: YTDLP_COOKIE_PATH ?? undefined,
    } as const;

    if (isYouTubeUrl) {
      const raw = await ytDlp(query, ytDlpOptions);
      const data = Array.isArray(raw) ? raw[0] : raw;
      if (!data) throw new Error('Aucune information trouvée pour cette URL.');

      trackUrl = data.webpage_url ?? query;
      track = {
        title: data.title ?? 'Inconnu',
        url: trackUrl,
        duration: data.duration ?? 0,
        thumbnail: data.thumbnail ?? '',
        author: data.channel ?? data.uploader ?? 'Inconnu',
        source: 'YOUTUBE',
      };
    } else {
      const raw = await ytDlp(`ytsearch1:${query}`, ytDlpOptions);
      const data = Array.isArray(raw) ? raw[0] : raw;
      if (!data) throw new Error('Aucun résultat trouvé.');

      trackUrl = data.webpage_url ?? '';
      if (!trackUrl) throw new Error('URL introuvable dans le résultat de recherche.');
      track = {
        title: data.title ?? 'Inconnu',
        url: trackUrl,
        duration: data.duration ?? 0,
        thumbnail: data.thumbnail ?? '',
        author: data.channel ?? data.uploader ?? 'Inconnu',
        source: 'YOUTUBE',
      };
    }
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    musicLogger.error('yt-dlp search/info failed', { err: errMessage, query });
    if (errMessage.includes('429') || errMessage.includes('Too Many Requests') || errMessage.includes('HTTP Error 429')) {
      throw new Error('YouTube bloque les requêtes. Vérifiez la variable d\'environnement YOUTUBE_COOKIE dans le fichier .env.');
    }
    throw new Error(`Erreur lors de la recherche: ${errMessage}`);
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
    connection.on('stateChange', async (_oldState: VoiceConnectionState, newState: VoiceConnectionState) => {
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
  await saveQueueToDb(guildId);
  destroyState(guildId);
}

export async function seek(guildId: string, seconds: number): Promise<void> {
  const state = getState(guildId);
  if (!state.currentTrack) return;
  state.position = seconds;
  await playTrack(guildId, state.currentTrack, seconds);
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
  if (player?.state.status === AudioPlayerStatus.Playing || player?.state.status === AudioPlayerStatus.Paused) {
    const resource = (player.state as AudioPlayerPlayingState | AudioPlayerPausedState).resource;
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
        loopMode: state.loopMode,
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
        loopMode: state.loopMode,
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
    state.loopMode = data.loopMode as LoopMode;
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

interface MusicSettingsCache {
  id: string;
  guildId: string;
  enabled: boolean;
  maxQueueLength: number;
  maxPlaylistLength: number;
  defaultVolume: number;
  allowDjRole: boolean;
  djRoleId: string | null;
  restrictToVoiceChannel: boolean;
  voiceChannelId: string | null;
  announceTracks: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const musicSettingsCache = new Map<string, { data: MusicSettingsCache; at: number }>();
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
