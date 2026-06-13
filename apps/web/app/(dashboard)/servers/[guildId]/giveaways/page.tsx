'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Gift, Plus, Trophy, BarChart3,
  ChevronLeft, ChevronRight, RotateCcw, XCircle, Trash2,
  Clock, History
} from 'lucide-react';
import { Card, Table, Input, Button, Select, Badge, Modal, Skeleton, EmptyState } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchGiveaways, fetchGuildChannels, api } from '@/lib/api';
import { useBackgroundRefresh } from '@/lib/hooks';
import { formatDate } from '@/lib/utils';
import type { APIResponse, Giveaway } from '@pinguin/shared';
import type { Column } from '@pinguin/ui';
import { ModuleToggle } from '@/components/ModuleToggle';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionCard } from '@/components/layout/SectionCard';
import { ModuleGrid } from '@/components/layout/ModuleGrid';

const statusLabels: Record<string, string> = {
  RUNNING: 'En cours',
  ENDING_SOON: 'Bientôt fini',
  ENDED: 'Terminé',
  CANCELLED: 'Annulé',
};

const statusVariants: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  RUNNING: 'success',
  ENDING_SOON: 'warning',
  ENDED: 'default',
  CANCELLED: 'error',
};

type GiveawayStats = {
  entryCount: number;
  winners?: { username: string; id: string }[];
  participants?: { userId: string; username: string }[];
};

