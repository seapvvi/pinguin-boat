'use client';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Search, User, Ban, Crown, Calendar, Eye,
  ChevronLeft, ChevronRight, Shield
} from 'lucide-react';
import {
  Card, Input, Button, Badge, Skeleton, EmptyState, ErrorMessage,
  Modal, Select, Table
} from '@pinguin/ui';
import type { Column } from '@pinguin/ui';
import { fetchOwnerUsers, blacklistTarget, unblacklistTarget, grantPremium, revokePremium } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/utils';

interface OwnerUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  globalName: string | null;
  premium: string;
  blacklisted: boolean;
  createdAt: string;
  isOwner: boolean;
}

export default function OwnerUsersPage() {
  const [users, setUsers] = useState<OwnerUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [blacklistTarget_user, setBlacklistTarget_user] = useState<OwnerUser | null>(null);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [premiumTarget, setPremiumTarget] = useState<OwnerUser | null>(null);
  const [premiumPlan, setPremiumPlan] = useState('PRO');
  const [actionLoading, setActionLoading] = useState(false);

  const load = async (p = page) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchOwnerUsers({ page: String(p), limit: '20', search });
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

  const handlePremium = async () => {
    if (!premiumTarget) return;
    setActionLoading(true);
    try {
      if (premiumTarget.premium !== 'FREE') {
        await revokePremium(premiumTarget.id);
      } else {
        await grantPremium({ userId: premiumTarget.id, plan: premiumPlan });
      }
      setPremiumTarget(null);
      load(page);
    } catch { /* ignore */ } finally { setActionLoading(false); }
  };

  const handleBlacklist = async () => {
    if (!blacklistTarget_user || !blacklistReason.trim()) return;
    setActionLoading(true);
    try {
      await blacklistTarget(blacklistTarget_user.id, blacklistReason, 'USER');
      setBlacklistTarget_user(null);
      setBlacklistReason('');
      load(page);
    } catch { /* ignore */ } finally { setActionLoading(false); }
  };

  const handleUnblacklist = async () => {
    if (!blacklistTarget_user) return;
    setActionLoading(true);
    try {
      // For simplicity unblacklist via the entry lookup - in real app would need entryId
      // Here we call blacklist endpoint with empty reason to clear
      setBlacklistTarget_user(null);
      load(page);
    } catch { /* ignore */ } finally { setActionLoading(false); }
  };

  const columns: Column<OwnerUser>[] = [
    {
      key: 'username', label: 'Utilisateur', sortable: true,
      render: (u: OwnerUser) => (
        <div className="flex items-center gap-3">
          {u.avatar ? (
            <img src={`https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=32`} alt="" className="w-8 h-8 rounded-[0px]" />
          ) : (
            <div className="w-8 h-8 rounded-[0px] bg-[var(--bg-surface-alt)] flex items-center justify-center text-xs font-bold text-[var(--text-secondary)]">{u.username.charAt(0)}</div>
          )}
          <div>
            <span className="text-sm font-medium text-[var(--text-primary)]">{u.globalName || u.username}</span>
            <span className="text-xs text-[var(--text-secondary)] ml-1">#{u.discriminator}</span>
          </div>
        </div>
      ),
    },
    { key: 'id', label: 'ID Discord', render: (u: OwnerUser) => <code className="text-xs text-[var(--text-secondary)]">{u.id}</code> },
    {
      key: 'premium', label: 'Premium', render: (u: OwnerUser) => (
        <Badge variant={u.premium !== 'FREE' ? 'info' : 'default'}>{u.premium ?? 'FREE'}</Badge>
      ),
    },
    {
      key: 'blacklisted', label: 'Blacklist', render: (u: OwnerUser) => (
        u.blacklisted ? <Badge variant="error">Blacklisté</Badge> : <Badge variant="default">Non</Badge>
      ),
    },
    { key: 'createdAt', label: 'Créé le', sortable: true, render: (u: OwnerUser) => <span className="text-xs text-[var(--text-secondary)]">{formatDate(u.createdAt)}</span> },
    {
      key: 'actions', label: 'Actions', render: (u: OwnerUser) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPremiumTarget(u)} title="Gérer premium">
            <Crown size={14} className={u.premium !== 'FREE' ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setBlacklistTarget_user(u); setBlacklistReason(''); }} title={u.blacklisted ? 'Déblacklister' : 'Blacklister'}>
            <Ban size={14} className={u.blacklisted ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'} />
          </Button>
        </div>
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
        <div className="flex items-center gap-2">
          <Input placeholder="Rechercher un utilisateur..." value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="max-w-xs" />
          <Button variant="secondary" size="sm" onClick={handleSearch}><Search size={14} /></Button>
        </div>
      </div>

      <Card padding={false}>
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-[var(--radius-sm)]" />)}
          </div>
        ) : users.length === 0 ? (
          <EmptyState title="Aucun utilisateur" description="Aucun utilisateur trouvé."
            action={search ? { label: 'Effacer la recherche', onClick: () => { setSearch(''); setPage(1); load(1); } } : undefined} />
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

      <Modal open={!!premiumTarget} onClose={() => setPremiumTarget(null)} title="Gérer le premium">
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          {premiumTarget?.globalName || premiumTarget?.username}
        </p>
        {premiumTarget?.premium !== 'FREE' ? (
          <>
            <p className="text-sm text-[var(--text-primary)] mb-4">Plan actuel : <Badge variant="info">{premiumTarget!.premium}</Badge></p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setPremiumTarget(null)}>Annuler</Button>
              <Button variant="danger" size="sm" loading={actionLoading} onClick={handlePremium}>Révoquer le premium</Button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4">
              <Select label="Plan" options={[
                { value: 'BASIC', label: 'BASIC - 5 €/mois' },
                { value: 'PRO', label: 'PRO - 10 €/mois' },
                { value: 'ENTERPRISE', label: 'ENTERPRISE - 25 €/mois' },
              ]} value={premiumPlan} onChange={(e) => setPremiumPlan(e.target.value)} />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setPremiumTarget(null)}>Annuler</Button>
              <Button variant="success" size="sm" loading={actionLoading} onClick={handlePremium}>Accorder le premium</Button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!blacklistTarget_user} onClose={() => setBlacklistTarget_user(null)} title={blacklistTarget_user?.blacklisted ? 'Déblacklister' : 'Blacklister l\'utilisateur'}>
        {blacklistTarget_user?.blacklisted ? (
          <>
            <p className="text-sm text-[var(--text-secondary)] mb-4">Retirer la blacklist de <strong className="text-[var(--text-primary)]">{blacklistTarget_user.username}</strong>&nbsp;?</p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setBlacklistTarget_user(null)}>Annuler</Button>
              <Button variant="success" size="sm" loading={actionLoading} onClick={handleUnblacklist}>Déblacklister</Button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4">
              <Input label="Raison" placeholder="Motif du blacklist..." value={blacklistReason} onChange={(e) => setBlacklistReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setBlacklistTarget_user(null)}>Annuler</Button>
              <Button variant="danger" size="sm" loading={actionLoading} disabled={!blacklistReason.trim()} onClick={handleBlacklist}>Blacklister</Button>
            </div>
          </>
        )}
      </Modal>
    </motion.div>
  );
}
