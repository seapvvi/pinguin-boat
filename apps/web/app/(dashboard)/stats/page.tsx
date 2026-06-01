'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Cpu, Activity, Server, Users, Terminal, RefreshCw,
  TrendingUp, Clock
} from 'lucide-react';
import { Card, KPICard, Skeleton, ErrorMessage } from '@pinguin/ui';
import { fetchMetricsSnapshots, type SystemMetricsSnapshot } from '@/lib/api';
import { formatNumber, formatDuration } from '@/lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

export default function StatsPage() {
  const [snapshots, setSnapshots] = useState<SystemMetricsSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const loadSnapshots = async () => {
    try {
      const response = await fetchMetricsSnapshots();
      setSnapshots(response.data?.snapshots ?? []);
      setLastUpdate(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
    const interval = setInterval(loadSnapshots, 30000);
    return () => clearInterval(interval);
  }, []);

  const latest = snapshots[snapshots.length - 1];

  const chartData = snapshots.map(s => ({
    time: new Date(s.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    cpu: Number(s.cpuUsage.toFixed(1)),
    ram: Number(s.ramUsage.toFixed(1)),
    guilds: s.guildCount,
    users: s.userCount,
    commands: s.commandCount,
  }));

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
        <ErrorMessage title="Erreur" message={error} onRetry={loadSnapshots} />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">
            Statistiques système
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Métriques en temps réel des 24 dernières heures
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs text-[var(--text-secondary)]">
              Mis à jour à {lastUpdate.toLocaleTimeString('fr-FR')}
            </span>
          )}
          <button
            onClick={loadSnapshots}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-[var(--radius-sm)] transition-colors duration-150 border text-[var(--text-primary)] border-[var(--border-color)] hover:bg-[var(--bg-surface-alt)] hover:border-[var(--accent)]"
          >
            <RefreshCw size={14} />
            Actualiser
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-[var(--radius)]" />
          ))
        ) : latest ? (
          [
            { icon: <Cpu size={20} />, label: 'CPU', value: `${latest.cpuUsage.toFixed(1)}%` },
            { icon: <Activity size={20} />, label: 'RAM', value: `${latest.ramUsage.toFixed(1)}%` },
            { icon: <Server size={20} />, label: 'Serveurs', value: formatNumber(latest.guildCount) },
            { icon: <Users size={20} />, label: 'Utilisateurs', value: formatNumber(latest.userCount) },
            { icon: <Terminal size={20} />, label: 'Commandes', value: formatNumber(latest.commandCount) },
            { icon: <Clock size={20} />, label: 'Uptime', value: formatDuration(latest.uptimeSeconds) },
          ].map((kpi, i) => (
            <KPICard key={i} icon={kpi.icon} label={kpi.label} value={kpi.value} />
          ))
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Utilisation CPU</h2>
            <Cpu size={16} className="text-[var(--text-secondary)]" />
          </div>
          {loading ? (
            <Skeleton className="h-64 rounded-[var(--radius-sm)]" />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={256}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis 
                  dataKey="time" 
                  stroke="var(--text-secondary)"
                  fontSize={12}
                  tickFormatter={(value) => value}
                />
                <YAxis 
                  stroke="var(--text-secondary)"
                  fontSize={12}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface-alt)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  labelStyle={{ color: 'var(--text-primary)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'CPU']}
                />
                <Line 
                  type="monotone" 
                  dataKey="cpu" 
                  stroke="var(--accent)" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-[var(--text-secondary)]">
              Aucune donnée disponible
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Utilisation RAM</h2>
            <Activity size={16} className="text-[var(--text-secondary)]" />
          </div>
          {loading ? (
            <Skeleton className="h-64 rounded-[var(--radius-sm)]" />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={256}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis 
                  dataKey="time" 
                  stroke="var(--text-secondary)"
                  fontSize={12}
                />
                <YAxis 
                  stroke="var(--text-secondary)"
                  fontSize={12}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface-alt)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  labelStyle={{ color: 'var(--text-primary)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'RAM']}
                />
                <Line 
                  type="monotone" 
                  dataKey="ram" 
                  stroke="var(--success)" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-[var(--text-secondary)]">
              Aucune donnée disponible
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Serveurs & Utilisateurs</h2>
            <TrendingUp size={16} className="text-[var(--text-secondary)]" />
          </div>
          {loading ? (
            <Skeleton className="h-64 rounded-[var(--radius-sm)]" />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={256}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis 
                  dataKey="time" 
                  stroke="var(--text-secondary)"
                  fontSize={12}
                />
                <YAxis 
                  stroke="var(--text-secondary)"
                  fontSize={12}
                  tickFormatter={(value) => formatNumber(value)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface-alt)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  labelStyle={{ color: 'var(--text-primary)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                  formatter={(value: number, name: string) => [
                    formatNumber(value),
                    name === 'guilds' ? 'Serveurs' : 'Utilisateurs'
                  ]}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="guilds" 
                  stroke="var(--accent)" 
                  strokeWidth={2}
                  name="Serveurs"
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="users" 
                  stroke="var(--info)" 
                  strokeWidth={2}
                  name="Utilisateurs"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-[var(--text-secondary)]">
              Aucune donnée disponible
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Commandes exécutées</h2>
            <Terminal size={16} className="text-[var(--text-secondary)]" />
          </div>
          {loading ? (
            <Skeleton className="h-64 rounded-[var(--radius-sm)]" />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={256}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis 
                  dataKey="time" 
                  stroke="var(--text-secondary)"
                  fontSize={12}
                />
                <YAxis 
                  stroke="var(--text-secondary)"
                  fontSize={12}
                  tickFormatter={(value) => formatNumber(value)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface-alt)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  labelStyle={{ color: 'var(--text-primary)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                  formatter={(value: number) => [formatNumber(value), 'Commandes']}
                />
                <Line 
                  type="monotone" 
                  dataKey="commands" 
                  stroke="var(--warning)" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-[var(--text-secondary)]">
              Aucune donnée disponible
            </div>
          )}
        </Card>
      </div>
    </motion.div>
  );
}
