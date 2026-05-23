'use client';
import { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import {
  RefreshCw, RotateCcw, History, Terminal, CheckCircle,
  XCircle, Clock, Loader, AlertTriangle, ChevronDown
} from 'lucide-react';
import {
  Card, Button, Badge, Skeleton, EmptyState, ErrorMessage, Modal
} from '@pinguin/ui';
import { fetchDeployments, triggerDeploy, triggerRollback } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import DeploymentProgressModal from '@/components/DeploymentProgressModal';

interface Deployment {
  id: string;
  version: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'ROLLED_BACK';
  startedAt: string;
  completedAt: string | null;
  log: string[];
}

const statusVariant: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  PENDING: 'warning',
  RUNNING: 'info',
  SUCCESS: 'success',
  FAILED: 'error',
  ROLLED_BACK: 'default',
};

const statusLabel: Record<string, string> = {
  PENDING: 'En attente',
  RUNNING: 'En cours',
  SUCCESS: 'Réussi',
  FAILED: 'Échoué',
  ROLLED_BACK: 'Annulé',
};

export default function OwnerDeployPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeployConfirm, setShowDeployConfirm] = useState(false);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedDeploy, setSelectedDeploy] = useState<Deployment | null>(null);
  const [deployId, setDeployId] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDeployments({ limit: '50' });
      if (res.success && res.data) setDeployments(res.data.deployments ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [selectedDeploy?.log]);

  const handleDeploy = async () => {
    setActionLoading(true);
    try {
      const res = await triggerDeploy();
      setShowDeployConfirm(false);
      if (res?.data?.id) setDeployId(res.data.id);
      load();
    } catch { /* ignore */ } finally { setActionLoading(false); }
  };

  const handleRollback = async () => {
    setActionLoading(true);
    try {
      await triggerRollback();
      setShowRollbackConfirm(false);
      load();
    } catch { /* ignore */ } finally { setActionLoading(false); }
  };

  const currentDeployment = deployments[0] ?? null;
  const previousDeployment = deployments[1] ?? null;

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
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Déploiement</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Gérez les déploiements et mises à jour.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" disabled={!previousDeployment} onClick={() => setShowRollbackConfirm(true)}>
            <RotateCcw size={14} /> Rollback
          </Button>
          <Button size="sm" onClick={() => setShowDeployConfirm(true)}>
            <RefreshCw size={14} /> Mettre à jour depuis GitHub
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Statut actuel</h2>
        {loading ? (
          <Skeleton className="h-16 w-full rounded-[var(--radius-sm)]" />
        ) : currentDeployment ? (
          <div className="flex items-center justify-between p-4 bg-[var(--bg-surface-alt)] rounded-[var(--radius-sm)]">
            <div className="flex items-center gap-3">
              {currentDeployment.status === 'RUNNING' ? (
                <Loader size={20} className="text-[var(--info)] animate-spin" />
              ) : currentDeployment.status === 'SUCCESS' ? (
                <CheckCircle size={20} className="text-[var(--success)]" />
              ) : currentDeployment.status === 'FAILED' ? (
                <XCircle size={20} className="text-[var(--error)]" />
              ) : (
                <Clock size={20} className="text-[var(--warning)]" />
              )}
              <div>
                <span className="text-sm font-medium text-[var(--text-primary)]">Version {currentDeployment.version}</span>
                <p className="text-xs text-[var(--text-secondary)]">
                  {currentDeployment.status === 'RUNNING' ? 'Déploiement en cours...' : `Démarré le ${formatDate(currentDeployment.startedAt)}`}
                </p>
              </div>
            </div>
            <Badge variant={statusVariant[currentDeployment.status]}>{statusLabel[currentDeployment.status]}</Badge>
          </div>
        ) : (
          <EmptyState title="Aucun déploiement" description="Aucun déploiement trouvé." />
        )}
      </Card>

      {selectedDeploy && (
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Logs - {selectedDeploy.version}</h2>
            <Button variant="ghost" size="sm" onClick={() => setSelectedDeploy(null)}>Fermer</Button>
          </div>
          <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-[var(--radius-sm)] p-4 max-h-80 overflow-y-auto font-mono text-xs space-y-1">
            {selectedDeploy.log?.length > 0 ? selectedDeploy.log.map((line, i) => (
              <div key={i} className={`${line.toLowerCase().includes('error') ? 'text-[var(--error)]' : line.toLowerCase().includes('success') ? 'text-[var(--success)]' : 'text-[var(--text-secondary)]'}`}>
                <span className="text-[var(--text-secondary)] opacity-50 mr-2">[{i + 1}]</span>{line}
              </div>
            )) : <span className="text-[var(--text-secondary)] italic">Aucune entrée de log.</span>}
            <div ref={logEndRef} />
          </div>
        </Card>
      )}

      <Card padding={false}>
        <div className="px-5 py-3 border-b border-[var(--border-color)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Historique des déploiements</h2>
        </div>
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-[var(--radius-sm)]" />)}
          </div>
        ) : deployments.length === 0 ? (
          <EmptyState title="Aucun déploiement" description="L'historique est vide." />
        ) : (
          <div className="divide-y divide-[var(--border-color)]">
            {deployments.map((d, idx) => (
              <div key={d.id} className="flex items-center justify-between px-5 py-3 hover:bg-[var(--bg-surface-alt)]/50 transition-colors cursor-pointer" onClick={() => setSelectedDeploy(d)}>
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    d.status === 'SUCCESS' ? 'bg-[var(--success)]/10 text-[var(--success)]' :
                    d.status === 'FAILED' ? 'bg-[var(--error)]/10 text-[var(--error)]' :
                    d.status === 'RUNNING' ? 'bg-[var(--info)]/10 text-[var(--info)]' :
                    'bg-[var(--bg-surface-alt)] text-[var(--text-secondary)]'
                  }`}>
                    {idx + 1}
                  </span>
                  <div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">v{d.version}</span>
                    <p className="text-xs text-[var(--text-secondary)]">{formatDate(d.startedAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={statusVariant[d.status]}>{statusLabel[d.status]}</Badge>
                  <Terminal size={14} className="text-[var(--text-secondary)]" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={showDeployConfirm} onClose={() => setShowDeployConfirm(false)} title="Confirmer le déploiement">
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Êtes-vous sûr de vouloir lancer un déploiement depuis GitHub&nbsp;?<br />
          Le bot sera momentanément indisponible pendant la mise à jour.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setShowDeployConfirm(false)}>Annuler</Button>
          <Button variant="primary" size="sm" loading={actionLoading} onClick={handleDeploy}>Déployer</Button>
        </div>
      </Modal>

      <Modal open={showRollbackConfirm} onClose={() => setShowRollbackConfirm(false)} title="Confirmer le rollback">
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Revenir à la version précédente <strong className="text-[var(--text-primary)]">{previousDeployment?.version}</strong>&nbsp;?<br />
          Cette action restaurera l'état précédent du bot.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setShowRollbackConfirm(false)}>Annuler</Button>
          <Button variant="danger" size="sm" loading={actionLoading} onClick={handleRollback}>Rollback</Button>
        </div>
      </Modal>

      <DeploymentProgressModal deploymentId={deployId} onClose={() => setDeployId(null)} />
    </motion.div>
  );
}
