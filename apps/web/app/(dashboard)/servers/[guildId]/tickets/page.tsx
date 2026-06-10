'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Plus, MessageSquare, UserCheck, ChevronLeft, ChevronRight, Lock,
  FileText, Settings, BarChart3, List, Layers, Trash2, GripVertical, Edit3,
} from 'lucide-react';
import { Card, Table, Input, Button, Badge, Modal, Skeleton, EmptyState, KPICard } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchTickets, api, fetchTicketStats, fetchTicketCategories, deleteTicketCategory, reorderTicketCategories, generateTicketTranscript } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { TicketData } from '@pinguin/shared';
import type { Column } from '@pinguin/ui';
import { TicketStatus } from '@pinguin/shared';
import { ModuleToggle } from '@/components/ModuleToggle';
import { PermissionGate } from '@/components/PermissionGate';
import { TicketSettingsForm } from '@/components/TicketSettingsForm';
import { CategoryBuilder } from '@/components/tickets/CategoryBuilder';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type TabKey = 'overview' | 'categories' | 'settings' | 'stats';

const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Vue d\'ensemble', icon: <List size={14} /> },
  { key: 'categories', label: 'Catégories', icon: <Layers size={14} /> },
  { key: 'settings', label: 'Paramètres', icon: <Settings size={14} /> },
  { key: 'stats', label: 'Statistiques', icon: <BarChart3 size={14} /> },
];

const statusLabels: Record<string, string> = {
  OPEN: 'Ouvert',
  CLAIMED: 'Pris en charge',
  PENDING: 'En attente',
  CLOSED: 'Fermé',
  DELETED: 'Supprimé',
};

const statusVariants: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  OPEN: 'success',
  CLAIMED: 'info',
  PENDING: 'warning',
  CLOSED: 'error',
  DELETED: 'default',
};

function formatDuration(ms: number): string {
  if (ms <= 0) return '—';
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function parseRoleIds(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch { return []; }
  }
  return [];
}

