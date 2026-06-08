'use client';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Users, Server, Ban, Trash2, Plus, Search, AlertTriangle,
  UserX, Shield as ShieldIcon
} from 'lucide-react';
import {
  Card, Button, Badge, Skeleton, EmptyState, ErrorMessage,
  Modal, Input, Select, Table
} from '@pinguin/ui';
import type { Column } from '@pinguin/ui';
import { fetchBlacklist, blacklistTarget, unblacklistTarget } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { BlacklistEntry } from '@pinguin/shared';

export default function OwnerBlacklistPage() {
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'USER' | 'GUILD'>('USER');
  const [showAdd, setShowAdd] = useState(false);
  const [addTargetId, setAddTargetId] = useState('');
  const [addReason, setAddReason] = useState('');
  const [addType, setAddType] = useState<'USER' | 'GUILD'>('USER');
  const [removeTarget, setRemoveTarget] = useState<BlacklistEntry | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchBlacklist();
      if (res.success && res.data) setEntries(res.data.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = entries.filter((e) => e.targetType === tab);

  const handleAdd = async () => {
    if (!addTargetId.trim() || !addReason.trim()) return;
    setActionLoading(true);
    try {
      await blacklistTarget(addTargetId.trim(), addReason.trim(), addType);
      setShowAdd(false);
      setAddTargetId('');
      setAddReason('');
      load();
    } catch { /* ignore */ } finally { setActionLoading(false); }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setActionLoading(true);
    try {
      await unblacklistTarget(removeTarget.targetId, removeTarget.targetType);
      setRemoveTarget(null);
      load();
    } catch { /* ignore */ } finally { setActionLoading(false); }
  };

  const columns: Column<BlacklistEntry>[] = [
    {
      key: 'targetId', label: 'Cible', render: (e: BlacklistEntry) => (
        <div className="flex items-center gap-2">
          {e.targetType === 'USER' ? <UserX size={14} className="text-[var(--text-secondary)]" /> : <Server size={14} className="text-[var(--text-secondary)]" />}
          <div>
            <span className="text-sm text-[var(--text-primary)]">{e.targetName ?? e.targetId.slice(0, 12) + '...'}</span>
            <code className="text-xs text-[var(--text-secondary)] ml-1">{e.targetId}</code>
          </div>
        </div>
      ),
    },
    { key: 'reason', label: 'Raison', render: (e: BlacklistEntry) => <span className="text-sm text-[var(--text-secondary)]">{e.reason}</span> },
    { key: 'moderatorId', label: 'Modérateur', render: (e: BlacklistEntry) => <span className="text-xs text-[var(--text-secondary)]">{e.moderatorName ?? e.moderatorId.slice(0, 8) + '...'}</span> },
    { key: 'createdAt', label: 'Date', sortable: true, render: (e: BlacklistEntry) => <span className="text-xs text-[var(--text-secondary)]">{formatDate(e.createdAt)}</span> },
    {
      key: 'actions', label: '', render: (e: BlacklistEntry) => (
        <Button variant="ghost" size="sm" onClick={() => setRemoveTarget(e)} title="Retirer">
          <Trash2 size={14} className="text-[var(--error)]" />
        </Button>
      ),
    },
  ];

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Gestion des blacklists</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Gérez les utilisateurs et serveurs blacklistés.</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus size={14} /> Ajouter</Button>
      </div>

      <Card padding={false}>
        <div className="flex border-b border-[var(--border-color)]">
          <button
            onClick={() => setTab('USER')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'USER' ? 'border-[var(--accent)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Users size={14} /> Utilisateurs blacklistés
          </button>
          <button
            onClick={() => setTab('GUILD')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'GUILD' ? 'border-[var(--accent)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Server size={14} /> Serveurs blacklistés
          </button>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-[var(--radius-sm)]" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ShieldIcon size={32} />}
            title="Aucune entrée"
            description={tab === 'USER' ? 'Aucun utilisateur blacklisté.' : 'Aucun serveur blacklisté.'}
          />
        ) : (
          <Table columns={columns} data={filtered} keyExtractor={(e) => e.id} />
        )}
      </Card>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Ajouter à la blacklist">
        <div className="space-y-4">
          <Select label="Type" options={[
            { value: 'USER', label: 'Utilisateur' },
            { value: 'GUILD', label: 'Serveur' },
          ]} value={addType} onChange={(e) => setAddType(e.target.value as 'USER' | 'GUILD')} />
          <Input label="ID de la cible" placeholder="Entrez l'ID Discord..." value={addTargetId} onChange={(e) => setAddTargetId(e.target.value)} />
          <Input label="Raison" placeholder="Motif du blacklist..." value={addReason} onChange={(e) => setAddReason(e.target.value)} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowAdd(false)}>Annuler</Button>
            <Button variant="danger" size="sm" loading={actionLoading} disabled={!addTargetId.trim() || !addReason.trim()} onClick={handleAdd}>Ajouter</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!removeTarget} onClose={() => setRemoveTarget(null)} title="Confirmer le retrait">
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Retirer la blacklist de <strong className="text-[var(--text-primary)]">{removeTarget?.targetName ?? removeTarget?.targetId}</strong>&nbsp;?<br />
          {removeTarget?.reason && <span className="text-xs">Motif : {removeTarget.reason}</span>}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setRemoveTarget(null)}>Annuler</Button>
          <Button variant="success" size="sm" loading={actionLoading} onClick={handleRemove}>Retirer</Button>
        </div>
      </Modal>
    </motion.div>
  );
}
