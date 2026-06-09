'use client';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ScrollText, Search, Download, Filter, CheckCircle,
  XCircle, ChevronLeft, ChevronRight, Clock, Activity
} from 'lucide-react';
import {
  Card, Input, Button, Badge, Skeleton, EmptyState, ErrorMessage,
  Select, Table
} from '@pinguin/ui';
import type { Column } from '@pinguin/ui';
import { fetchOwnerLogs, type OwnerLog } from '@/lib/api';
import { formatDate } from '@/lib/utils';

const actionTypes = [
  { value: '', label: 'Toutes les actions' },
  { value: 'FORCE_LEAVE', label: 'Départ forcé' },
  { value: 'SERVICE_RESTART', label: 'Redémarrage service' },
  { value: 'BACKUP_CREATE', label: 'Création backup' },
  { value: 'BACKUP_RESTORE', label: 'Restauration backup' },
  { value: 'GLOBAL_ANNOUNCEMENT', label: 'Annonce globale' },
  { value: 'ALPHA_TOGGLE', label: 'Mode alpha' },
  { value: 'BLACKLIST_USER', label: 'Blacklist utilisateur' },
  { value: 'UNBLACKLIST_USER', label: 'Déblacklist utilisateur' },
  { value: 'BLACKLIST_GUILD', label: 'Blacklist serveur' },
  { value: 'UNBLACKLIST_GUILD', label: 'Déblacklist serveur' },
  { value: 'PREMIUM_GRANT', label: 'Attribution premium' },
  { value: 'PREMIUM_REVOKE', label: 'Révocation premium' },
  { value: 'DEPLOYMENT_START', label: 'Déploiement' },
  { value: 'CHANGELOG_PUBLISH', label: 'Publication changelog' },
  { value: 'OWNER_LOGIN', label: 'Connexion owner' },
  { value: 'OWNER_LOGOUT', label: 'Déconnexion owner' },
];

export default function OwnerLogsPage() {
  const [logs, setLogs] = useState<OwnerLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = async (p = page) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { page: String(p), limit: '25' };
      if (search) params.search = search;
      if (actionFilter) params.action = actionFilter;
      const res = await fetchOwnerLogs(params);
      if (res.success && res.data) {
        const entries = (res.data.entries ?? []).filter((l) => {
          if (l.action === 'GET_OWNER_LOGS') return false;
          if (!l.details) return true;
          if (l.details.includes('/owner/logs') || l.details.includes('/api/owner/logs')) return false;
          try {
            const p = JSON.parse(l.details);
            if (p?.path?.includes('/owner/logs')) return false;
          } catch { /* texte brut */ }
          return true;
        });
        setLogs(entries);
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

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `owner-logs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: Column<OwnerLog>[] = [
    { key: 'createdAt', label: 'Date', sortable: true, render: (l: OwnerLog) => (
      <div className="flex items-center gap-2">
        <Clock size={12} className="text-[var(--text-secondary)]" />
        <span className="text-xs text-[var(--text-secondary)]">{formatDate(l.createdAt)}</span>
      </div>
    )},
    {
      key: 'action', label: 'Action', render: (l: OwnerLog) => (
        <Badge variant="info">{l.action}</Badge>
      ),
    },
    { key: 'username', label: 'Utilisateur', render: (l: OwnerLog) => (
      <span className="text-sm text-[var(--text-primary)]">{l.username ?? l.userId.slice(0, 8) + '...'}</span>
    )},
    { key: 'ip', label: 'IP', render: (l: OwnerLog) => (
      <code className="text-xs text-[var(--text-secondary)]">{l.ip ?? 'N/A'}</code>
    )},
    { key: 'details', label: 'Détails', render: (l: OwnerLog) => (
      <span className="text-sm text-[var(--text-secondary)] truncate max-w-[200px] block">{l.details ?? '—'}</span>
    )},
    {
      key: 'success', label: 'Statut', render: (l: OwnerLog) => (
        l.success ? (
          <span className="flex items-center gap-1 text-xs text-[var(--success)]"><CheckCircle size={12} /> Succès</span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-[var(--error)]"><XCircle size={12} /> Échec</span>
        )
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
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Journal d'activité</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Toutes les actions des owners.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleExport}>
          <Download size={14} /> Exporter (JSON)
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="max-w-xs" />
        <Select options={actionTypes} value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} className="max-w-xs" />
        <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setActionFilter(''); setPage(1); load(1); }}>
          <Filter size={14} /> Réinitialiser
        </Button>
      </div>

      <Card padding={false}>
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-[var(--radius-sm)]" />)}
          </div>
        ) : logs.length === 0 ? (
          <EmptyState icon={<ScrollText size={24} />} title="Aucun log" description="Aucune action owner trouvée." />
        ) : (
          <>
            <Table columns={columns} data={logs} keyExtractor={(l) => l.id} />
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
    </motion.div>
  );
}
