'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Server, Users, Terminal, Clock, Cpu,
  RefreshCw, RotateCcw, Save, Power, Activity,
  CheckCircle, XCircle, Heart, FileText, StickyNote,
  Plus, Trash2, Edit2, X, Search, Pin, Download, BarChart3,
} from 'lucide-react';
import {
  Card, Button, Badge, Skeleton, KPICard, EmptyState, ErrorMessage, Input
} from '@pinguin/ui';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import { fetchBotStats, fetchOwnerLogs, triggerBackup, triggerRestart, triggerDeploy, triggerRollback, fetchOnboardingSources, api } from '@/lib/api';
import { formatNumber, formatDuration, formatDate } from '@/lib/utils';
import DeploymentProgressModal from '@/components/DeploymentProgressModal';
import { ConfirmActionModal } from '@/components/ConfirmActionModal';
import { ToastAlert } from '@/components/ToastAlert';
import { Switch } from '@/components/Switch';

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

interface Donor {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  amount: number;
  message: string | null;
  isDonor: boolean;
  embedColor: string | null;
}

interface Changelog {
  id: string;
  title: string;
  content: string;
  version: string | null;
  published: boolean;
  pinned: boolean;
  createdAt: string;
}

interface UptimeEntry {
  date: string;
  uptime: number;
}

interface CommandEntry {
  name: string;
  count: number;
}

const sourceLabels: Record<string, string> = {
  'top.gg': 'Top.gg',
  'word_of_mouth': 'Bouche à oreille',
  'social_media': 'Réseaux sociaux',
  'other': 'Autre',
};

const PIE_COLORS = ['#5865f2', '#57f287', '#fee75c', '#ed4245'];

const serviceLabels: Record<string, string> = {
  Bot: 'Bot Discord', API: 'API REST', Web: 'Interface Web',
  Database: 'Base de données', Cache: 'Cache Redis',
};

const statusVariant: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
  OPERATIONAL: 'success', DEGRADED: 'warning', MAINTENANCE: 'info', CRITICAL: 'error',
};

