'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  AlertTriangle, Ban, MicOff, UserX,
  Plus, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Card, Table, Input, Button, Select, Badge, Modal, Skeleton, EmptyState, Avatar } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchModCases, api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { ModCase } from '@pinguin/shared';
import type { Column } from '@pinguin/ui';
import { ModerationCaseType } from '@pinguin/shared';
import { Trash2, Info, RotateCcw } from 'lucide-react';
import { ModuleToggle } from '@/components/ModuleToggle';
import { PermissionGate } from '@/components/PermissionGate';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionCard } from '@/components/layout/SectionCard';
import { ModuleGrid } from '@/components/layout/ModuleGrid';

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
  const [filterType, setFilterType] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ userId: '', type: ModerationCaseType.WARN, reason: '', duration: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [detailCase, setDetailCase] = useState<ModCase | null>(null);
  const [detailUsers, setDetailUsers] = useState<{ user?: { id: string; username: string; avatar?: string | null }; moderator?: { id: string; username: string; avatar?: string | null } }>({});
  const [userCache, setUserCache] = useState<Map<string, { username: string; avatar?: string | null }>>(new Map());
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/api/guilds/${guildId}/moderation/${deleteTarget}`);
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
      const params: Record<string, string> = { page: String(p), limit: '15' };
      if (search) params.search = search;
      if (filterType) params.type = filterType;
      const res = await fetchModCases(guildId, params);
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

  useEffect(() => { load(page); }, [guildId, page, search, filterType]);

  const handleCreate = async () => {
    const errs: Record<string, string> = {};
    if (!form.userId.trim()) errs.userId = 'Requis';
    if (!form.reason.trim()) errs.reason = 'Requis';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    setFormErrors({});
    try {
      await api.post(`/api/guilds/${guildId}/moderation`, {
        type: form.type,
        userId: form.userId.trim(),
        reason: form.reason.trim(),
        duration: form.duration ? Number(form.duration) : undefined,
      });
      setCreateOpen(false);
      setForm({ userId: '', type: ModerationCaseType.WARN, reason: '', duration: '' });
      load(page);
    } catch (e) {
      setFormErrors({ general: e instanceof Error ? e.message : 'Erreur lors de la création' });
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
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur lors de l\'action rapide');
    }
  };

  const fetchUser = async (userId: string): Promise<{ username: string; avatar?: string | null } | undefined> => {
    if (userCache.has(userId)) {
      return userCache.get(userId);
    }
    try {
      const res = await api.get<{ data: { id: string; username: string; avatar?: string | null } }>(`/api/guilds/${guildId}/resolve-user/${userId}`);
      const userData = (res as { data?: { id: string; username: string; avatar?: string | null } })?.data;
      if (userData) {
        setUserCache(prev => new Map(prev).set(userId, userData));
        return userData;
      }
    } catch {
      // Ignore errors, return undefined
    }
    return undefined;
  };

  const handleRevoke = async (caseId: string) => {
    setRevoking(caseId);
    setRevokeError(null);
    try {
      await api.post(`/api/guilds/${guildId}/moderation/${caseId}/revoke`);
      load(page);
    } catch (e) {
      setRevokeError(e instanceof Error ? e.message : 'Erreur lors de la révocation');
    } finally {
      setRevoking(null);
    }
  };

  const UserAvatar = ({ userId }: { userId: string }) => {
    const [user, setUser] = useState<{ username: string; avatar?: string | null } | undefined>(userCache.get(userId));

    useEffect(() => {
      if (!user) {
        fetchUser(userId).then(setUser);
      }
    }, [userId, user]);

    const avatarUrl = user?.avatar ? `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png` : undefined;

    return (
      <div className="flex items-center gap-2" title={user?.username || userId}>
        <Avatar src={avatarUrl} name={user?.username || userId} size={24} />
        <span className="text-xs font-medium text-[var(--text-primary)]">{user?.username || userId.slice(0, 8)}…</span>
      </div>
    );
  };

  const columns: Column<ModCase>[] = [
    { key: 'userId', label: 'Utilisateur', sortable: true, render: (c) => <UserAvatar userId={c.userId} /> },
    { key: 'type', label: 'Type', sortable: true, render: (c) => <Badge variant={caseTypeVariants[c.type] ?? 'warning'}>{caseTypeLabels[c.type] ?? c.type}</Badge> },
    { key: 'moderatorId', label: 'Modérateur', render: (c) => <UserAvatar userId={c.moderatorId} /> },
    { key: 'reason', label: 'Raison', render: (c) => <span className="text-xs truncate max-w-[200px] block">{c.reason}</span> },
    { key: 'createdAt', label: 'Date', sortable: true, render: (c) => <span className="text-xs text-[var(--text-secondary)]">{formatDate(c.createdAt)}</span> },
    { key: 'duration', label: 'Durée', render: (c) => <span className="text-xs">{c.duration ? `${c.duration}m` : '—'}</span> },
    { key: 'actions', label: '', render: (c) => (
      <div className="flex gap-1">
        {(c.type === 'BAN' || c.type === 'TEMPBAN' || c.type === 'TIMEOUT') && (
          <button
            type="button"
            onClick={() => handleRevoke(c.id)}
            disabled={revoking === c.id}
            className="text-[var(--text-secondary)] hover:text-[var(--accent)] disabled:opacity-50"
            title={c.type === 'BAN' || c.type === 'TEMPBAN' ? 'Unban' : 'Untimeout'}
          >
            <RotateCcw size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={async () => {
            setDetailCase(c);
            const [userRes, modRes] = await Promise.all([
              api.get<{ data: { id: string; username: string; avatar?: string | null } }>(`/api/guilds/${guildId}/resolve-user/${c.userId}`),
              api.get<{ data: { id: string; username: string; avatar?: string | null } }>(`/api/guilds/${guildId}/resolve-user/${c.moderatorId}`),
            ]);
            setDetailUsers({
              user: (userRes as any)?.data as { id: string; username: string; avatar?: string | null } | undefined,
              moderator: (modRes as any)?.data as { id: string; username: string; avatar?: string | null } | undefined,
            });
          }}
          className="text-[var(--text-secondary)] hover:text-[var(--accent)]"
          title="Détails"
        >
          <Info size={14} />
        </button>
        <button type="button" onClick={() => setDeleteTarget(c.id)} className="text-[var(--text-secondary)] hover:text-[var(--error)]" title="Supprimer">
          <Trash2 size={14} />
        </button>
      </div>
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
          title="Modération"
          description="Gérez les sanctions et les cas de modération."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => quickAction(ModerationCaseType.WARN)}><AlertTriangle size={14} /> Warn</Button>
              <Button variant="ghost" size="sm" onClick={() => quickAction(ModerationCaseType.MUTE)}><MicOff size={14} /> Mute</Button>
              <Button variant="ghost" size="sm" onClick={() => quickAction(ModerationCaseType.KICK)}><UserX size={14} /> Kick</Button>
              <Button variant="ghost" size="sm" onClick={() => quickAction(ModerationCaseType.BAN)}><Ban size={14} /> Ban</Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}><Plus size={14} /> Nouveau cas</Button>
            </div>
          }
        >
          <div className="mb-4">
            <ModuleToggle guildId={guildId} moduleKey="moderation" label="Modération" />
          </div>

          <ModuleGrid>
            <SectionCard title="Recherche & filtres">
              <div className="flex flex-col gap-3">
                <Input
                  placeholder="Rechercher par ID ou raison..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <Select
                  placeholder="Filtrer par type"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  options={[
                    { value: '', label: 'Tous' },
                    ...Object.entries(caseTypeLabels).map(([v, l]) => ({ value: v, label: l }))
                  ]}
                />
              </div>
            </SectionCard>

            <SectionCard title="Actions rapides" description="Sanctions expresses depuis l'ID utilisateur">
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" onClick={() => quickAction(ModerationCaseType.WARN)}><AlertTriangle size={14} /> Warn</Button>
                <Button variant="ghost" size="sm" onClick={() => quickAction(ModerationCaseType.MUTE)}><MicOff size={14} /> Mute</Button>
                <Button variant="ghost" size="sm" onClick={() => quickAction(ModerationCaseType.KICK)}><UserX size={14} /> Kick</Button>
                <Button variant="ghost" size="sm" onClick={() => quickAction(ModerationCaseType.BAN)}><Ban size={14} /> Ban</Button>
              </div>
            </SectionCard>
          </ModuleGrid>

          <div className="mt-6">
            <SectionCard
              title="Historique des sanctions"
              description={`Page ${page} / ${totalPages}`}
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
              ) : cases.length === 0 ? (
                <EmptyState title="Aucun cas" description="Aucun cas de modération pour ce serveur." />
              ) : (
                <>
                  <Table columns={columns} data={cases} keyExtractor={(c) => c.id} />
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
          </div>
        </PageLayout>

        <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau cas de modération">
          <div className="space-y-4">
            {formErrors.general && (
              <div className="text-sm text-[var(--error)] bg-[var(--error)]/10 p-2">{formErrors.general}</div>
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

        <Modal open={!!detailCase} onClose={() => { setDetailCase(null); setDetailUsers({}); }} title="Détails du cas">
          {detailCase && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-[var(--text-secondary)] text-xs uppercase mb-1">Utilisateur sanctionné</p>
                <div className="flex items-center gap-2">
                  {detailUsers.user?.avatar && (
                    <Avatar
                      src={`https://cdn.discordapp.com/avatars/${detailCase.userId}/${detailUsers.user.avatar}.png`}
                      name={detailUsers.user.username}
                      size={32}
                    />
                  )}
                  <p className="font-medium text-[var(--text-primary)]">{detailUsers.user?.username ?? '—'}</p>
                </div>
                <code className="text-xs block mt-1 p-2 bg-[var(--bg-surface-alt)] select-all">{detailCase.userId}</code>
              </div>
              <div>
                <p className="text-[var(--text-secondary)] text-xs uppercase mb-1">Modérateur</p>
                <div className="flex items-center gap-2">
                  {detailUsers.moderator?.avatar && (
                    <Avatar
                      src={`https://cdn.discordapp.com/avatars/${detailCase.moderatorId}/${detailUsers.moderator.avatar}.png`}
                      name={detailUsers.moderator.username}
                      size={32}
                    />
                  )}
                  <p className="font-medium text-[var(--text-primary)]">{detailUsers.moderator?.username ?? '—'}</p>
                </div>
                <code className="text-xs block mt-1 p-2 bg-[var(--bg-surface-alt)] select-all">{detailCase.moderatorId}</code>
              </div>
              <div>
                <p className="text-[var(--text-secondary)] text-xs uppercase mb-1">Type / Raison</p>
                <p>{caseTypeLabels[detailCase.type]} — {detailCase.reason}</p>
              </div>
              {detailCase.type === 'TIMEOUT' && detailCase.duration && (
                <div>
                  <p className="text-[var(--text-secondary)] text-xs uppercase mb-1">Expiration</p>
                  <p className="text-[var(--text-primary)]">Expire le {formatDate(new Date(new Date(detailCase.createdAt).getTime() + detailCase.duration * 60000))}</p>
                </div>
              )}
            </div>
          )}
        </Modal>

        <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirmer la suppression">
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Êtes-vous sûr de vouloir supprimer ce cas de modération ?<br />
            Cette action est réversible (soft-delete).
          </p>
          {deleteError && (
            <div className="text-sm text-[var(--error)] bg-[var(--error)]/10 p-2 mb-4">{deleteError}</div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="danger" size="sm" loading={deleting} onClick={handleDelete}>Supprimer</Button>
          </div>
        </Modal>
        {revokeError && (
          <div className="fixed bottom-4 right-4 p-3 bg-[var(--error)]/10 text-[var(--error)] text-sm z-50">
            {revokeError}
            <button onClick={() => setRevokeError(null)} className="ml-2 hover:underline">Fermer</button>
          </div>
        )}
      </PermissionGate>
    </motion.div>
  );
}
