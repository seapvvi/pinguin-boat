'use client';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Search, Ban, LogOut, ChevronLeft, ChevronRight, Settings, ShieldAlert } from 'lucide-react';
import { Card, Input, Button, Badge, Skeleton, EmptyState, ErrorMessage, Modal, Select, Table } from '@pinguin/ui';
import type { Column } from '@pinguin/ui';
import { fetchOwnerServers, forceLeaveGuild, blacklistTarget, unblacklistTarget, api } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

interface OwnerServer {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
  ownerId: string;
  ownerName: string;
  botStatus: 'ONLINE' | 'OFFLINE' | 'IDLE';
  blacklisted: boolean;
}

export default function OwnerServersPage() {
  const [servers, setServers] = useState<OwnerServer[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'memberCount' | 'createdAt' | 'name'>('memberCount');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [manageTarget, setManageTarget] = useState<OwnerServer | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<OwnerServer | null>(null);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = async (p = page, nextSortBy = sortBy, nextSortOrder = sortOrder) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchOwnerServers({
        page: String(p),
        limit: '20',
        search,
        sortBy: nextSortBy,
        sortOrder: nextSortOrder,
      });
      if (res.success && res.data) {
        setServers(res.data.servers ?? []);
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

  const handleSort = async (nextSortBy: 'memberCount' | 'createdAt' | 'name', nextSortOrder: 'asc' | 'desc') => {
    setSortBy(nextSortBy);
    setSortOrder(nextSortOrder);
    setPage(1);
    await load(1, nextSortBy, nextSortOrder);
  };

  const openManage = async (server: OwnerServer) => {
    setManageTarget(server);
    setDetail(null);
    setBlacklistReason('');
    try {
      const res = await api.get<any>(`/api/owner/servers/${server.id}`);
      setDetail((res as any)?.data ?? null);
    } catch {
      setDetail(null);
    }
  };

  const handleForceLeave = async () => {
    if (!leaveTarget) return;
    setActionLoading(true);
    try {
      await forceLeaveGuild(leaveTarget.id);
      setLeaveTarget(null);
      load(page);
    } finally { setActionLoading(false); }
  };

  const handleBlacklistToggle = async () => {
    if (!manageTarget) return;
    if (!manageTarget.blacklisted && !blacklistReason.trim()) return;
    setActionLoading(true);
    try {
      if (manageTarget.blacklisted) {
        await unblacklistTarget(manageTarget.id, 'GUILD');
      } else {
        await blacklistTarget(manageTarget.id, blacklistReason.trim(), 'GUILD');
      }
      setManageTarget(null);
      setBlacklistReason('');
      load(page);
    } finally { setActionLoading(false); }
  };

  const columns: Column<OwnerServer>[] = [
    {
      key: 'name', label: 'Nom', sortable: true,
      render: (s: OwnerServer) => (
        <div className="flex items-center gap-3">
          {s.icon ? (
            <img 
              src={`https://cdn.discordapp.com/icons/${s.id}/${s.icon}.${s.icon.startsWith('a_') ? 'gif' : 'png'}?size=32`} 
              alt="" 
              className="w-8 h-8 rounded-[0px]"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div className={`w-8 h-8 rounded-[0px] bg-[var(--bg-surface-alt)] flex items-center justify-center text-xs font-bold text-[var(--text-secondary)] ${s.icon ? 'hidden' : ''}`}>
            {s.name.charAt(0)}
          </div>
          <span className="text-sm font-medium text-[var(--text-primary)]">{s.name}</span>
        </div>
      ),
    },
    { key: 'id', label: 'ID', render: (s: OwnerServer) => <code className="text-xs text-[var(--text-secondary)]">{s.id}</code> },
    { key: 'memberCount', label: 'Membres', sortable: true, render: (s: OwnerServer) => <span className="text-sm">{formatNumber(s.memberCount)}</span> },
    { key: 'ownerName', label: 'Propriétaire', render: (s: OwnerServer) => <span className="text-sm text-[var(--text-secondary)]">{s.ownerName ?? s.ownerId.slice(0, 8)}...</span> },
    {
      key: 'botStatus', label: 'Bot', render: (s: OwnerServer) => (
        <Badge variant={s.botStatus === 'ONLINE' ? 'success' : s.botStatus === 'IDLE' ? 'warning' : 'error'}>
          {s.botStatus === 'ONLINE' ? 'En ligne' : s.botStatus === 'IDLE' ? 'Inactif' : 'Hors ligne'}
        </Badge>
      ),
    },
    {
      key: 'blacklisted', label: 'Blacklist', render: (s: OwnerServer) => (
        s.blacklisted ? <Badge variant="error">Blacklisté</Badge> : <Badge variant="default">Non</Badge>
      ),
    },
    {
      key: 'actions', label: 'Actions', render: (s: OwnerServer) => (
        <Button variant="secondary" size="sm" onClick={() => openManage(s)} title="Gérer ce serveur">
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
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Gestion des serveurs</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Tous les serveurs où le bot est présent.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Rechercher un serveur..." value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="max-w-xs" />
          <Select
            value={sortBy}
            onChange={(e) => handleSort(e.target.value as 'memberCount' | 'createdAt' | 'name', sortOrder)}
            options={[
              { value: 'memberCount', label: 'Tri: membres' },
              { value: 'createdAt', label: 'Tri: récent/ancien' },
              { value: 'name', label: 'Tri: nom' },
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
        ) : servers.length === 0 ? (
          <EmptyState title="Aucun serveur" description="Aucun serveur trouvé." action={search ? { label: 'Effacer la recherche', onClick: () => { setSearch(''); setPage(1); load(1); } } : undefined} />
        ) : (
          <>
            <Table columns={columns} data={servers} keyExtractor={(s) => s.id} />
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

      <Modal open={!!manageTarget} onClose={() => setManageTarget(null)} title={`Gérer: ${manageTarget?.name ?? ''}`}>
        {manageTarget && (
          <div className="space-y-4">
            <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)] border border-[var(--border-color)] space-y-1">
              <p className="text-sm text-[var(--text-primary)] font-medium">{manageTarget.name}</p>
              <p className="text-xs text-[var(--text-secondary)]">ID serveur: <span className="font-mono">{manageTarget.id}</span></p>
              <p className="text-xs text-[var(--text-secondary)]">ID owner: <span className="font-mono">{detail?.ownerId ?? manageTarget.ownerId}</span></p>
              <p className="text-xs text-[var(--text-secondary)]">Membres: {formatNumber(manageTarget.memberCount)}</p>
              <div className="pt-1">
                {manageTarget.blacklisted ? <Badge variant="error">Blacklisté</Badge> : <Badge variant="success">Autorisé</Badge>}
              </div>
            </div>
            {!manageTarget.blacklisted && (
              <Input
                label="Raison de blacklist"
                placeholder="Infraction, abus, etc."
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
              <Button variant="danger" size="sm" onClick={() => { setLeaveTarget(manageTarget); setManageTarget(null); }}>
                <LogOut size={14} /> Expulser le bot
              </Button>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1">
              <ShieldAlert size={12} /> Le blacklistage bloque l’accès dashboard et l’utilisation du bot.
            </p>
          </div>
        )}
      </Modal>

      <Modal open={!!leaveTarget} onClose={() => setLeaveTarget(null)} title="Confirmer le départ forcé">
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Êtes-vous sûr de vouloir forcer le départ du serveur <strong className="text-[var(--text-primary)]">{leaveTarget?.name}</strong>&nbsp;?<br />
          Cette action est définitive et le bot devra être réinvité manuellement.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setLeaveTarget(null)}>Annuler</Button>
          <Button variant="danger" size="sm" loading={actionLoading} onClick={handleForceLeave}>Confirmer le départ</Button>
        </div>
      </Modal>
    </motion.div>
  );
}