export default function OwnerDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    totalGuilds?: number;
    totalUsers?: number;
    totalCommands?: number;
    uptime?: number;
    cpuUsage?: number;
    ramUsage?: number;
    systemStatus?: 'OPERATIONAL' | 'DEGRADED' | 'MAINTENANCE' | 'CRITICAL';
  } | null>(null);
  const [logs, setLogs] = useState<OwnerAction[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deployId, setDeployId] = useState<string | null>(null);

  const [donors, setDonors] = useState<Donor[]>([]);
  const [donorsLoading, setDonorsLoading] = useState(true);
  const [donorForm, setDonorForm] = useState({ userId: '', username: '', amount: '', message: '', avatarUrl: '' });
  const [donorSaving, setDonorSaving] = useState(false);
  const [donorError, setDonorError] = useState<string | null>(null);
  const [editingDonor, setEditingDonor] = useState<Donor | null>(null);

  const [changelogs, setChangelogs] = useState<Changelog[]>([]);
  const [changelogsLoading, setChangelogsLoading] = useState(true);
  const [clForm, setClForm] = useState({ title: '', content: '', version: '' });
  const [clSaving, setClSaving] = useState(false);
  const [clError, setClError] = useState<string | null>(null);
  const [clPreview, setClPreview] = useState(false);

  const [notes, setNotes] = useState('');
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sourceData, setSourceData] = useState<{
    breakdown?: Array<{ source: string; count: number }>;
    otherDetails?: Array<{ details: string; guildId: string; createdAt: string }>;
    pagination?: { page: number; totalPages: number };
  } | null>(null);
  const [sourceLoading, setSourceLoading] = useState(true);
  const [sourcePage, setSourcePage] = useState(1);

  const [uptimeHistory, setUptimeHistory] = useState<UptimeEntry[]>([]);
  const [commandBreakdown, setCommandBreakdown] = useState<CommandEntry[]>([]);

  const [logSearch, setLogSearch] = useState('');
  const [logFilter, setLogFilter] = useState<'all' | 'success' | 'error'>('all');
  const [pendingAction, setPendingAction] = useState<{ key: string; fn: () => Promise<{ success?: boolean; data?: Record<string, unknown>; message?: string }> } | null>(null);

  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadSources = useCallback(async () => {
    setSourceLoading(true);
    try {
      const res = await fetchOnboardingSources({ page: String(sourcePage), limit: '20' });
      if (res.success && res.data) setSourceData(res.data as typeof sourceData);
    } catch { } finally {
      setSourceLoading(false);
    }
  }, [sourcePage]);

  useEffect(() => { loadSources(); }, [loadSources]);

  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [statsRes, logsRes] = await Promise.all([
        fetchBotStats(),
        fetchOwnerLogs({ limit: '10' }),
      ]);
      if (statsRes.success && statsRes.data) {
        const s = statsRes.data as typeof stats;
        setStats(s);
        if (s && !silent && (Number(s.cpuUsage) > 80 || Number(s.ramUsage) > 85)) {
          const parts: string[] = [];
          if (Number(s.cpuUsage) > 80) parts.push(`CPU à ${s.cpuUsage}%`);
          if (Number(s.ramUsage) > 85) parts.push(`RAM à ${s.ramUsage}%`);
          setToastMsg(`Alerte ressources : ${parts.join(' • ')}`);
        }
      }
      if (logsRes.success && logsRes.data) {
        setLogs(Array.isArray(logsRes.data) ? logsRes.data as unknown as OwnerAction[] : (logsRes.data as unknown as { entries?: OwnerAction[] })?.entries ?? []);
      }
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      if (!silent) setLoading(false);
      setLastRefreshed(new Date());
    }
  }, []);

  const loadDonors = useCallback(async () => {
    setDonorsLoading(true);
    try {
      const res = await api.get<{ data?: { donors?: Donor[] } }>('/api/owner/donors');
      setDonors(res?.data?.donors ?? []);
    } catch { } finally { setDonorsLoading(false); }
  }, []);

  const loadChangelogs = useCallback(async () => {
    setChangelogsLoading(true);
    try {
      const res = await api.get<{ data?: { entries?: Changelog[]; changelogs?: Changelog[] } }>('/api/owner/changelogs');
      setChangelogs(res?.data?.entries ?? res?.data?.changelogs ?? []);
    } catch { } finally { setChangelogsLoading(false); }
  }, []);

  const loadNotes = useCallback(async () => {
    setNotesLoading(true);
    try {
      const res = await api.get<{ data?: { content?: string } }>('/api/owner/notes');
      setNotes(res?.data?.content ?? '');
    } catch { } finally { setNotesLoading(false); }
  }, []);

  useEffect(() => {
    load();
    loadDonors();
    loadChangelogs();
    loadNotes();
    refreshIntervalRef.current = setInterval(() => load(true), 10000);
    return () => { if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current); };
  }, [load, loadDonors, loadChangelogs, loadNotes]);

  useEffect(() => {
    const mockUptime = Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString('fr-FR', { weekday: 'short' }),
      uptime: 95 + Math.random() * 5,
    }));
    setUptimeHistory(mockUptime);

    const mockCommands = [
      { name: '/ban', count: 1240 },
      { name: '/help', count: 980 },
      { name: '/stats', count: 754 },
      { name: '/mute', count: 631 },
      { name: '/play', count: 412 },
    ];
    setCommandBreakdown(mockCommands);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
      if (e.key === 'd' || e.key === 'D') handleAction('deploy', triggerDeploy);
      if (e.key === 'b' || e.key === 'B') handleAction('backup', triggerBackup);
      if (e.key === 'r' || e.key === 'R') handleAction('restart', triggerRestart);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (lastRefreshed) setSecondsAgo(Math.round((Date.now() - lastRefreshed.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastRefreshed]);

  const handleAction = async (action: string, fn: () => Promise<{ success?: boolean; data?: Record<string, unknown>; message?: string }>) => {
    setActionLoading(action);
    setActionError(null);
    try {
      const res = await fn();
      if (action === 'deploy' && res?.data?.id) setDeployId(res.data.id as string);
      if (!res?.success) throw new Error(res?.message || 'Action échouée');
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erreur lors de l\'action');
    } finally {
      setActionLoading(null);
      setLastRefreshed(new Date());
    }
  };

  const handleSaveDonor = async () => {
    setDonorSaving(true);
    setDonorError(null);
    try {
      if (editingDonor) {
        await api.patch(`/api/owner/donors/${editingDonor.id}`, {
          username: donorForm.username,
          amount: parseFloat(donorForm.amount) || 0,
          message: donorForm.message || null,
          avatarUrl: donorForm.avatarUrl || null,
        });
      } else {
        await api.post('/api/owner/donors', {
          userId: donorForm.userId,
          username: donorForm.username,
          amount: parseFloat(donorForm.amount) || 0,
          message: donorForm.message || null,
          avatarUrl: donorForm.avatarUrl || null,
        });
      }
      setDonorForm({ userId: '', username: '', amount: '', message: '', avatarUrl: '' });
      setEditingDonor(null);
      await loadDonors();
    } catch (e: unknown) {
      setDonorError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setDonorSaving(false);
    }
  };

  const handleDeleteDonor = async (id: string) => {
    try {
      await api.delete(`/api/owner/donors/${id}`);
      await loadDonors();
    } catch { }
  };

  const handleToggleDonor = async (id: string, current: boolean) => {
    try {
      await api.patch(`/api/owner/donors/${id}`, { isDonor: !current });
      await loadDonors();
    } catch { }
  };

  const handleSaveChangelog = async () => {
    setClSaving(true);
    setClError(null);
    try {
      await api.post('/api/owner/changelogs', {
        title: clForm.title,
        content: clForm.content,
        version: clForm.version || null,
      });
      setClForm({ title: '', content: '', version: '' });
      await loadChangelogs();
    } catch (e: unknown) {
      setClError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setClSaving(false);
    }
  };

  const handleDeleteChangelog = async (id: string) => {
    try {
      await api.delete(`/api/owner/changelogs/${id}`);
      await loadChangelogs();
    } catch { }
  };

  const handleTogglePin = async (id: string, current: boolean) => {
    try {
      await api.patch(`/api/owner/changelogs/${id}`, { pinned: !current });
      await loadChangelogs();
    } catch { }
  };

  const handleNotesChange = (val: string) => {
    setNotes(val);
    setNotesSaved(false);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      setNotesSaving(true);
      try {
        await api.patch('/api/owner/notes', { content: val });
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2000);
      } catch { } finally { setNotesSaving(false); }
    }, 1500);
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Discord ID', 'Username', 'Montant (€)', 'Message', 'Actif'];
    const rows = donors.map(d => [
      d.id, d.userId, d.username,
      d.amount.toFixed(2),
      d.message ? `"${d.message.replace(/"/g, '""')}"` : '',
      d.isDonor ? 'Oui' : 'Non',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `donateurs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const quickActions = [
    { key: 'deploy', icon: <RefreshCw size={16} />, label: 'Mettre à jour', desc: 'Clone propre + install + build + migrate + swap atomique', variant: 'primary' as const, fn: () => triggerDeploy() },
    { key: 'rollback', icon: <RotateCcw size={16} />, label: 'Rollback', desc: 'Revenir à la version précédente', variant: 'secondary' as const, fn: () => triggerRollback() },
    { key: 'backup', icon: <Save size={16} />, label: 'Backup', desc: 'Sauvegarder les données', variant: 'secondary' as const, fn: () => triggerBackup() },
    { key: 'restart', icon: <Power size={16} />, label: 'Redémarrer tout', desc: 'Redémarrer tous les services', variant: 'danger' as const, fn: () => triggerRestart() },
    { key: 'restart-bot', icon: <RotateCcw size={16} />, label: 'Redémarrer Bot', desc: 'Redémarrer le service Bot Discord', variant: 'danger' as const, fn: () => triggerRestart('bot') },
    { key: 'restart-web', icon: <RotateCcw size={16} />, label: 'Redémarrer Dashboard', desc: 'Redémarrer le service Interface Web', variant: 'danger' as const, fn: () => triggerRestart('web') },
  ];

  const systems: SystemService[] = [
    { name: 'Bot', status: stats?.systemStatus ?? 'OPERATIONAL' },
    { name: 'API', status: 'OPERATIONAL' },
    { name: 'Web', status: 'OPERATIONAL' },
    { name: 'Database', status: 'OPERATIONAL' },
    { name: 'Cache', status: 'OPERATIONAL' },
  ];

  const filteredLogs = logs.filter(log => {
    const matchText = logSearch === '' ||
      log.details?.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.action?.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.user?.username?.toLowerCase().includes(logSearch.toLowerCase());
    const matchStatus = logFilter === 'all' ||
      (logFilter === 'success' && log.success) ||
      (logFilter === 'error' && !log.success);
    return matchText && matchStatus;
  });

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
        <ErrorMessage title="Erreur" message={error} onRetry={() => load()} />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Panel Owner</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Administration et gestion avancée de Pinguin BOAT.</p>
          {actionError && (
            <div className="mt-4 rounded-[var(--radius-sm)] border border-[var(--error)] bg-[var(--error)]/10 p-3 text-sm text-[var(--error)]">
              {actionError}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success)]" />
          </span>
          Live · {lastRefreshed ? `mis à jour il y a ${secondsAgo}s` : 'chargement…'}
        </div>
      </div>

      {/* Mini-card : dernière action */}
      {!loading && logs.length > 0 && (() => {
        const last = logs[0];
        return (
          <div className="flex items-center gap-3 px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)] border border-[var(--border-color)] text-sm w-fit">
            {last.success
              ? <CheckCircle size={14} className="text-[var(--success)]" />
              : <XCircle size={14} className="text-[var(--error)]" />}
            <span className="text-[var(--text-secondary)]">Dernière action :</span>
            <span className="text-[var(--text-primary)] font-medium">{last.details || last.action}</span>
            <span className="text-[var(--text-secondary)]">— {formatDate(last.createdAt)}</span>
          </div>
        );
      })()}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-[var(--radius)]" />) : (
          <>
            <KPICard icon={<Server size={20} />} label="Serveurs" value={formatNumber(stats?.totalGuilds ?? 0)} />
            <KPICard icon={<Users size={20} />} label="Utilisateurs" value={formatNumber(stats?.totalUsers ?? 0)} />
            <KPICard icon={<Terminal size={20} />} label="Commandes" value={formatNumber(stats?.totalCommands ?? 0)} />
            <KPICard icon={<Clock size={20} />} label="Uptime" value={formatDuration(stats?.uptime ?? 0)} />
            <KPICard
              icon={<Cpu size={20} />}
              label="CPU"
              value={
                <div>
                  <span className="font-bold">{stats?.cpuUsage ?? 0}%</span>
                  <div className="w-full h-1.5 rounded-full bg-[var(--bg-surface-alt)] mt-1">
                    <div className="h-full rounded-full transition-all duration-500" style={{
                      width: `${Math.min(stats?.cpuUsage ?? 0, 100)}%`,
                      backgroundColor: (stats?.cpuUsage ?? 0) > 80 ? 'var(--error)' : (stats?.cpuUsage ?? 0) > 60 ? 'var(--warning)' : 'var(--success)',
                    }} />
                  </div>
                </div>
              }
            />
            <KPICard
              icon={<Activity size={20} />}
              label="RAM"
              value={
                <div>
                  <span className="font-bold">{stats?.ramUsage ?? 0}%</span>
                  <div className="w-full h-1.5 rounded-full bg-[var(--bg-surface-alt)] mt-1">
                    <div className="h-full rounded-full transition-all duration-500" style={{
                      width: `${Math.min(stats?.ramUsage ?? 0, 100)}%`,
                      backgroundColor: (stats?.ramUsage ?? 0) > 80 ? 'var(--error)' : (stats?.ramUsage ?? 0) > 60 ? 'var(--warning)' : 'var(--success)',
                    }} />
                  </div>
                </div>
              }
            />
          </>
        )}
      </div>

      {/* Uptime chart */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={16} className="text-[var(--accent)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Uptime historique (7 jours)</h2>
        </div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={uptimeHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <YAxis domain={[90, 100]} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--bg-surface-alt)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
              />
              <Line type="monotone" dataKey="uptime" stroke="var(--accent)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Top commands */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={16} className="text-[var(--accent)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Top commandes</h2>
        </div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={commandBreakdown} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--bg-surface-alt)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
              />
              <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Actions + Services */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">Actions rapides</h2>
          {loading ? (
            <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-[var(--radius-sm)]" />)}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((a) => (
                  <motion.button key={a.key} whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      if (a.key === 'restart' || a.key === 'rollback') {
                        setPendingAction({ key: a.key, fn: a.fn });
                      } else {
                        handleAction(a.key, a.fn);
                      }
                    }}
                    disabled={actionLoading === a.key}
                    className="flex flex-col items-start gap-1.5 p-4 bg-[var(--bg-surface-alt)] border border-[var(--border-color)] rounded-[var(--radius-sm)] text-left cursor-pointer hover:border-[var(--accent)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`p-1.5 rounded-[var(--radius-sm)] ${a.variant === 'danger' ? 'bg-[var(--error)]/10 text-[var(--error)]' : a.variant === 'primary' ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'}`}>
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
              <p className="text-xs text-[var(--text-secondary)] mt-3">
                Raccourcis : <kbd className="px-1 py-0.5 rounded bg-[var(--bg-surface-alt)] border border-[var(--border-color)] text-xs font-mono">D</kbd> Deploy ·
                <kbd className="px-1 py-0.5 rounded bg-[var(--bg-surface-alt)] border border-[var(--border-color)] text-xs font-mono ml-1">B</kbd> Backup ·
                <kbd className="px-1 py-0.5 rounded bg-[var(--bg-surface-alt)] border border-[var(--border-color)] text-xs font-mono ml-1">R</kbd> Restart
              </p>
            </>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">Santé des services</h2>
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-[var(--radius-sm)]" />)}</div>
          ) : (
            <div className="space-y-2">
              {systems.map((svc) => (
                <div key={svc.name} className="flex items-center justify-between py-2 px-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
                  <span className="text-sm text-[var(--text-primary)]">{serviceLabels[svc.name] ?? svc.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant[svc.status] ?? 'success'}>
                      {svc.status === 'OPERATIONAL' ? 'OK' : svc.status === 'DEGRADED' ? 'Dégradé' : svc.status === 'MAINTENANCE' ? 'Maintenance' : 'Critique'}
                    </Badge>
                    {svc.status === 'OPERATIONAL' ? <CheckCircle size={14} className="text-[var(--success)]" /> : <XCircle size={14} className="text-[var(--error)]" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Donateurs */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Heart size={16} className="text-[var(--accent)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Gestion des donateurs</h2>
          </div>
          <Button variant="secondary" size="sm" disabled={donors.length === 0} onClick={handleExportCSV}>
            <Download size={14} /> Exporter CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          <Input label="Discord ID *" value={donorForm.userId} onChange={(e) => setDonorForm({ ...donorForm, userId: e.target.value })} placeholder="123456789" disabled={!!editingDonor} />
          <Input label="Pseudo *" value={donorForm.username} onChange={(e) => setDonorForm({ ...donorForm, username: e.target.value })} placeholder="username" />
          <Input label="Montant (€)" type="number" value={donorForm.amount} onChange={(e) => setDonorForm({ ...donorForm, amount: e.target.value })} placeholder="5.00" />
          <Input label="Message" value={donorForm.message} onChange={(e) => setDonorForm({ ...donorForm, message: e.target.value })} placeholder="Merci !" />
          <Input label="Avatar URL" value={donorForm.avatarUrl} onChange={(e) => setDonorForm({ ...donorForm, avatarUrl: e.target.value })} placeholder="https://..." />
        </div>
        {donorError && <p className="text-sm text-[var(--error)] mb-3">{donorError}</p>}
        <div className="flex gap-2 mb-5">
          <Button loading={donorSaving} onClick={handleSaveDonor} disabled={!donorForm.userId || !donorForm.username}>
            <Plus size={14} /> {editingDonor ? 'Mettre à jour' : 'Ajouter'}
          </Button>
          {editingDonor && (
            <Button variant="secondary" onClick={() => { setEditingDonor(null); setDonorForm({ userId: '', username: '', amount: '', message: '', avatarUrl: '' }); }}>
              <X size={14} /> Annuler
            </Button>
          )}
        </div>

        {donorsLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-[var(--radius-sm)]" />)}</div>
        ) : donors.length === 0 ? (
          <EmptyState title="Aucun donateur" description="Ajoutez votre premier donateur ci-dessus." />
        ) : (
          <div className="space-y-2">
            {donors.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)] border border-[var(--border-color)]">
                <div className="flex items-center gap-3">
                  {d.avatarUrl ? <img src={d.avatarUrl} alt="" className="w-8 h-8 rounded-full" /> : <div className="w-8 h-8 rounded-full bg-[var(--bg-surface)] flex items-center justify-center"><Heart size={14} className="text-[var(--accent)]" /></div>}
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{d.username}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{d.amount.toFixed(2)} € · ID: {d.userId}</p>
                    {d.message && <p className="text-xs text-[var(--text-secondary)] italic">&quot;{d.message}&quot;</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={d.isDonor}
                    onChange={() => handleToggleDonor(d.id, d.isDonor)}
                  />
                  <button type="button" onClick={() => { setEditingDonor(d); setDonorForm({ userId: d.userId, username: d.username, amount: String(d.amount), message: d.message ?? '', avatarUrl: d.avatarUrl ?? '' }); }}
                    className="p-1.5 rounded hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button type="button" onClick={() => handleDeleteDonor(d.id)}
                    className="p-1.5 rounded hover:bg-[var(--error)]/10 text-[var(--error)] transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Changelogs */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={16} className="text-[var(--accent)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Changelogs</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <Input label="Titre *" value={clForm.title} onChange={(e) => setClForm({ ...clForm, title: e.target.value })} placeholder="v2.5.0 — Nouvelles fonctionnalités" />
          <Input label="Version" value={clForm.version} onChange={(e) => setClForm({ ...clForm, version: e.target.value })} placeholder="2.5.0" />
        </div>
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase">Contenu *</label>
            <div className="flex gap-1">
              {['Écrire', 'Aperçu'].map((tab) => (
                <button key={tab}
                  type="button"
                  onClick={() => setClPreview(tab === 'Aperçu')}
                  className={`px-3 py-1 text-xs rounded-[var(--radius-sm)] transition-colors ${
                    (tab === 'Aperçu') === clPreview
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >{tab}</button>
              ))}
            </div>
          </div>
          {!clPreview ? (
            <textarea
              value={clForm.content}
              onChange={(e) => setClForm({ ...clForm, content: e.target.value })}
              placeholder="Décrivez les changements..."
              className="w-full px-3 py-2 text-sm text-[var(--text-primary)] bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] outline-none focus:border-[var(--accent)] transition-colors resize-none h-20"
            />
          ) : (
            <div className="w-full px-3 py-2 text-sm border border-[var(--border-color)] rounded-[var(--radius-sm)] min-h-[5rem]">
              <div className="prose prose-sm dark:prose-invert max-w-none text-[var(--text-primary)]">
                <ReactMarkdown>
                  {clForm.content || '*Aucun contenu à prévisualiser*'}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
        {clError && <p className="text-sm text-[var(--error)] mb-3">{clError}</p>}
        <Button loading={clSaving} onClick={handleSaveChangelog} disabled={!clForm.title || !clForm.content} className="mb-5">
          <Plus size={14} /> Publier
        </Button>

        {changelogsLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-[var(--radius-sm)]" />)}</div>
        ) : changelogs.length === 0 ? (
          <EmptyState title="Aucun changelog" description="Publiez votre premier changelog ci-dessus." />
        ) : (
          <div className="space-y-2">
            {changelogs.map((cl) => (
              <div key={cl.id} className="flex items-start justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)] border border-[var(--border-color)]">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{cl.title}</p>
                    {cl.version && <Badge variant="info">v{cl.version}</Badge>}
                    {cl.pinned && <Badge variant="warning">Épinglé</Badge>}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-1">{cl.content}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{formatDate(cl.createdAt)}</p>
                </div>
                <div className="flex items-center gap-1 ml-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleTogglePin(cl.id, cl.pinned)}
                    className={`p-1.5 rounded transition-colors ${
                      cl.pinned
                        ? 'text-[var(--warning)] bg-[var(--warning)]/10'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
                    }`}
                    title={cl.pinned ? 'Désépingler' : 'Épingler'}
                  >
                    <Pin size={14} />
                  </button>
                  <button type="button" onClick={() => handleDeleteChangelog(cl.id)}
                    className="p-1.5 rounded hover:bg-[var(--error)]/10 text-[var(--error)] transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Notes internes */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <StickyNote size={16} className="text-[var(--accent)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Notes internes</h2>
          </div>
          <span className="text-xs text-[var(--text-secondary)]">
            {notesSaving ? 'Sauvegarde…' : notesSaved ? '✓ Sauvegardé' : 'Auto-save 1.5s'}
          </span>
        </div>
        {notesLoading ? (
          <Skeleton className="h-32 w-full rounded-[var(--radius-sm)]" />
        ) : (
          <textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Notes privées, idées, todo…"
            className="w-full px-3 py-2 text-sm text-[var(--text-primary)] bg-[var(--bg-surface-alt)] border border-[var(--border-color)] rounded-[var(--radius-sm)] outline-none focus:border-[var(--accent)] transition-colors resize-none h-40"
          />
        )}
      </Card>

      {/* Logs owner */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Actions owner récentes</h2>
          <Activity size={16} className="text-[var(--text-secondary)]" />
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <Input
              placeholder="Rechercher une action…"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex gap-1">
            {(['all', 'success', 'error'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setLogFilter(f)}
                className={`px-3 py-1 text-xs rounded-[var(--radius-sm)] transition-colors ${
                  logFilter === f
                    ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {f === 'all' ? 'Tous' : f === 'success' ? 'Succès' : 'Erreurs'}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-[var(--radius-sm)]" />)}</div>
        ) : filteredLogs.length === 0 ? (
          logSearch ? (
            <EmptyState title={`Aucun résultat pour «${logSearch}»`} description="Essayez une autre recherche." />
          ) : (
            <EmptyState title="Aucune action" description="Aucune action owner récente." />
          )
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between py-2.5 px-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
                <div className="flex items-center gap-3">
                  {log.success ? <CheckCircle size={14} className="text-[var(--success)] shrink-0" /> : <XCircle size={14} className="text-[var(--error)] shrink-0" />}
                  <div>
                    <span className="text-sm text-[var(--text-primary)]">{log.details || log.action}</span>
                    <p className="text-xs text-[var(--text-secondary)]">{log.user?.username}</p>
                  </div>
                </div>
                <span className="text-xs text-[var(--text-secondary)] shrink-0">{formatDate(log.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Sources d'acquisition */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={16} className="text-[var(--accent)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Sources d'acquisition</h2>
        </div>

        {sourceLoading ? (
          <Skeleton className="h-48 w-full rounded-[var(--radius-sm)]" />
        ) : sourceData ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceData.breakdown ?? []}
                    dataKey="count"
                    nameKey="source"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ payload, percent }: { payload?: { source: string }; percent?: number }) => {
                      const src = payload?.source ?? '';
                      return `${sourceLabels[src] || src} (${((percent ?? 0) * 100).toFixed(0)}%)`;
                    }}
                  >
                    {(sourceData.breakdown ?? []).map((_: { source: string; count: number }, i: number) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--bg-surface-alt)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
                    formatter={(value, name) => [value ?? 0, sourceLabels[String(name ?? '')] ?? String(name ?? '')]}
                  />
                  <Legend formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{sourceLabels[String(value)] ?? String(value)}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-3 uppercase tracking-wide">Réponses &quot;Autre&quot;</h3>
              {(sourceData.otherDetails?.length ?? 0) > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {sourceData.otherDetails?.map((item: { details: string; guildId: string; createdAt: string }, i: number) => (
                    <div key={i} className="p-2 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
                      <p className="text-xs text-[var(--text-primary)]">{item.details}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {item.guildId} · {formatDate(item.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-[var(--text-secondary)]">Aucune réponse détaillée.</span>
              )}

              {sourceData.pagination && sourceData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <Button variant="ghost" size="sm" disabled={sourcePage <= 1} onClick={() => setSourcePage((p) => p - 1)}>
                    Précédent
                  </Button>
                  <span className="text-xs text-[var(--text-secondary)]">
                    Page {sourceData.pagination.page} / {sourceData.pagination.totalPages}
                  </span>
                  <Button variant="ghost" size="sm" disabled={sourcePage >= sourceData.pagination.totalPages} onClick={() => setSourcePage((p) => p + 1)}>
                    Suivant
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <EmptyState title="Aucune donnée" description="Aucune source d'acquisition enregistrée." />
        )}
      </Card>

      <DeploymentProgressModal deploymentId={deployId} onClose={() => setDeployId(null)} />

      <ConfirmActionModal
        action={pendingAction?.key === 'restart' ? 'Redémarrer tout' : 'Rollback'}
        confirmWord={pendingAction?.key === 'restart' ? 'RESTART' : 'ROLLBACK'}
        description={pendingAction?.key === 'restart'
          ? 'Voulez-vous vraiment redémarrer tous les services ?'
          : 'Voulez-vous vraiment revenir à la version précédente ?'}
        onConfirm={() => {
          if (pendingAction) handleAction(pendingAction.key, pendingAction.fn);
          setPendingAction(null);
        }}
        onCancel={() => setPendingAction(null)}
      />

      <ToastAlert
        show={!!toastMsg}
        message={toastMsg ?? ''}
        type="error"
        onDismiss={() => setToastMsg(null)}
      />
    </motion.div>
  );
}