export default function GiveawaysPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    prize: '', winners: 1, duration: 60, channelId: '',
    minAccountAge: 0, minGuildJoinTime: 0, requiredRoleId: '', boostRequired: false,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsData, setStatsData] = useState<GiveawayStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = async (p: number, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetchGiveaways(guildId, { page: String(p), limit: '15' });
      if (res.success && res.data) {
        setGiveaways(res.data.giveaways);
        setTotalPages(res.data.pagination.totalPages);
      }
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { load(page); }, [guildId, page]);
  useBackgroundRefresh((silent) => load(page, silent), 10000, [guildId, page]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchGuildChannels(guildId).then((res) => {
      if (!res.success || !res.data || cancelled) return;
      const availableChannels = res.data.channels.filter((c) => c.type === 0 && c.name !== '📢｜annonces').map((c) => ({
        id: String(c.id),
        name: String(c.name),
        type: Number(c.type),
      }));
      setChannels(availableChannels);
      setForm((prev) => {
        const hasCurrent = availableChannels.some((c: { id: string }) => c.id === prev.channelId);
        const nextChannelId = hasCurrent ? prev.channelId : (availableChannels[0]?.id ?? '');
        return nextChannelId === prev.channelId ? prev : { ...prev, channelId: nextChannelId };
      });
    }).catch(() => {
      if (!cancelled) setChannels([]);
    });
    return () => { cancelled = true; };
  }, [guildId]);

  const handleCreate = async () => {
    const errs: Record<string, string> = {};
    if (!form.prize.trim()) errs.prize = 'Requis';
    if (form.winners < 1) errs.winners = 'Minimum 1';
    if (form.duration < 10) errs.duration = 'Minimum 10 secondes';
    if (!form.channelId) errs.channelId = 'Salon requis';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    setActionError(null);
    try {
      await api.post(`/api/guilds/${guildId}/giveaways`, {
        prize: form.prize.trim(),
        winners: form.winners,
        duration: form.duration,
        channelId: form.channelId,
        requirements: {
          minAccountAge: form.minAccountAge || undefined,
          minGuildJoinTime: form.minGuildJoinTime || undefined,
          requiredRoleId: form.requiredRoleId.trim() || null,
          boostRequired: form.boostRequired,
        },
      });
      setForm({ prize: '', winners: 1, duration: 60, channelId: '', minAccountAge: 0, minGuildJoinTime: 0, requiredRoleId: '', boostRequired: false });
      load(page);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur lors de la création');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id: string, action: string) => {
    setActionError(null);
    try {
      if (action === 'end') {
        await api.put(`/api/guilds/${guildId}/giveaways/${id}`, { status: 'ENDED' });
      } else if (action === 'cancel') {
        await api.put(`/api/guilds/${guildId}/giveaways/${id}`, { status: 'CANCELLED' });
      } else if (action === 'reroll') {
        await api.put(`/api/guilds/${guildId}/giveaways/${id}`, { status: 'ENDED', reroll: true });
      } else if (action === 'delete') {
        await api.delete(`/api/guilds/${guildId}/giveaways/${id}`);
      }
      load(page);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur lors de l\'action');
    }
  };

  const formatCountdown = (endsAt: string | number | Date) => {
    const diff = new Date(endsAt).getTime() - now;
    if (diff <= 0) return 'Terminé';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const activeGiveaways = giveaways.filter((g) => g.status === 'RUNNING' || g.status === 'ENDING_SOON');
  const historyGiveaways = giveaways.filter((g) => g.status === 'ENDED' || g.status === 'CANCELLED');

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <ErrorMessage title="Erreur" message={error} onRetry={() => load(page)} />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <PageLayout
        title="Giveaways"
        description="Gérez les concours et giveaways."
      >
        <div className="mb-4"><ModuleToggle guildId={guildId} moduleKey="giveaways" label="Giveaways" /></div>

        <ModuleGrid>
          <SectionCard title="Créer un giveaway" icon={<Gift size={16} />}>
            <div className="space-y-4">
              <Input label="Lot" value={form.prize} onChange={(e) => setForm({ ...form, prize: e.target.value })} error={formErrors.prize} placeholder="Ex: 100€ PayPal" />
              <Input label="Nombre de gagnants" type="number" value={String(form.winners)} onChange={(e) => setForm({ ...form, winners: Number(e.target.value) })} error={formErrors.winners} />
              <Input label="Durée (secondes)" type="number" value={String(form.duration)} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} error={formErrors.duration} />
              <Select label="Salon" options={channels.map((c) => ({ value: c.id, label: `#${c.name}` }))} value={form.channelId} onChange={(e) => setForm({ ...form, channelId: e.target.value })} />
              {formErrors.channelId && <span className="text-xs text-[var(--error)]">{formErrors.channelId}</span>}
              <h3 className="text-xs font-semibold text-[var(--text-secondary)] tracking-wide uppercase">Prérequis</h3>
              <Input label="Âge min. du compte (jours)" type="number" value={String(form.minAccountAge)} onChange={(e) => setForm({ ...form, minAccountAge: Number(e.target.value) })} />
              <Input label="Ancienneté min. sur le serveur (jours)" type="number" value={String(form.minGuildJoinTime)} onChange={(e) => setForm({ ...form, minGuildJoinTime: Number(e.target.value) })} />
              <Input label="ID du rôle requis" value={form.requiredRoleId} onChange={(e) => setForm({ ...form, requiredRoleId: e.target.value })} placeholder="Optionnel" />
              <div className="flex items-center justify-between p-3 bg-[var(--bg-surface-alt)]">
                <span className="text-sm text-[var(--text-primary)]">Boost requis</span>
                <input type="checkbox" checked={form.boostRequired} onChange={(e) => setForm({ ...form, boostRequired: e.target.checked })} className="accent-[var(--accent)]" />
              </div>
              {actionError && <div className="text-sm text-[var(--error)] bg-[var(--error-bg)] p-2">{actionError}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <Button loading={submitting} onClick={handleCreate}>Créer le giveaway</Button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Giveaways actifs" icon={<Clock size={16} />}>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : activeGiveaways.length === 0 ? (
              <EmptyState title="Aucun giveaway actif" description="Créez votre premier giveaway." icon={<Gift size={32} />} />
            ) : (
              <div className="space-y-3">
                {activeGiveaways.map((g) => (
                  <div key={g.id} className="flex items-center justify-between p-3 bg-[var(--bg-surface-alt)]">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-[var(--text-primary)] truncate">{g.prize}</span>
                        <Badge variant={statusVariants[g.status]}>{statusLabels[g.status]}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                        <span>{(g as Giveaway & { entryCount?: number }).entryCount ?? g.entries?.length ?? 0} participant(s)</span>
                        <span>{g.winnerCount} gagnant(s)</span>
                        <span className="font-mono text-[var(--accent)]">{formatCountdown(g.endsAt)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0 ml-3">
                      <Button variant="ghost" size="sm" onClick={() => handleAction(g.id, 'end')}><Trophy size={12} /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleAction(g.id, 'cancel')}><XCircle size={12} /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleAction(g.id, 'delete')}><Trash2 size={12} /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </ModuleGrid>

        <div className="mt-6">
          <SectionCard title="Historique" icon={<History size={16} />}>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : historyGiveaways.length === 0 ? (
              <EmptyState title="Aucun historique" description="Les giveaways terminés apparaîtront ici." icon={<History size={32} />} />
            ) : (
              <div className="space-y-2">
                {historyGiveaways.map((g) => (
                  <div key={g.id} className="flex items-center justify-between p-3 bg-[var(--bg-surface-alt)]">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-sm font-medium text-[var(--text-primary)] truncate">{g.prize}</span>
                      <Badge variant={statusVariants[g.status]}>{statusLabels[g.status]}</Badge>
                      <span className="text-xs text-[var(--text-secondary)]">{(g as Giveaway & { entryCount?: number }).entryCount ?? g.entries?.length ?? 0} participants</span>
                      <span className="text-xs text-[var(--text-secondary)]">{formatDate(g.endsAt)}</span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={async () => {
                        setStatsLoading(true);
                        setStatsOpen(true);
                        try {
                          const res = await api.get<APIResponse<GiveawayStats>>(`/api/guilds/${guildId}/giveaways/${g.id}/stats`);
                          if (res.success && res.data) setStatsData(res.data);
                        } finally { setStatsLoading(false); }
                      }}><BarChart3 size={12} /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleAction(g.id, 'reroll')}><RotateCcw size={12} /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleAction(g.id, 'delete')}><Trash2 size={12} /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </PageLayout>

      <Modal open={statsOpen} onClose={() => { setStatsOpen(false); setStatsData(null); }} title="Statistiques du giveaway">
        {statsLoading ? (
          <Skeleton className="h-32" />
        ) : statsData ? (
          <div className="space-y-4 text-sm">
            <p><strong>Participants :</strong> {statsData.entryCount}</p>
            {(statsData.winners?.length ?? 0) > 0 && (
              <div>
                <p className="font-medium mb-2">Gagnants</p>
                <ul className="list-disc pl-4">
                  {(statsData.winners ?? []).map((w: { username: string; id: string }) => (
                    <li key={w.id}>{w.username} <code className="text-xs">{w.id}</code></li>
                  ))}
                </ul>
              </div>
            )}
            {(statsData.participants?.length ?? 0) > 0 && (
              <div>
                <p className="font-medium mb-2">Liste des participants</p>
                <ul className="max-h-48 overflow-y-auto space-y-1">
                  {(statsData.participants ?? []).map((p: { userId: string; username: string }) => (
                    <li key={p.userId} className="text-xs">{p.username}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </motion.div>
  );
}
