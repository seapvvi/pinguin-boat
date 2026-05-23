'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Gift, Plus, Trophy, Users, Clock,
  ChevronLeft, ChevronRight, RotateCcw, XCircle
} from 'lucide-react';
import { Card, Table, Input, Button, Select, Badge, Modal, Skeleton, EmptyState } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchGiveaways, api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Giveaway } from '@pinguin/shared';
import type { Column } from '@pinguin/ui';

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

export default function GiveawaysPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    prize: '', winners: 1, duration: 60,
    minAccountAge: 0, minGuildJoinTime: 0, requiredRoleId: '', boostRequired: false,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchGiveaways(guildId, { page: String(p), limit: '15' });
      if (res.success && res.data) {
        setGiveaways(res.data.giveaways);
        setTotalPages(res.data.pagination.totalPages);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(page); }, [guildId, page]);

  const handleCreate = async () => {
    const errs: Record<string, string> = {};
    if (!form.prize.trim()) errs.prize = 'Requis';
    if (form.winners < 1) errs.winners = 'Minimum 1';
    if (form.duration < 10) errs.duration = 'Minimum 10 secondes';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      await api.post(`/api/guilds/${guildId}/giveaways`, {
        prize: form.prize.trim(),
        winners: form.winners,
        duration: form.duration,
        requirements: {
          minAccountAge: form.minAccountAge || undefined,
          minGuildJoinTime: form.minGuildJoinTime || undefined,
          requiredRoleId: form.requiredRoleId.trim() || null,
          boostRequired: form.boostRequired,
        },
      });
      setCreateOpen(false);
      setForm({ prize: '', winners: 1, duration: 60, minAccountAge: 0, minGuildJoinTime: 0, requiredRoleId: '', boostRequired: false });
      load(page);
    } catch { /* ignore */ } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (id: string, action: string) => {
    try {
      await api.post(`/api/guilds/${guildId}/giveaways/${id}`, { action });
      load(page);
    } catch { /* ignore */ }
  };

  const columns: Column<Giveaway>[] = [
    { key: 'prize', label: 'Lot', sortable: true, render: (g) => <span className="text-sm font-medium">{g.prize}</span> },
    { key: 'winnerCount', label: 'Gagnants', render: (g) => <span className="text-xs">{g.winnerCount}</span> },
    { key: 'status', label: 'Statut', sortable: true, render: (g) => <Badge variant={statusVariants[g.status]}>{statusLabels[g.status]}</Badge> },
    { key: 'entries', label: 'Participants', render: (g) => <span className="text-xs">{g.entries.length}</span> },
    { key: 'endsAt', label: 'Fin', sortable: true, render: (g) => <span className="text-xs text-[var(--text-secondary)]">{formatDate(g.endsAt)}</span> },
    {
      key: 'actions', label: 'Actions', render: (g) => (
        <div className="flex items-center gap-1">
          {g.status === 'ENDED' && <Button variant="ghost" size="sm" onClick={() => handleAction(g.id, 'reroll')}><RotateCcw size={12} /></Button>}
          {g.status === 'RUNNING' && <Button variant="ghost" size="sm" onClick={() => handleAction(g.id, 'end')}><Trophy size={12} /></Button>}
          {g.status !== 'CANCELLED' && g.status !== 'ENDED' && <Button variant="ghost" size="sm" onClick={() => handleAction(g.id, 'cancel')}><XCircle size={12} /></Button>}
        </div>
      ),
    },
  ];

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <ErrorMessage title="Erreur" message={error} onRetry={() => load(page)} />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Giveaways</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Gérez les concours et giveaways.</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus size={14} /> Nouveau giveaway</Button>
      </div>

      <Card padding={false}>
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : giveaways.length === 0 ? (
          <EmptyState title="Aucun giveaway" description="Créez votre premier giveaway." icon={<Gift size={32} />} />
        ) : (
          <>
            <Table columns={columns} data={giveaways} keyExtractor={(g) => g.id} />
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-color)]">
              <span className="text-xs text-[var(--text-secondary)]">Page {page} / {totalPages}</span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft size={14} /> Précédent
                </Button>
                <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Suivant <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau giveaway">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <Input label="Lot" value={form.prize} onChange={(e) => setForm({ ...form, prize: e.target.value })} error={formErrors.prize} placeholder="Ex: 100€ PayPal" />
          <Input label="Nombre de gagnants" type="number" value={String(form.winners)} onChange={(e) => setForm({ ...form, winners: Number(e.target.value) })} error={formErrors.winners} />
          <Input label="Durée (secondes)" type="number" value={String(form.duration)} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} error={formErrors.duration} />
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Prérequis</h3>
          <Input label="Âge min. du compte (jours)" type="number" value={String(form.minAccountAge)} onChange={(e) => setForm({ ...form, minAccountAge: Number(e.target.value) })} />
          <Input label="Ancienneté min. sur le serveur (jours)" type="number" value={String(form.minGuildJoinTime)} onChange={(e) => setForm({ ...form, minGuildJoinTime: Number(e.target.value) })} />
          <Input label="ID du rôle requis" value={form.requiredRoleId} onChange={(e) => setForm({ ...form, requiredRoleId: e.target.value })} placeholder="Optionnel" />
          <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
            <span className="text-sm text-[var(--text-primary)]">Boost requis</span>
            <input type="checkbox" checked={form.boostRequired} onChange={(e) => setForm({ ...form, boostRequired: e.target.checked })} className="accent-[var(--accent)]" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button loading={submitting} onClick={handleCreate}>Créer</Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
