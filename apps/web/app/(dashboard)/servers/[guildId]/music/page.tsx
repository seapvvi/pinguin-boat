'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Play, Pause, SkipForward, SkipBack, Square, Volume2, Shuffle, Repeat,
  ListMusic, Disc3, Settings, Headphones, MicVocal
} from 'lucide-react';
import { Card, Toggle, Input, Button, Badge, Skeleton, EmptyState } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchGuildSettings, updateGuildSettings, api } from '@/lib/api';
import { formatDuration } from '@/lib/utils';
import type { MusicSettings, TrackInfo } from '@pinguin/shared';
import { ModuleToggle } from '@/components/ModuleToggle';
import { DiscordSelect } from '@/components/DiscordSelect';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionCard } from '@/components/layout/SectionCard';
import { ModuleGrid } from '@/components/layout/ModuleGrid';

export default function MusicPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);
  const [local, setLocal] = useState<MusicSettings | null>(null);
  const [queue, setQueue] = useState<TrackInfo[]>([]);
  const [currentTrack, setCurrentTrack] = useState<TrackInfo | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [loop, setLoop] = useState<'NONE' | 'QUEUE' | 'TRACK'>('NONE');
  const [shuffle, setShuffle] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchGuildSettings(guildId);
      if (res.success && res.data) {
        setLocal({ ...res.data.guild.music });
      }
      try {
        const qData = await api.get<{ data?: { tracks?: TrackInfo[]; currentTrack?: TrackInfo | null; playing?: boolean } }>(`/api/guilds/${guildId}/music/queue`);
        if (qData.data) {
          setQueue(qData.data.tracks ?? []);
          setCurrentTrack(qData.data.currentTrack ?? null);
          setPlaying(qData.data.playing ?? false);
        }
      } catch { /* ignore */ }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);

  useEffect(() => {
    if (!local?.enabled) return;
    const interval = setInterval(async () => {
      try {
        const qData = await api.get<{ data?: { tracks?: TrackInfo[]; currentTrack?: TrackInfo | null; playing?: boolean } }>(`/api/guilds/${guildId}/music/queue`);
        if (qData.data) {
          setQueue(qData.data.tracks ?? []);
          setCurrentTrack(qData.data.currentTrack ?? null);
          setPlaying(qData.data.playing ?? false);
        }
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [guildId, local?.enabled]);

  const sendControl = async (action: string, value?: unknown) => {
    setControlError(null);
    try {
      await api.post(`/api/guilds/${guildId}/music/control`, { action, value });
    } catch (e) {
      setControlError(e instanceof Error ? e.message : 'Erreur de contrôle');
    }
  };

  const handleSave = async () => {
    if (!local) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateGuildSettings(guildId, { music: local });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </motion.div>
    );
  }

  if (loading || !local) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <PageLayout
        title="Musique"
        description="Contrôlez la lecture musicale."
        actions={<Button loading={saving} onClick={handleSave}>Enregistrer</Button>}
      >
        {saveError && (
          <div className="text-sm text-[var(--error)] bg-[var(--error)]/10 px-3 py-2 mb-4">{saveError}</div>
        )}

        <div className="mb-4">
          <ModuleToggle guildId={guildId} moduleKey="music" label="Musique" />
        </div>

        <div className="space-y-6">
          <ModuleGrid>
            <SectionCard title="Paramètres" icon={<Settings size={16} />}>
              <div className="space-y-4">
                <Input
                  label="Volume max"
                  type="number"
                  value={String(local.defaultVolume)}
                  onChange={(e) => setLocal({ ...local, defaultVolume: Number(e.target.value) })}
                />
                <Input
                  label="Durée max de file"
                  type="number"
                  value={String(local.maxQueueLength)}
                  onChange={(e) => setLocal({ ...local, maxQueueLength: Number(e.target.value) })}
                />
                <Input
                  label="Playlist max"
                  type="number"
                  value={String(local.maxPlaylistLength)}
                  onChange={(e) => setLocal({ ...local, maxPlaylistLength: Number(e.target.value) })}
                />
                <div className="flex items-center justify-between p-3 bg-[var(--bg-surface-alt)]">
                  <div>
                    <span className="text-sm text-[var(--text-primary)]">Annoncer les pistes</span>
                    <p className="text-xs text-[var(--text-secondary)]">Message dans le salon</p>
                  </div>
                  <Toggle checked={local.announceTracks} onChange={(v) => setLocal({ ...local, announceTracks: v })} />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="DJ" icon={<Headphones size={16} />}>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-[var(--bg-surface-alt)]">
                  <div>
                    <span className="text-sm text-[var(--text-primary)]">Rôle DJ actif</span>
                    <p className="text-xs text-[var(--text-secondary)]">Restreindre aux DJs</p>
                  </div>
                  <Toggle checked={local.allowDjRole} onChange={(v) => setLocal({ ...local, allowDjRole: v })} />
                </div>
                {local.allowDjRole && (
                  <Input
                    label="ID du rôle DJ"
                    value={local.djRoleId ?? ''}
                    onChange={(e) => setLocal({ ...local, djRoleId: e.target.value || null })}
                  />
                )}
                <div className="flex items-center justify-between p-3 bg-[var(--bg-surface-alt)]">
                  <div>
                    <span className="text-sm text-[var(--text-primary)]">Commandes restreintes</span>
                    <p className="text-xs text-[var(--text-secondary)]">Limite l'utilisation au salon vocal</p>
                  </div>
                  <Toggle checked={local.restrictToVoiceChannel} onChange={(v) => setLocal({ ...local, restrictToVoiceChannel: v })} />
                </div>
              </div>
            </SectionCard>
          </ModuleGrid>

          <SectionCard title="File d'attente actuelle" icon={<ListMusic size={16} />}>
            {controlError && (
              <div className="text-sm text-[var(--error)] bg-[var(--error)]/10 px-3 py-2 mb-4">{controlError}</div>
            )}

            {currentTrack ? (
              <div className="flex items-center gap-4 p-4 bg-[var(--bg-surface-alt)] mb-4">
                <img src={currentTrack.thumbnail} alt="" className="w-16 h-16 object-cover" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{currentTrack.title}</h3>
                  <p className="text-xs text-[var(--text-secondary)]">{currentTrack.author}</p>
                  <span className="text-xs text-[var(--text-secondary)]">{formatDuration(currentTrack.duration)}</span>
                </div>
                <Badge variant="info">{currentTrack.source}</Badge>
              </div>
            ) : (
              <div className="p-4 bg-[var(--bg-surface-alt)] text-center text-sm text-[var(--text-secondary)] mb-4">
                Aucune piste en cours
              </div>
            )}

            <div className="flex items-center justify-center gap-3 mb-4">
              <Button variant="ghost" size="sm" onClick={() => sendControl('PREVIOUS')}><SkipBack size={18} /></Button>
              <Button size="md" onClick={() => sendControl(playing ? 'PAUSE' : 'RESUME')}>
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => sendControl('SKIP')}><SkipForward size={18} /></Button>
              <Button variant="ghost" size="sm" onClick={() => sendControl('STOP')}><Square size={18} /></Button>
              <Button variant="ghost" size="sm" onClick={() => { setShuffle(!shuffle); sendControl('SHUFFLE'); }}>
                <Shuffle size={18} className={shuffle ? 'text-[var(--accent)]' : ''} />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => {
                const next = loop === 'NONE' ? 'QUEUE' : loop === 'QUEUE' ? 'TRACK' : 'NONE';
                setLoop(next);
                sendControl('LOOP', next);
              }}>
                <Repeat size={18} className={loop !== 'NONE' ? 'text-[var(--accent)]' : ''} />
              </Button>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <Volume2 size={16} className="text-[var(--text-secondary)]" />
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => { const v = Number(e.target.value); setVolume(v); sendControl('VOLUME', v); }}
                className="flex-1 h-1.5 appearance-none cursor-pointer bg-[var(--bg-surface-alt)] accent-[var(--accent)]"
                style={{ borderRadius: 0 }}
              />
              <span className="text-xs text-[var(--text-secondary)] w-8 text-right">{volume}%</span>
            </div>

            <div className="border-t border-[var(--border-color)] pt-4">
              <h3 className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase mb-3">File d'attente ({queue.length})</h3>
              {queue.length === 0 ? (
                <EmptyState title="File d'attente vide" description="Ajoutez des pistes avec la commande /play" />
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {queue.map((track, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 bg-[var(--bg-surface-alt)]">
                      <span className="text-xs text-[var(--text-secondary)] w-5">{i + 1}</span>
                      <img src={track.thumbnail} alt="" className="w-8 h-8 object-cover" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-[var(--text-primary)] truncate block">{track.title}</span>
                        <span className="text-xs text-[var(--text-secondary)]">{track.author}</span>
                      </div>
                      <span className="text-xs text-[var(--text-secondary)]">{formatDuration(track.duration)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Salons autorisés" icon={<MicVocal size={16} />}>
            <div className="space-y-3">
              <DiscordSelect
                type="channel"
                guildId={guildId}
                label="Salon vocal"
                value={local.voiceChannelId ?? ''}
                onChange={(id) => setLocal({ ...local, voiceChannelId: id || null })}
                placeholder="Sélectionner un salon vocal"
              />
              <p className="text-xs text-[var(--text-secondary)]">
                Laissez vide pour autoriser tous les salons vocaux.
              </p>
            </div>
          </SectionCard>
        </div>
      </PageLayout>
    </motion.div>
  );
}
