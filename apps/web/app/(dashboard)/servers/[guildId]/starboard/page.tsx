'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Star, Settings, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Card, Button, Badge, Skeleton, EmptyState, ErrorMessage, Input, Toggle } from '@pinguin/ui';
import {
  fetchStarboardSettings, updateStarboardSettings, fetchStarboardEntries,
} from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { ModuleToggle } from '@/components/ModuleToggle';
import { DiscordSelect } from '@/components/DiscordSelect';

interface StarboardEntry {
  id: string;
  originalId: string;
  starboardId: string | null;
  authorId: string;
  starCount: number;
  content: string;
  attachment: string | null;
  createdAt: string;
  author: { discordId: string; username: string; avatar: string | null };
}

export default function StarboardPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);

  const [channelId, setChannelId] = useState('');
  const [starEmoji, setStarEmoji] = useState('\u2B50');
  const [minStars, setMinStars] = useState(3);
  const [selfStar, setSelfStar] = useState(false);
  const [saving, setSaving] = useState(false);

  const [entries, setEntries] = useState<StarboardEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [entriesLoading, setEntriesLoading] = useState(true);

  const [tab, setTab] = useState<'settings' | 'entries'>('settings');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchStarboardSettings(guildId);
      const data = (res as any)?.data;
      if (data?.settings) {
        setSettings(data.settings);
        setChannelId(data.settings.channelId ?? '');
        setStarEmoji(data.settings.starEmoji ?? '\u2B50');
        setMinStars(data.settings.minStars ?? 3);
        setSelfStar(data.settings.selfStar ?? false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  const loadEntries = useCallback(async (p: number) => {
    setEntriesLoading(true);
    try {
      const res = await fetchStarboardEntries(guildId, { page: String(p), limit: '15' });
      const data = (res as any)?.data;
      if (data) {
        setEntries(data.entries ?? []);
        setTotalPages(data.pagination?.totalPages ?? 1);
      }
    } catch { } finally {
      setEntriesLoading(false);
    }
  }, [guildId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadEntries(page); }, [loadEntries, page]);

  useEffect(() => {
    const interval = setInterval(() => {
      load();
      loadEntries(page);
    }, 10000);
    return () => clearInterval(interval);
  }, [load, loadEntries, page]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateStarboardSettings(guildId, {
        channelId: channelId || null,
        starEmoji,
        minStars,
        selfStar,
      });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (error && !settings) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Starboard</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Mettez en avant les meilleurs messages de votre serveur.</p>
        </div>
        <ModuleToggle guildId={guildId} moduleKey="starboard" label="Starboard" />
      </div>

      {error && (
        <div className="rounded-[var(--radius-sm)] border border-[var(--error)] bg-[var(--error)]/10 p-3 text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-[var(--radius)]" />)}
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-2 border-b border-[var(--border-color)]">
            <button
              onClick={() => setTab('settings')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === 'settings'
                  ? 'border-[var(--accent)] text-[var(--text-primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Settings size={14} className="inline mr-1.5" />
              Configuration
            </button>
            <button
              onClick={() => setTab('entries')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === 'entries'
                  ? 'border-[var(--accent)] text-[var(--text-primary)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Star size={14} className="inline mr-1.5" />
              Messages ({entries.length})
            </button>
          </div>

          {tab === 'settings' && (
            <Card className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">Salon du starboard</label>
                  <DiscordSelect guildId={guildId} type="channel" value={channelId} onChange={setChannelId} placeholder="Sélectionner un salon" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">Emoji de réaction</label>
                  <Input value={starEmoji} onChange={(e) => setStarEmoji(e.target.value)} placeholder="\u2B50" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">Nombre minimum de {starEmoji}</label>
                  <Input type="number" value={String(minStars)} onChange={(e) => setMinStars(parseInt(e.target.value) || 1)} min={1} max={50} />
                </div>
                <div className="flex items-center gap-3 pt-4">
                  <Toggle checked={selfStar} onChange={setSelfStar} />
                  <label className="text-sm text-[var(--text-primary)]">Autoriser l&apos;auto-star</label>
                </div>
              </div>
              <div className="pt-2">
                <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
                  Sauvegarder
                </Button>
              </div>
            </Card>
          )}

          {tab === 'entries' && (
            <div className="space-y-4">
              {entriesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-[var(--radius)]" />)}
                </div>
              ) : entries.length === 0 ? (
                <EmptyState
                  icon={<Star size={32} />}
                  title="Aucun message"
                  description="Les messages du starboard apparaîtront ici en temps réel."
                />
              ) : (
                <>
                  <div className="space-y-3">
                    {entries.map((entry) => (
                      <Card key={entry.id} className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-surface-alt)] rounded-[var(--radius-sm)] text-sm font-semibold shrink-0">
                            <span>{starEmoji}</span>
                            <span className="text-[var(--text-primary)]">{entry.starCount}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-5 h-5 rounded-full bg-[var(--bg-surface-alt)] flex items-center justify-center text-[10px] font-semibold text-[var(--text-secondary)]">
                                {entry.author.username?.charAt(0)?.toUpperCase() ?? '?'}
                              </div>
                              <span className="text-sm font-medium text-[var(--text-primary)]">{entry.author.username}</span>
                              <span className="text-xs text-[var(--text-secondary)]">{formatDate(entry.createdAt)}</span>
                            </div>
                            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap break-words">
                              {entry.content || <span className="italic">Pas de contenu textuel</span>}
                            </p>
                            {entry.attachment && (
                              <div className="mt-2">
                                <img
                                  src={entry.attachment}
                                  alt="Attachment"
                                  className="max-w-xs max-h-48 rounded-[var(--radius-sm)] object-cover"
                                  loading="lazy"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 pt-2">
                      <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                        <ChevronLeft size={14} />
                      </Button>
                      <span className="text-sm text-[var(--text-secondary)]">{page} / {totalPages}</span>
                      <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                        <ChevronRight size={14} />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
