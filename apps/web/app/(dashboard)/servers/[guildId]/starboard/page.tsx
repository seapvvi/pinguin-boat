'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Star, Settings, ChevronLeft, ChevronRight, BarChart3, MessageSquare
} from 'lucide-react';
import { Button, Skeleton, EmptyState, ErrorMessage, Input, Toggle } from '@pinguin/ui';
import {
  fetchStarboardSettings, updateStarboardSettings, fetchStarboardEntries,
} from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { ModuleToggle } from '@/components/ModuleToggle';
import { DiscordSelect } from '@/components/DiscordSelect';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionCard } from '@/components/layout/SectionCard';
import { ModuleGrid } from '@/components/layout/ModuleGrid';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<{ channelId?: string; starEmoji?: string; minStars?: number; selfStar?: boolean } | null>(null);

  const [channelId, setChannelId] = useState('');
  const [starEmoji, setStarEmoji] = useState('\u2B50');
  const [minStars, setMinStars] = useState(3);
  const [selfStar, setSelfStar] = useState(false);
  const [saving, setSaving] = useState(false);

  const [entries, setEntries] = useState<StarboardEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [entriesLoading, setEntriesLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchStarboardSettings(guildId);
      const data = (res as { data?: { settings?: { channelId?: string; starEmoji?: string; minStars?: number; selfStar?: boolean } } })?.data;
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
      const data = (res as { data?: { entries?: StarboardEntry[]; pagination?: { totalPages?: number } } })?.data;
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const statsThisMonth = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEntries = entries.filter(e => new Date(e.createdAt) >= startOfMonth);
    const topContributors = Object.entries(
      monthEntries.reduce<Record<string, { username: string; count: number; avatar: string | null }>>((acc, e) => {
        if (!acc[e.authorId]) acc[e.authorId] = { username: e.author.username, count: 0, avatar: e.author.avatar };
        acc[e.authorId].count++;
        return acc;
      }, {})
    )
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5);
    return { total: monthEntries.length, topContributors };
  }, [entries]);

  if (error && !settings) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <PageLayout
        title="Starboard"
        description="Mettez en avant les meilleurs messages de votre serveur."
      >
        {error && (
          <div className="text-sm text-[var(--error)] bg-[var(--error)]/10 px-3 py-2 mb-4">{error}</div>
        )}

        <div className="mb-4">
          <ModuleToggle guildId={guildId} moduleKey="starboard" label="Starboard" />
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : (
          <div className="space-y-6">
            <ModuleGrid>
              <SectionCard title="Configuration" icon={<Settings size={16} />}>
                <div className="space-y-4">
                  <DiscordSelect guildId={guildId} type="channel" value={channelId} onChange={setChannelId} placeholder="Sélectionner un salon" label="Salon du starboard" />
                  <Input label="Emoji de réaction" value={starEmoji} onChange={(e) => setStarEmoji(e.target.value)} placeholder="⭐" />
                  <Input label="Seuil de réactions" type="number" value={String(minStars)} onChange={(e) => setMinStars(parseInt(e.target.value) || 1)} min={1} max={50} />
                  <div className="flex items-center gap-3 pt-2">
                    <Toggle checked={selfStar} onChange={setSelfStar} />
                    <label className="text-sm text-[var(--text-primary)]">Autoriser l'auto-star</label>
                  </div>
                  <div className="pt-2">
                    <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
                      Sauvegarder
                    </Button>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Statistiques" icon={<BarChart3 size={16} />}>
                <div className="space-y-4">
                  <div className="p-3 bg-[var(--bg-surface-alt)] text-center">
                    <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Messages starboardés ce mois</p>
                    <p className="text-2xl font-bold text-[var(--accent)] mt-1">{statsThisMonth.total}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase mb-2">Top contributeurs</p>
                    {statsThisMonth.topContributors.length === 0 ? (
                      <p className="text-xs text-[var(--text-secondary)]">Aucun contributeur ce mois.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {statsThisMonth.topContributors.map(([id, c], i) => (
                          <div key={id} className="flex items-center gap-2 text-sm">
                            <span className="text-xs font-bold text-[var(--text-secondary)] w-4">#{i + 1}</span>
                            <span className="text-[var(--text-primary)] truncate">{c.username}</span>
                            <span className="text-xs font-mono text-[var(--accent)] ml-auto">{c.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </SectionCard>
            </ModuleGrid>

            <SectionCard title="Messages récents" icon={<MessageSquare size={16} />}>
              {entriesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
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
                      <div key={entry.id} className="flex items-start gap-3 p-4 border border-[var(--border-color)] bg-[var(--bg-surface)]">
                        <div className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-surface-alt)] text-sm font-semibold shrink-0">
                          <span>{starEmoji}</span>
                          <span className="text-[var(--text-primary)]">{entry.starCount}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-5 h-5 bg-[var(--bg-surface-alt)] flex items-center justify-center text-[10px] font-semibold text-[var(--text-secondary)]">
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
                                className="max-w-xs max-h-48 object-cover"
                                loading="lazy"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 pt-4">
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
            </SectionCard>
          </div>
        )}
      </PageLayout>
    </motion.div>
  );
}
