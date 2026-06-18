'use client';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Cpu, HardDrive, Clock, Server, Terminal,
  AlertTriangle, Info, Activity, Gauge, CheckCircle
} from 'lucide-react';
import {
  Card, Badge, Skeleton, EmptyState, ErrorMessage, KPICard
} from '@pinguin/ui';
import { fetchSystemMetrics, fetchErrorLogs } from '@/lib/api';
import { formatNumber, formatDuration, formatDate } from '@/lib/utils';
import type { ErrorLog } from '@pinguin/shared';

interface MetricsData {
  cpu: number;
  ram: { used: number; total: number; percent: number };
  uptime: number;
  guilds: number;
  users: number;
  commandsExecuted: number;
  messagesToday: number;
  activeChannels: number;
}

export default function OwnerMetricsPage() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedError, setExpandedError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsRes, errorsRes] = await Promise.all([
        fetchSystemMetrics(),
        fetchErrorLogs({ limit: '20' }),
      ]);
      if (metricsRes.success && metricsRes.data) setMetrics(metricsRes.data.metrics);
      if (errorsRes.success && errorsRes.data) setErrors(errorsRes.data.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const systemInfo = {
    nodeVersion: process.version || 'N/A',
    platform: typeof navigator !== 'undefined' ? navigator.platform : 'N/A',
    os: typeof navigator !== 'undefined' ? navigator.userAgent.match(/\(([^)]+)\)/)?.[1] || 'N/A' : 'N/A',
  };

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
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Métriques système</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Surveillance des performances et des logs d'erreur.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-[var(--radius)]" />)
        ) : (
          <>
            <KPICard icon={<Server size={20} />} label="Serveurs" value={formatNumber(metrics?.guilds ?? 0)} />
            <KPICard icon={<Terminal size={20} />} label="Commandes" value={formatNumber(metrics?.commandsExecuted ?? 0)} />
            <KPICard icon={<Activity size={20} />} label="Salons actifs" value={formatNumber(metrics?.activeChannels ?? 0)} />
            <KPICard icon={<Clock size={20} />} label="Uptime" value={formatDuration(metrics?.uptime ?? 0)} />
            <KPICard icon={<Cpu size={20} />} label="CPU" value={`${metrics?.cpu ?? 0}%`} />
            <KPICard icon={<HardDrive size={20} />} label="RAM" value={`${metrics?.ram?.percent ?? 0}%`} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Utilisation CPU</h2>
          {loading ? (
            <Skeleton className="h-8 w-full rounded-[var(--radius-sm)]" />
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1">
                <span>{metrics?.cpu ?? 0}% utilisé</span>
                <span>100%</span>
              </div>
              <div className="h-4 bg-[var(--bg-surface-alt)] rounded-[0px] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(metrics?.cpu ?? 0, 100)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-[0px] ${
                    (metrics?.cpu ?? 0) > 80 ? 'bg-[var(--error)]' :
                    (metrics?.cpu ?? 0) > 50 ? 'bg-[var(--warning)]' : 'bg-[var(--success)]'
                  }`}
                />
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Utilisation RAM</h2>
          {loading ? (
            <Skeleton className="h-8 w-full rounded-[var(--radius-sm)]" />
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1">
                <span>{metrics?.ram?.percent ?? 0}% utilisé ({(metrics?.ram?.used ?? 0) / 1024 / 1024 / 1024 | 0} Go / {(metrics?.ram?.total ?? 0) / 1024 / 1024 / 1024 | 0} Go)</span>
                <span>100%</span>
              </div>
              <div className="h-4 bg-[var(--bg-surface-alt)] rounded-[0px] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(metrics?.ram?.percent ?? 0, 100)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-[0px] ${
                    (metrics?.ram?.percent ?? 0) > 80 ? 'bg-[var(--error)]' :
                    (metrics?.ram?.percent ?? 0) > 50 ? 'bg-[var(--warning)]' : 'bg-[var(--accent)]'
                  }`}
                />
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Évolution des serveurs</h2>
          {loading ? (
            <Skeleton className="h-24 w-full rounded-[var(--radius-sm)]" />
          ) : (
            <div className="flex items-center justify-center py-8 bg-[var(--bg-surface-alt)] rounded-[var(--radius-sm)]">
              <div className="text-center">
                <Server size={24} className="mx-auto mb-2 text-[var(--accent)]" />
                <span className="text-2xl font-bold text-[var(--text-primary)]">{formatNumber(metrics?.guilds ?? 0)}</span>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Serveurs actuellement</p>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Informations système</h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-[var(--radius-sm)]" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {[
                { icon: <Info size={14} />, label: 'Node.js', value: systemInfo.nodeVersion },
                { icon: <Gauge size={14} />, label: 'Plateforme', value: systemInfo.platform },
                { icon: <Activity size={14} />, label: 'OS', value: systemInfo.os },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-2 px-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-secondary)]">{item.icon}</span>
                    <span className="text-sm text-[var(--text-primary)]">{item.label}</span>
                  </div>
                  <code className="text-xs text-[var(--text-secondary)]">{item.value}</code>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Logs d'erreur</h2>
          <AlertTriangle size={16} className="text-[var(--warning)]" />
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-[var(--radius-sm)]" />)}
          </div>
        ) : errors.length === 0 ? (
          <EmptyState icon={<CheckCircle size={24} />} title="Aucune erreur" description="Tout fonctionne correctement." />
        ) : (
          <div className="space-y-2">
            {errors.map((err) => (
              <div key={err.id} className="rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)] overflow-hidden">
                <button
                  onClick={() => setExpandedError(expandedError === err.id ? null : err.id)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-[var(--bg-surface)]/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <AlertTriangle size={14} className="text-[var(--error)] shrink-0" />
                    <span className="text-sm text-[var(--text-primary)] truncate">{err.message}</span>
                    <Badge variant="error">{err.service}</Badge>
                  </div>
                  <span className="text-xs text-[var(--text-secondary)] shrink-0 ml-2">{formatDate(err.createdAt)}</span>
                </button>
                {expandedError === err.id && err.stack && (
                  <pre className="p-3 pt-0 text-xs text-[var(--text-secondary)] font-mono whitespace-pre-wrap border-t border-[var(--border-color)]">{err.stack}</pre>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
