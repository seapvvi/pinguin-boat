import { Client, Guild, VoiceChannel, TextChannel, Snowflake } from 'discord.js';
import type { TrackInfo } from '@pinguin/shared';
import { getConfig } from '@pinguin/config';
import { prisma } from '@pinguin/db';

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
  player: any | null;
  connection: any | null;
  destroyed: boolean;
}

const states = new Map<string, GuildMusicState>();

export function getState(guildId: string): GuildMusicState {
  let state = states.get(guildId);
  if (!state) {
    state = {
      queue: [],
      currentTrack: null,
      position: 0,
      loopMode: LoopMode.NONE,
      autoplay: false,
      volume: 50,
      voiceChannelId: null,
      textChannelId: null,
      player: null,
      connection: null,
      destroyed: false,
    };
    states.set(guildId, state);
  }
  return state;
}

export function destroyState(guildId: string): void {
  const state = states.get(guildId);
  if (state) {
    state.destroyed = true;
    try { state.player?.stop(); } catch {}
    try { state.connection?.destroy(); } catch {}
    states.delete(guildId);
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

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}


