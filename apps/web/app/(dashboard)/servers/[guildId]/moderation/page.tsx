'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Shield, AlertTriangle, Ban, MicOff, UserX,
  Search, Plus, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Card, Table, Input, Button, Select, Badge, Modal, Skeleton, EmptyState } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchModCases, fetchGuildSettings, updateGuildSettings, api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { ModCase } from '@pinguin/shared';
import type { Column } from '@pinguin/ui';
import { ModerationCaseType } from '@pinguin/shared';
import { Trash2 } from 'lucide-react';
import { ModuleToggle } from '@/components/ModuleToggle';

const caseTypeLabels: Record<string, string> = {
  WARN: 'Avertissement',
  MUTE: 'Silence',
  UNMUTE: 'Désilence',
  KICK: 'Expulsion',
  BAN: 'Bannissement',
  TEMPBAN: 'Bannissement temporaire',
  UNBAN: 'Débannissement',
  TIMEOUT: 'Timeout',
};

const caseTypeVariants: Record<string, 'warning' | 'error' | 'info' | 'default'> = {
  WARN: 'warning',
  MUTE: 'warning',
  UNMUTE: 'info',
  KICK: 'error',
  BAN: 'error',
  TEMPBAN: 'error',
  UNBAN: 'info',
  TIMEOUT: 'warning',
};

export default function ModerationPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [cases, setCases] = useState<ModCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ userId: '', type: ModerationCaseType.WARN, reason: '', duration: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/api/guilds/${guildId}/moderation/${deleteTarget}`);
      setDeleteTarget(null);
      load(page);
    } catch (e: any) {
      setDeleteError(e?.message || 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  const load = async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchModCases(guildId, { page: String(p), limit: '15' });
      if (res.success && res.data) {
        setCases(res.data.cases);
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
    if (!form.userId.trim()) errs.userId = 'Requis';
    if (!form.reason.trim()) errs.reason = 'Requis';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    setFormErrors({});
    try {
      const res = await api.post(`/api/guilds/${guildId}/moderation`, {
        type: form.type,
        userId: form.userId.trim(),
        reason: form.reason.trim(),
        duration: form.duration ? Number(form.duration) : undefined,
      });
      setCreateOpen(false);
      setForm({ userId: '', type: ModerationCaseType.WARN, reason: '', duration: '' });
      load(page);
    } catch (e: any) {
      setFormErrors({ general: e?.message || 'Erreur lors de la création' });
    } finally {
      setSubmitting(false);
    }
  };

  const quickAction = async (type: ModerationCaseType) => {
    const userId = prompt('ID de l\'utilisateur:');
    if (!userId) return;
    const reason = prompt('Raison:');
    if (!reason) return;
    try {
      await api.post(`/api/guilds/${guildId}/moderation`, { type, userId: userId.trim(), reason: reason.trim() });
      load(page);
    } catch (e: any) {
      alert(e?.message || 'Erreur lors de l\'action rapide');
    }
  };

  const columns: Column<ModCase>[] = [
    { key: 'userId', label: 'Utilisateur', sortable: true, render: (c) => <span className="font-mono text-xs">{c.userId.slice(0, 8)}…</span> },
    { key: 'type', label: 'Type', sortable: true, render: (c) => <Badge variant={caseTypeVariants[c.type] ?? 'warning'}>{caseTypeLabels[c.type] ?? c.type}</Badge> },
    { key: 'moderatorId', label: 'Modérateur', render: (c) => <span className="font-mono text-xs">{c.moderatorId.slice(0, 8)}…</span> },
    { key: 'reason', label: 'Raison', render: (c) => <span className="text-xs truncate max-w-[200px] block">{c.reason}</span> },
    { key: 'createdAt', label: 'Date', sortable: true, render: (c) => <span className="text-xs text-[var(--text-secondary)]">{formatDate(c.createdAt)}</span> },
    { key: 'duration', label: 'Durée', render: (c) => <span className="text-xs">{c.duration ? `${c.duration}m` : '—'}</span> },
    { key: 'actions', label: '', render: (c) => (
      <button onClick={() => setDeleteTarget(c.id)} className="text-[var(--text-secondary)] hover:text-[var(--error)] transition-colors" title="Supprimer">
        <Trash2 size={14} />
      </button>
    )},
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
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Modération</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Gérez les sanctions et les cas de modération.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => quickAction(ModerationCaseType.WARN)}><AlertTriangle size={14} /> Warn</Button>
          <Button variant="ghost" size="sm" onClick={() => quickAction(ModerationCaseType.MUTE)}><MicOff size={14} /> Mute</Button>
          <Button variant="ghost" size="sm" onClick={() => quickAction(ModerationCaseType.KICK)}><UserX size={14} /> Kick</Button>
          <Button variant="ghost" size="sm" onClick={() => quickAction(ModerationCaseType.BAN)}><Ban size={14} /> Ban</Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus size={14} /> Nouveau cas</Button>
        </div>
      </div>

      <div className="mb-4">
        <ModuleToggle guildId={guildId} moduleKey="moderation" label="Modération" />
      </div>

      <Card padding={false}>
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : cases.length === 0 ? (
          <EmptyState title="Aucun cas" description="Aucun cas de modération pour ce serveur." />
        ) : (
          <>
            <Table columns={columns} data={cases} keyExtractor={(c) => c.id} />
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau cas de modération">
        <div className="space-y-4">
          {formErrors.general && (
            <div className="text-sm text-[var(--error)] bg-[var(--error-bg)] p-2 rounded">{formErrors.general}</div>
          )}
          <Input label="ID Utilisateur" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} error={formErrors.userId} placeholder="ID Discord" />
          <Select label="Type" options={Object.entries(caseTypeLabels).map(([v, l]) => ({ value: v, label: l }))} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ModerationCaseType })} />
          <Input label="Raison" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} error={formErrors.reason} placeholder="Motif de la sanction" />
          <Input label="Durée (minutes) — optionnel" type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="Laisser vide si permanent" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button loading={submitting} onClick={handleCreate}>Créer le cas</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirmer la suppression">
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Êtes-vous sûr de vouloir supprimer ce cas de modération ?<br />
          Cette action est réversible (soft-delete).
        </p>
        {deleteError && (
          <div className="text-sm text-[var(--error)] bg-[var(--error-bg)] p-2 rounded mb-4">{deleteError}</div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>Annuler</Button>
          <Button variant="danger" size="sm" loading={deleting} onClick={handleDelete}>Supprimer</Button>
        </div>
      </Modal>
    </motion.div>
  );
}
