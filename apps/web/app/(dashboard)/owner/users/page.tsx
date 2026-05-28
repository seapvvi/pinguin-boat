'use client';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Search, Ban, Crown, ChevronLeft, ChevronRight, Settings, ShieldAlert } from 'lucide-react';
import { Card, Input, Button, Badge, Skeleton, EmptyState, ErrorMessage, Modal, Select, Table } from '@pinguin/ui';
import type { Column } from '@pinguin/ui';
import { fetchOwnerUsers, blacklistTarget, unblacklistTarget, api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface OwnerUser {
  id: string;
  discordId: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  globalName: string | null;
  blacklisted: boolean;
  createdAt: string;
}

export default function OwnerUsersPage() {
  const [users, setUsers] = useState<OwnerUser[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'username'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [manageTarget, setManageTarget] = useState<OwnerUser | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = async (p = page, nextSortBy = sortBy, nextSortOrder = sortOrder) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchOwnerUsers({
        page: String(p),
        limit: '20',
        search,
        sortBy: nextSortBy,
        sortOrder: nextSortOrder,
      });
      if (res.success && res.data) {
        setUsers(res.data.users ?? []);
        setTotalPages(res.data.pagination?.totalPages ?? 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]);

  const handleSearch = () => { setPage(1); load(1); };

  const handleSort = async (nextSortBy: 'createdAt' | 'username', nextSortOrder: 'asc' | 'desc') => {
    setSortBy(nextSortBy);
    setSortOrder(nextSortOrder);
    setPage(1);
    await load(1, nextSortBy, nextSortOrder);
  };

  const openManage = async (u: OwnerUser) => {
    setManageTarget(u);
    setDetail(null);
    setBlacklistReason('');
    try {
      const res = await api.get<any>(`/api/owner/users/${u.discordId}`);
      setDetail((res as any)?.data ?? null);
    } catch {
      setDetail(null);
    }
  };

  const handleBlacklistToggle = async () => {
    if (!manageTarget) return;
    if (!manageTarget.blacklisted && !blacklistReason.trim()) return;
    setActionLoading(true);
    try {
      if (manageTarget.blacklisted) {
        await unblacklistTarget(manageTarget.discordId, 'USER');
      } else {
        await blacklistTarget(manageTarget.discordId, blacklistReason.trim(), 'USER');
      }
      setManageTarget(null);
      setBlacklistReason('');
      load(page);
    } finally { setActionLoading(false); }
  };

  const columns: Column<OwnerUser>[] = [
    {
      key: 'username', label: 'Utilisateur', sortable: true,
      render: (u: OwnerUser) => (
        <div className="flex items-center gap-3">
          {u.avatar ? (
            <img 
              src={`https://cdn.discordapp.com/avatars/${u.discordId}/${u.avatar}.${u.avatar.startsWith('a_') ? 'gif' : 'png'}?size=32`} 
              alt="" 
              className="w-8 h-8 rounded-[0px]"
              onError={(e) => {
                const idx = u.discriminator && u.discriminator !== '0'
                  ? parseInt(u.discriminator) % 5
                  : (Number(BigInt(String(u.discordId).replace(/\D/g, '')) >> 22n) % 6);
                e.currentTarget.src = `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
              }}
            />
          ) : (
            <img 
              src={`https://cdn.discordapp.com/embed/avatars/${u.discriminator && u.discriminator !== '0' ? parseInt(u.discriminator) % 5 : (Number(BigInt(String(u.discordId).replace(/\D/g, '')) >> 22n) % 6)}.png`}
              alt="" 
              className="w-8 h-8 rounded-[0px]"
            />
          )}
          <div>
            <span className="text-sm font-medium text-[var(--text-primary)]">{u.globalName || u.username}</span>
            <span className="text-xs text-[var(--text-secondary)] ml-1">#{u.discriminator}</span>
          </div>
        </div>
      ),
    },
    { key: 'id', label: 'ID Discord', render: (u: OwnerUser) => <code className="text-xs text-[var(--text-secondary)]">{u.discordId}</code> },
    { key: 'blacklisted', label: 'Blacklist', render: (u: OwnerUser) => (u.blacklisted ? <Badge variant="error">Blacklisté</Badge> : <Badge variant="default">Non</Badge>) },
    { key: 'createdAt', label: 'Créé le', sortable: true, render: (u: OwnerUser) => <span className="text-xs text-[var(--text-secondary)]">{formatDate(u.createdAt)}</span> },
    {
      key: 'actions', label: 'Actions', render: (u: OwnerUser) => (
        <Button variant="secondary" size="sm" onClick={() => openManage(u)} title="Gérer cet utilisateur">
          <Settings size={14} /> Gérer
        </Button>
      ),
    },
  ];

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
        <ErrorMessage title="Erreur" message={error} onRetry={() => load(page)} />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Gestion des utilisateurs</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Tous les utilisateurs enregistrés.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Rechercher un utilisateur..." value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="max-w-xs" />
          <Select
            value={sortBy}
            onChange={(e) => handleSort(e.target.value as 'createdAt' | 'username', sortOrder)}
            options={[
              { value: 'createdAt', label: 'Tri: récent/ancien' },
              { value: 'username', label: 'Tri: pseudo' },
            ]}
          />
          <Select
            value={sortOrder}
            onChange={(e) => handleSort(sortBy, e.target.value as 'asc' | 'desc')}
            options={[
              { value: 'desc', label: 'Ordre: décroissant' },
              { value: 'asc', label: 'Ordre: croissant' },
            ]}
          />
          <Button variant="secondary" size="sm" onClick={handleSearch}><Search size={14} /></Button>
        </div>
      </div>

      <Card padding={false}>
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-[var(--radius-sm)]" />)}
          </div>
        ) : users.length === 0 ? (
          <EmptyState title="Aucun utilisateur" description="Aucun utilisateur trouvé." action={search ? { label: 'Effacer la recherche', onClick: () => { setSearch(''); setPage(1); load(1); } } : undefined} />
        ) : (
          <>
            <Table columns={columns} data={users} keyExtractor={(u) => u.id} />
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-color)]">
                <span className="text-xs text-[var(--text-secondary)]">Page {page} sur {totalPages}</span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft size={14} /> Précédent</Button>
                  <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Suivant <ChevronRight size={14} /></Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <Modal open={!!manageTarget} onClose={() => setManageTarget(null)} title={`Gérer: ${manageTarget?.username ?? ''}`}>
        {manageTarget && (
          <div className="space-y-4">
            <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)] border border-[var(--border-color)] space-y-1">
              <p className="text-sm text-[var(--text-primary)] font-medium">{manageTarget.globalName || manageTarget.username}</p>
              <p className="text-xs text-[var(--text-secondary)]">ID utilisateur: <span className="font-mono">{manageTarget.discordId}</span></p>
              <div className="pt-1">
                {manageTarget.blacklisted ? <Badge variant="error">Blacklisté</Badge> : <Badge variant="success">Autorisé</Badge>}
              </div>
            </div>

            {!manageTarget.blacklisted && (
              <Input
                label="Raison d’infraction"
                placeholder="Ex: abus, spam, fraude..."
                value={blacklistReason}
                onChange={(e) => setBlacklistReason(e.target.value)}
              />
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setManageTarget(null)}>Fermer</Button>
              <Button
                variant={manageTarget.blacklisted ? 'success' : 'danger'}
                size="sm"
                loading={actionLoading}
                disabled={!manageTarget.blacklisted && !blacklistReason.trim()}
                onClick={handleBlacklistToggle}
              >
                <Ban size={14} /> {manageTarget.blacklisted ? 'Déblacklister' : 'Blacklister'}
              </Button>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1">
              <ShieldAlert size={12} /> En cas de blacklist, l’utilisateur voit la raison et peut contester via ticket Discord.
            </p>
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
