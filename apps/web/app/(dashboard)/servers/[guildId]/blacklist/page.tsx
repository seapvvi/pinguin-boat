'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Search, Plus, ChevronLeft, ChevronRight, Trash2
} from 'lucide-react';
import { Table, Input, Button, Modal, Skeleton, EmptyState } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchGuildBlacklist, api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { GuildBlacklistUser } from '@pinguin/shared';
import type { Column } from '@pinguin/ui';
import { ModuleToggle } from '@/components/ModuleToggle';
import { PermissionGate } from '@/components/PermissionGate';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionCard } from '@/components/layout/SectionCard';

export default function BlacklistPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [entries, setEntries] = useState<GuildBlacklistUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ userId: '', reason: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [userCache, setUserCache] = useState<Record<string, { username: string; avatar: string | null }>>({});

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/api/guilds/${guildId}/blacklist/${deleteTarget}`);
      setDeleteTarget(null);
      load(page);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  const load = async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchGuildBlacklist(guildId, { page: String(p), limit: '20', search });
      if (res.success && res.data) {
        setEntries(res.data.entries);
        setTotalPages(res.data.pagination.totalPages);
        // Fetch user info for all entries
        const userIds = res.data.entries.map(e => e.userId);
        const userPromises = userIds.map(uid =>
          api.get<{ data: { id: string; username: string; avatar: string | null } }>(`/api/guilds/${guildId}/resolve-user/${uid}`)
            .catch(() => null)
        );
        const userResults = await Promise.all(userPromises);
        const newCache: Record<string, { username: string; avatar: string | null }> = {};
        userResults.forEach((res, idx) => {
          if (res && (res as { data?: { id: string; username: string; avatar: string | null } })?.data) {
            newCache[userIds[idx]] = (res as { data: { id: string; username: string; avatar: string | null } }).data;
          }
        });
        setUserCache(newCache);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(page); }, [guildId, page]);
  useEffect(() => {
    const timer = setTimeout(() => { if (page === 1) load(1); }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const handleCreate = async () => {
    const errs: Record<string, string> = {};
    if (!form.userId.trim()) errs.userId = 'Requis';
    if (!form.reason.trim()) errs.reason = 'Requis';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    setFormErrors({});
    try {
      await api.post(`/api/guilds/${guildId}/blacklist`, {
        userId: form.userId.trim(),
        reason: form.reason.trim(),
      });
      setCreateOpen(false);
      setForm({ userId: '', reason: '' });
      load(page);
    } catch (e) {
      setFormErrors({ general: e instanceof Error ? e.message : 'Erreur lors de la création' });
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<GuildBlacklistUser>[] = [
    {
      key: 'userId',
      label: 'Utilisateur',
      sortable: true,
      render: (entry) => {
        const userInfo = userCache[entry.userId];
        const username = userInfo?.username || `${entry.userId.slice(0, 8)}…`;
        return username;
      }
    },
    { key: 'reason', label: 'Raison', render: (entry) => entry.reason },
    { key: 'createdAt', label: 'Date ajout', sortable: true, render: (entry) => formatDate(entry.createdAt) },
    { key: 'moderatorId', label: 'Modérateur', render: (entry) => `${entry.moderatorId.slice(0, 8)}…` },
    { key: 'actions', label: '', render: (entry) => (
      <button
        type="button"
        onClick={() => setDeleteTarget(entry.userId)}
        className="text-[var(--text-secondary)] hover:text-[var(--error)]"
        title="Retirer de la blacklist"
      >
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
      <PermissionGate permission="manageMessages">
        <PageLayout
          title="Blacklist"
          description="Gérez les utilisateurs blacklistés de ce serveur."
          actions={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                <Input
                  placeholder="Rechercher par ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button size="sm" onClick={() => setCreateOpen(true)}><Plus size={14} /> Ajouter</Button>
            </div>
          }
        >
          <div className="mb-4">
            <ModuleToggle guildId={guildId} moduleKey="moderation" label="Modération" />
          </div>

          <SectionCard
            title="Liste noire"
            description={`${entries.length} utilisateur${entries.length > 1 ? 's' : ''} blacklisté${entries.length > 1 ? 's' : ''}`}
            headerAction={
              totalPages > 1 ? (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight size={14} />
                  </Button>
                </div>
              ) : undefined
            }
          >
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : entries.length === 0 ? (
              <EmptyState
                title="Aucun utilisateur blacklisté"
                description="Aucun utilisateur n'est blacklisté sur ce serveur."
              />
            ) : (
              <>
                <Table columns={columns} data={entries} keyExtractor={(e) => e.id} />
                <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)] mt-3">
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
          </SectionCard>
        </PageLayout>

        <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Ajouter à la blacklist">
          <div className="space-y-4">
            {formErrors.general && (
              <div className="text-sm text-[var(--error)] bg-[var(--error)]/10 p-2">{formErrors.general}</div>
            )}
            <Input
              label="ID Utilisateur"
              value={form.userId}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
              error={formErrors.userId}
              placeholder="ID Discord"
            />
            <Input
              label="Raison"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              error={formErrors.reason}
              placeholder="Motif du blacklist"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setCreateOpen(false)}>Annuler</Button>
              <Button loading={submitting} onClick={handleCreate}>Ajouter</Button>
            </div>
          </div>
        </Modal>

        <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirmer le retrait">
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Êtes-vous sûr de vouloir retirer cet utilisateur de la blacklist ?
          </p>
          {deleteError && (
            <div className="text-sm text-[var(--error)] bg-[var(--error)]/10 p-2 mb-4">{deleteError}</div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="danger" size="sm" loading={deleting} onClick={handleDelete}>Retirer</Button>
          </div>
        </Modal>
      </PermissionGate>
    </motion.div>
  );
}
