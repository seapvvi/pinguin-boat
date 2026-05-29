'use client';
import { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Server, Play, Square, RotateCcw, Activity, CheckCircle,
  XCircle, Clock, Terminal, AlertTriangle, RefreshCw
} from 'lucide-react';
import {
  Card, Button, Badge, Skeleton, EmptyState, ErrorMessage
} from '@pinguin/ui';
import { fetchServices, serviceAction } from '@/lib/api';
import { formatDate, formatDuration } from '@/lib/utils';

interface Service {
  name: string;
  displayName: string;
  status: 'RUNNING' | 'STOPPED' | 'ERROR' | 'RESTARTING';
  pid?: number;
  uptime?: number;
  memory?: number;
  cpu?: number;
  logs?: string[];
  lastHealthCheck?: string;
}

const statusVariant: Record<string, 'success' | 'error' | 'warning' | 'info'> = {
  RUNNING: 'success',
  STOPPED: 'error',
  ERROR: 'error',
  RESTARTING: 'warning',
};

const statusLabel: Record<string, string> = {
  RUNNING: 'En cours',
  STOPPED: 'Arrêté',
  ERROR: 'Erreur',
  RESTARTING: 'Redémarrage...',
};

export default function OwnerServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchServices();
      if (res.success && res.data) setServices(res.data.services ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [selectedService?.logs]);

  const handleAction = async (service: Service, action: 'start' | 'stop' | 'restart') => {
    const key = `${service.name}_${action}`;
    setActionLoading(key);
    setError(null);
    try {
      await serviceAction(service.name, action);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’action service');
    } finally {
      setActionLoading(null);
    }
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
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Gestion des services</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Surveillez et gérez les services de Pinguin BOAT.</p>
        {error && (
          <div className="mt-4 rounded-[var(--radius-sm)] border border-[var(--error)] bg-[var(--error)]/10 p-3 text-sm text-[var(--error)]">
            {error}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-[var(--radius)]" />)}
        </div>
      ) : services.length === 0 ? (
        <EmptyState icon={<Server size={32} />} title="Aucun service" description="Aucun service trouvé." action={{ label: 'Actualiser', onClick: load }} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {services.map((svc) => (
            <Card key={svc.name}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {svc.status === 'RUNNING' ? (
                    <CheckCircle size={20} className="text-[var(--success)]" />
                  ) : svc.status === 'RESTARTING' ? (
                    <RefreshCw size={20} className="text-[var(--warning)] animate-spin" />
                  ) : (
                    <XCircle size={20} className="text-[var(--error)]" />
                  )}
                  <div>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{svc.displayName ?? svc.name}</span>
                    <p className="text-xs text-[var(--text-secondary)]">{svc.pid ? `PID: ${svc.pid}` : 'Non démarré'}</p>
                  </div>
                </div>
                <Badge variant={statusVariant[svc.status]}>{statusLabel[svc.status]}</Badge>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                {svc.uptime !== undefined && (
                  <div className="text-center p-2 bg-[var(--bg-surface-alt)] rounded-[var(--radius-sm)]">
                    <Clock size={12} className="mx-auto mb-1 text-[var(--text-secondary)]" />
                    <span className="block text-xs font-medium text-[var(--text-primary)]">{formatDuration(svc.uptime)}</span>
                    <span className="text-[10px] text-[var(--text-secondary)]">Uptime</span>
                  </div>
                )}
                {svc.cpu !== undefined && (
                  <div className="text-center p-2 bg-[var(--bg-surface-alt)] rounded-[var(--radius-sm)]">
                    <Activity size={12} className="mx-auto mb-1 text-[var(--text-secondary)]" />
                    <span className="block text-xs font-medium text-[var(--text-primary)]">{svc.cpu}%</span>
                    <span className="text-[10px] text-[var(--text-secondary)]">CPU</span>
                  </div>
                )}
                {svc.memory !== undefined && (
                  <div className="text-center p-2 bg-[var(--bg-surface-alt)] rounded-[var(--radius-sm)]">
                    <Terminal size={12} className="mx-auto mb-1 text-[var(--text-secondary)]" />
                    <span className="block text-xs font-medium text-[var(--text-primary)]">{(svc.memory / 1024 / 1024).toFixed(1)} MB</span>
                    <span className="text-[10px] text-[var(--text-secondary)]">RAM</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {svc.status !== 'RUNNING' ? (
                  <Button variant="success" size="sm" loading={actionLoading === `${svc.name}_start`}
                    onClick={() => handleAction(svc, 'start')}>
                    <Play size={12} /> Démarrer
                  </Button>
                ) : (
                  <Button variant="danger" size="sm" loading={actionLoading === `${svc.name}_stop`}
                    onClick={() => handleAction(svc, 'stop')}>
                    <Square size={12} /> Arrêter
                  </Button>
                )}
                <Button variant="secondary" size="sm" loading={actionLoading === `${svc.name}_restart`}
                  onClick={() => handleAction(svc, 'restart')} disabled={svc.status === 'RESTARTING'}>
                  <RotateCcw size={12} /> Redémarrer
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedService(selectedService?.name === svc.name ? null : svc)}>
                  <Terminal size={12} /> Logs
                </Button>
              </div>

              {selectedService?.name === svc.name && (
                <div className="mt-4 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-[var(--radius-sm)] p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-1">
                  {svc.logs && svc.logs.length > 0 ? svc.logs.map((line, i) => (
                    <div key={i} className={`${line.toLowerCase().includes('error') ? 'text-[var(--error)]' : 'text-[var(--text-secondary)]'}`}>
                      {line}
                    </div>
                  )) : <span className="text-[var(--text-secondary)] italic">Aucun log.</span>}
                  <div ref={logEndRef} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
