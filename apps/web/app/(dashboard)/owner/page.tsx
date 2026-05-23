'use client';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Server, Users, Terminal, Clock, Cpu, HardDrive,
  RefreshCw, RotateCcw, Save, Power, Activity, Shield,
  CheckCircle, XCircle, AlertTriangle, ChevronRight
} from 'lucide-react';
import {
  Card, Button, Badge, Skeleton, KPICard, EmptyState, ErrorMessage
} from '@pinguin/ui';
import { fetchBotStats, fetchOwnerLogs, triggerBackup, triggerRestart, triggerDeploy, triggerRollback } from '@/lib/api';
import { formatNumber, formatDuration, formatDate } from '@/lib/utils';
import DeploymentProgressModal from '@/components/DeploymentProgressModal';

interface SystemService {
  name: string;
  status: 'OPERATIONAL' | 'DEGRADED' | 'MAINTENANCE' | 'CRITICAL';
}

interface OwnerAction {
  id: string;
  action: string;
  details: string;
  createdAt: string;
  user: { username: string };
  success: boolean;
}

const serviceLabels: Record<string, string> = {
  Bot: 'Bot Discord',
  API: 'API REST',
  Web: 'Interface Web',
  Database: 'Base de données',
  Cache: 'Cache Redis',
};

const statusVariant: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
  OPERATIONAL: 'success',
  DEGRADED: 'warning',
  MAINTENANCE: 'info',
  CRITICAL: 'error',
};

export default function OwnerDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deployId, setDeployId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, logsRes] = await Promise.all([
        fetchBotStats(),
        fetchOwnerLogs({ limit: '10' }),
      ]);
      if (statsRes.success && statsRes.data) setStats(statsRes.data);
      if (logsRes.success && logsRes.data) {
        setLogs(Array.isArray(logsRes.data) ? logsRes.data : (logsRes.data as any).entries ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAction = async (action: string, fn: () => Promise<any>) => {
    setActionLoading(action);
    setActionError(null);
    try {
      const res = await fn();
      if (action === 'deploy' && res?.data?.id) {
        setDeployId(res.data.id);
      }
      if (!res?.success) {
        throw new Error(res?.message || 'Action échouée');
      }
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erreur lors de l’action');
    } finally {
      setActionLoading(null);
    }
  };

  const quickActions = [
    { key: 'deploy', icon: <RefreshCw size={16} />, label: 'Mettre à jour', desc: 'Déploiement depuis GitHub', variant: 'primary' as const, fn: () => triggerDeploy() },
    { key: 'rollback', icon: <RotateCcw size={16} />, label: 'Rollback', desc: 'Revenir à la version précédente', variant: 'secondary' as const, fn: () => triggerRollback() },
    { key: 'backup', icon: <Save size={16} />, label: 'Backup', desc: 'Sauvegarder les données', variant: 'secondary' as const, fn: () => triggerBackup() },
    { key: 'restart', icon: <Power size={16} />, label: 'Redémarrer', desc: 'Redémarrer tous les services', variant: 'danger' as const, fn: () => triggerRestart() },
  ];

  const systems: SystemService[] = [
    { name: 'Bot', status: stats?.systemStatus ?? 'OPERATIONAL' },
    { name: 'API', status: 'OPERATIONAL' },
    { name: 'Web', status: 'OPERATIONAL' },
    { name: 'Database', status: 'OPERATIONAL' },
    { name: 'Cache', status: 'OPERATIONAL' },
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
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Panel Owner</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Administration et gestion avancée de Pinguin BOAT.
        </p>
        {actionError && (
          <div className="mt-4 rounded-[var(--radius-sm)] border border-[var(--error)] bg-[var(--error)]/10 p-3 text-sm text-[var(--error)]">
            {actionError}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-[var(--radius)]" />
          ))
        ) : (
          <>
            <KPICard icon={<Server size={20} />} label="Serveurs totaux" value={formatNumber(stats?.totalGuilds ?? 0)} />
            <KPICard icon={<Users size={20} />} label="Utilisateurs" value={formatNumber(stats?.totalUsers ?? 0)} />
            <KPICard icon={<Terminal size={20} />} label="Commandes" value={formatNumber(stats?.totalCommands ?? 0)} />
            <KPICard icon={<Clock size={20} />} label="Uptime" value={formatDuration(stats?.uptime ?? 0)} />
            <KPICard icon={<Cpu size={20} />} label="CPU / RAM" value={`${stats?.cpuUsage ?? 0}% / ${stats?.ramUsage ?? 0}%`} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Actions rapides</h2>
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-[var(--radius-sm)]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((a) => (
                <motion.button
                  key={a.key}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleAction(a.key, a.fn)}
                  disabled={actionLoading === a.key}
                  className="flex flex-col items-start gap-1.5 p-4 bg-[var(--bg-surface-alt)] border border-[var(--border-color)] rounded-[var(--radius-sm)] text-left cursor-pointer hover:border-[var(--accent)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-2">
                    <span className={`p-1.5 rounded-[var(--radius-sm)] ${
                      a.variant === 'danger' ? 'bg-[var(--error)]/10 text-[var(--error)]' :
                      a.variant === 'primary' ? 'bg-[var(--accent)]/10 text-[var(--accent)]' :
                      'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                    }`}>
                      {actionLoading === a.key ? (
                        <svg className="animate-spin" width={16} height={16} viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                      ) : a.icon}
                    </span>
                    <span className="text-sm font-medium text-[var(--text-primary)]">{a.label}</span>
                  </div>
                  <span className="text-xs text-[var(--text-secondary)]">{a.desc}</span>
                </motion.button>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Santé des services</h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-[var(--radius-sm)]" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {systems.map((svc) => (
                <div key={svc.name} className="flex items-center justify-between py-2 px-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
                  <span className="text-sm text-[var(--text-primary)]">{serviceLabels[svc.name] ?? svc.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant[svc.status] ?? 'success'}>
                      {svc.status === 'OPERATIONAL' ? 'OK' : svc.status === 'DEGRADED' ? 'Dégradé' : svc.status === 'MAINTENANCE' ? 'Maintenance' : 'Critique'}
                    </Badge>
                    {svc.status === 'OPERATIONAL' ? (
                      <CheckCircle size={14} className="text-[var(--success)]" />
                    ) : (
                      <XCircle size={14} className="text-[var(--error)]" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Actions owner récentes</h2>
          <Activity size={16} className="text-[var(--text-secondary)]" />
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-[var(--radius-sm)]" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <EmptyState title="Aucune action" description="Aucune action owner récente." />
        ) : (
          <div className="space-y-2">
            {logs.map((log: OwnerAction) => (
              <div key={log.id} className="flex items-center justify-between py-2.5 px-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
                <div className="flex items-center gap-3">
                  {log.success ? (
                    <CheckCircle size={14} className="text-[var(--success)] shrink-0" />
                  ) : (
                    <XCircle size={14} className="text-[var(--error)] shrink-0" />
                  )}
                  <div>
                    <span className="text-sm text-[var(--text-primary)]">{log.details || log.action}</span>
                    <p className="text-xs text-[var(--text-secondary)]">{log.user.username}</p>
                  </div>
                </div>
                <span className="text-xs text-[var(--text-secondary)] shrink-0">{formatDate(log.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <DeploymentProgressModal deploymentId={deployId} onClose={() => setDeployId(null)} />
    </motion.div>
  );
}
