'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Server, Users, Terminal, Clock, Cpu,
  RefreshCw, RotateCcw, Save, Power, Activity,
  CheckCircle, XCircle, Heart, FileText, StickyNote,
  Plus, Trash2, Edit2, X
} from 'lucide-react';
import {
  Card, Button, Badge, Skeleton, KPICard, EmptyState, ErrorMessage, Input
} from '@pinguin/ui';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend
} from 'recharts';
import { fetchBotStats, fetchOwnerLogs, triggerBackup, triggerRestart, triggerDeploy, triggerRollback, fetchOnboardingSources, api } from '@/lib/api';
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

  const loadSources = useCallback(async () => {
    setSourceLoading(true);
    try {
      const res = await fetchOnboardingSources({ page: String(sourcePage), limit: '20' });
      if (res.success && res.data) setSourceData(res.data);
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
      if (statsRes.success && statsRes.data) setStats(statsRes.data);
      if (logsRes.success && logsRes.data) {
        setLogs(Array.isArray(logsRes.data) ? logsRes.data as unknown as OwnerAction[] : (logsRes.data as unknown as { entries?: OwnerAction[] })?.entries ?? []);
      }
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      if (!silent) setLoading(false);
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

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
        <ErrorMessage title="Erreur" message={error} onRetry={() => load()} />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="space-y-8">
      <div className="mb-2">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Panel Owner</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Administration et gestion avancée de Pinguin BOAT.</p>
        {actionError && (
          <div className="mt-4 rounded-[var(--radius-sm)] border border-[var(--error)] bg-[var(--error)]/10 p-3 text-sm text-[var(--error)]">
            {actionError}
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-[var(--radius)]" />) : (
          <>
            <KPICard icon={<Server size={20} />} label="Serveurs" value={formatNumber(stats?.totalGuilds ?? 0)} />
            <KPICard icon={<Users size={20} />} label="Utilisateurs" value={formatNumber(stats?.totalUsers ?? 0)} />
            <KPICard icon={<Terminal size={20} />} label="Commandes" value={formatNumber(stats?.totalCommands ?? 0)} />
            <KPICard icon={<Clock size={20} />} label="Uptime" value={formatDuration(stats?.uptime ?? 0)} />
            <KPICard icon={<Cpu size={20} />} label="CPU / RAM" value={`${stats?.cpuUsage ?? 0}% / ${stats?.ramUsage ?? 0}%`} />
          </>
        )}
      </div>

      {/* Actions + Services */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-4">
          <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">Actions rapides</h2>
          {loading ? (
            <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-[var(--radius-sm)]" />)}</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((a) => (
                <motion.button key={a.key} whileTap={{ scale: 0.97 }}
                  onClick={() => handleAction(a.key, a.fn)}
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
        <div className="flex items-center gap-2 mb-4">
          <Heart size={16} className="text-[var(--accent)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Gestion des donateurs</h2>
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
                  <Badge variant={d.isDonor ? 'success' : 'default'}>{d.isDonor ? 'Actif' : 'Inactif'}</Badge>
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
          <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">Contenu *</label>
          <textarea
            value={clForm.content}
            onChange={(e) => setClForm({ ...clForm, content: e.target.value })}
            placeholder="Décrivez les changements..."
            className="w-full px-3 py-2 text-sm text-[var(--text-primary)] bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] outline-none focus:border-[var(--accent)] transition-colors resize-none h-20"
          />
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
                <button type="button" onClick={() => handleDeleteChangelog(cl.id)}
                  className="p-1.5 rounded hover:bg-[var(--error)]/10 text-[var(--error)] transition-colors ml-4 shrink-0">
                  <Trash2 size={14} />
                </button>
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
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-[var(--radius-sm)]" />)}</div>
        ) : logs.length === 0 ? (
          <EmptyState title="Aucune action" description="Aucune action owner récente." />
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
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
              <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-3 uppercase tracking-wide">Réponses "Autre"</h3>
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
    </motion.div>
  );
}