const CATEGORY_COLORS = ['#14b8a6', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#10b981', '#f97316'];

export default function TicketsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // ── Tickets state ──
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // ── Categories state ──
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // ── Stats state ──
  const [stats, setStats] = useState<{
    totalOpen: number; totalClosed: number;
    avgResponseTimeMs: number; avgResolutionTimeMs: number;
    byCategory: any[];
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // ── Transcript state ──
  const [transcriptLoading, setTranscriptLoading] = useState<string | null>(null);

  const loadTickets = useCallback(async (p: number) => {
    setLoading(true); setError(null);
    try {
      const res = await fetchTickets(guildId, { page: String(p), limit: '15' });
      if (res.success && res.data) {
        setTickets(res.data.tickets);
        setTotalPages(res.data.pagination.totalPages);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally { setLoading(false); }
  }, [guildId]);

  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const res = await fetchTicketCategories(guildId);
      if (res.success && res.data) setCategories(res.data.categories ?? []);
    } catch {} finally { setLoadingCategories(false); }
  }, [guildId]);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await fetchTicketStats(guildId);
      if (res.success && res.data) setStats(res.data as any);
    } catch {} finally { setLoadingStats(false); }
  }, [guildId]);

  useEffect(() => { loadTickets(page); }, [guildId, page, loadTickets]);
  useEffect(() => { if (activeTab === 'categories') loadCategories(); else if (activeTab === 'stats') loadStats(); }, [activeTab, guildId, loadCategories, loadStats]);

  const handleAction = async (ticketId: string, action: string) => {
    setActionError(null);
    try {
      await api.put(`/api/guilds/${guildId}/tickets/${ticketId}`, { action });
      loadTickets(page);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleTranscript = async (ticketId: string) => {
    setTranscriptLoading(ticketId);
    try {
      const res = await generateTicketTranscript(guildId, ticketId);
      if (res.success && res.data) {
        const blob = new Blob([res.data.content], { type: res.data.format === 'HTML' ? 'text/html' : 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = res.data.filename; a.click();
        URL.revokeObjectURL(url);
      }
    } catch {} finally { setTranscriptLoading(null); }
  };

  const handleSaveCategory = () => { setCategoryModalOpen(false); setEditingCategory(null); loadCategories(); };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Supprimer cette catégorie ?')) return;
    await deleteTicketCategory(guildId, id);
    loadCategories();
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const reordered = [...categories];
    const [item] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, item);
    setCategories(reordered);
    setDragIdx(idx);
  };
  const handleDragEnd = async () => {
    setDragIdx(null);
    await reorderTicketCategories(guildId, categories.map((c) => c.id));
  };

  const columns: Column<TicketData>[] = [
    { key: 'subject', label: 'Sujet', render: (t) => <span className="text-sm font-medium">{t.id.slice(0, 8)}…</span> },
    { key: 'category', label: 'Catégorie', render: (t) => <Badge>{(t as any).categoryId ?? '—'}</Badge> },
    { key: 'status', label: 'Statut', sortable: true, render: (t) => <Badge variant={statusVariants[t.status]}>{statusLabels[t.status]}</Badge> },
    { key: 'creatorId', label: 'Créateur', render: (t) => <span className="font-mono text-xs">{t.creatorId.slice(0, 8)}…</span> },
    { key: 'createdAt', label: 'Date', sortable: true, render: (t) => <span className="text-xs text-[var(--text-secondary)]">{formatDate(t.createdAt)}</span> },
    {
      key: 'actions', label: 'Actions', render: (t) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTicket(t)}><MessageSquare size={12} /></Button>
          {t.status !== TicketStatus.CLOSED && t.status !== TicketStatus.DELETED && (
            <>
              {t.status === TicketStatus.OPEN && <Button variant="ghost" size="sm" onClick={() => handleAction(t.id, 'claim')}><UserCheck size={12} /></Button>}
              <Button variant="ghost" size="sm" onClick={() => handleAction(t.id, 'close')}><Lock size={12} /></Button>
            </>
          )}
          {t.status === TicketStatus.CLOSED && (
            <Button variant="ghost" size="sm" loading={transcriptLoading === t.id} onClick={() => handleTranscript(t.id)}><FileText size={12} /></Button>
          )}
        </div>
      ),
    },
  ];

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <ErrorMessage title="Erreur" message={error} onRetry={() => loadTickets(page)} />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Tickets</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Gérez les tickets de support.</p>
        </div>
      </div>

      <PermissionGate permission="manageMessages">
      <div className="mb-4">
        <ModuleToggle guildId={guildId} moduleKey="tickets" label="Tickets" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--border-color)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <Card padding={false}>
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : tickets.length === 0 ? (
            <EmptyState title="Aucun ticket" description="Aucun ticket pour le moment." />
          ) : (
            <>
              <Table columns={columns} data={tickets} keyExtractor={(t) => t.id} />
              <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-color)]">
                <span className="text-xs text-[var(--text-secondary)]">Page {page} / {totalPages}</span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft size={14} /> Précédent
                  </Button>
                  <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Suivant <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Tab: Categories */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => { setEditingCategory(null); setCategoryModalOpen(true); }}>
              <Plus size={14} /> Nouvelle catégorie
            </Button>
          </div>
          {loadingCategories ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : categories.length === 0 ? (
            <EmptyState title="Aucune catégorie" description="Créez votre première catégorie de tickets." />
          ) : (
            <div className="space-y-2">
              {categories.map((cat, idx) => (
                <div
                  key={cat.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 p-3 rounded-[var(--radius-sm)] border border-[var(--border-color)] bg-[var(--bg-surface)] transition-colors ${dragIdx === idx ? 'opacity-50' : ''}`}
                >
                  <div className="cursor-grab text-[var(--text-secondary)]"><GripVertical size={16} /></div>
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color ?? '#5865F2' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {cat.emoji && <span>{cat.emoji}</span>}
                      <span className="text-sm font-medium text-[var(--text-primary)]">{cat.name}</span>
                      <Badge variant="info">{cat.openingMode ?? 'BUTTON'}</Badge>
                      {cat.maxTicketsPerUser > 0 && (
                        <span className="text-xs text-[var(--text-secondary)]">max {cat.maxTicketsPerUser}/user</span>
                      )}
                    </div>
                    {cat.description && (
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">{cat.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingCategory(cat); setCategoryModalOpen(true); }}>
                      <Edit3 size={14} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(cat.id)}>
                      <Trash2 size={14} className="text-[var(--error)]" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Modal open={categoryModalOpen} onClose={() => { setCategoryModalOpen(false); setEditingCategory(null); }} title={editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}>
            <CategoryBuilder guildId={guildId} category={editingCategory} onSave={handleSaveCategory} onCancel={() => { setCategoryModalOpen(false); setEditingCategory(null); }} />
          </Modal>
        </div>
      )}

      {/* Tab: Settings */}
      {activeTab === 'settings' && <TicketSettingsForm guildId={guildId} />}

      {/* Tab: Stats */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          {loadingStats ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard label="Tickets ouverts" value={String(stats.totalOpen)} icon={<MessageSquare size={20} />} />
                <KPICard label="Tickets fermés" value={String(stats.totalClosed)} icon={<Lock size={20} />} />
                <KPICard label="Temps de réponse moyen" value={formatDuration(stats.avgResponseTimeMs)} icon={<UserCheck size={20} />} />
                <KPICard label="Temps de résolution moyen" value={formatDuration(stats.avgResolutionTimeMs)} icon={<BarChart3 size={20} />} />
              </div>

              {stats.byCategory.length > 0 && (
                <Card className="p-4">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Statistiques par catégorie</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.byCategory.map((c) => ({ ...c, responseMin: Math.round(c.avgResponseTimeMs / 60000), resolutionMin: Math.round(c.avgResolutionTimeMs / 60000) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                      <XAxis dataKey="categoryName" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                      <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} label={{ value: 'Minutes', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-secondary)', fontSize: 12 } }} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '13px' }}
                        formatter={(value: any, name: any) => [`${value} min`, name === 'responseMin' ? 'Réponse' : 'Résolution']}
                      />
                      <Bar dataKey="responseMin" name="Réponse" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="resolutionMin" name="Résolution" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="mt-6 space-y-2">
                    {stats.byCategory.map((c, i) => (
                      <div key={c.categoryId} className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] border border-[var(--border-color)]">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                          <span className="text-sm text-[var(--text-primary)]">{c.categoryName}</span>
                          <Badge>{c.count} ticket(s)</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                          <span>Réponse: {formatDuration(c.avgResponseTimeMs)}</span>
                          <span>Résolution: {formatDuration(c.avgResolutionTimeMs)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          ) : (
            <EmptyState title="Aucune statistique" description="Les données apparaîtront une fois les tickets créés." />
          )}
        </div>
      )}

      {/* Ticket detail modal */}
      <Modal open={!!selectedTicket} onClose={() => setSelectedTicket(null)} title="Détails du ticket">
        {selectedTicket && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-[var(--text-secondary)]">ID</span>
                <p className="text-sm font-mono">{selectedTicket.id}</p>
              </div>
              <div>
                <span className="text-xs text-[var(--text-secondary)]">Statut</span>
                <Badge variant={statusVariants[selectedTicket.status]}>{statusLabels[selectedTicket.status]}</Badge>
              </div>
              <div>
                <span className="text-xs text-[var(--text-secondary)]">Catégorie</span>
                <p className="text-sm">{(selectedTicket as any).categoryId ?? '—'}</p>
              </div>
              <div>
                <span className="text-xs text-[var(--text-secondary)]">Créateur</span>
                <p className="text-sm font-mono">{selectedTicket.creatorId.slice(0, 12)}…</p>
              </div>
              {selectedTicket.transcriptId && (
                <div className="col-span-2">
                  <span className="text-xs text-[var(--text-secondary)]">Transcription</span>
                  <p className="text-sm">
                    <a href={selectedTicket.transcriptId} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline">Voir sur Pastebin</a>
                  </p>
                </div>
              )}
              {selectedTicket.closedAt && (
                <div className="col-span-2">
                  <span className="text-xs text-[var(--text-secondary)]">Fermé le</span>
                  <p className="text-sm">{formatDate(selectedTicket.closedAt)}</p>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {actionError && <div className="text-sm text-[var(--error)] bg-[var(--error-bg)] p-2 rounded w-full">{actionError}</div>}
            </div>
            <div className="flex gap-2 mt-2">
              {selectedTicket.status === TicketStatus.OPEN && (
                <Button size="sm" onClick={() => { handleAction(selectedTicket.id, 'claim'); setSelectedTicket(null); }}><UserCheck size={14} /> Prendre en charge</Button>
              )}
              {selectedTicket.status !== TicketStatus.CLOSED && selectedTicket.status !== TicketStatus.DELETED && (
                <Button variant="danger" size="sm" onClick={() => { handleAction(selectedTicket.id, 'close'); setSelectedTicket(null); }}><Lock size={14} /> Fermer</Button>
              )}
              {selectedTicket.status === TicketStatus.CLOSED && (
                <Button size="sm" loading={transcriptLoading === selectedTicket.id} onClick={() => handleTranscript(selectedTicket.id)}><FileText size={14} /> Transcription</Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setSelectedTicket(null)}>Fermer</Button>
            </div>
          </div>
        )}
      </Modal>
      </PermissionGate>
    </motion.div>
  );
}
