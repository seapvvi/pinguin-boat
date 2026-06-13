'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Lightbulb, ThumbsUp, ThumbsDown, Check, X,
  ChevronLeft, ChevronRight, MessageSquare, Send, Trash2,
  Settings, BarChart
} from 'lucide-react';
import { Table, Input, Button, Badge, Modal, Skeleton, EmptyState } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchSuggestions, api } from '@/lib/api';
import type { Suggestion } from '@pinguin/shared';
import type { Column } from '@pinguin/ui';
import { ModuleToggle } from '@/components/ModuleToggle';
import { DiscordSelect } from '@/components/DiscordSelect';
import { SkeletonPage } from '@/components/layout/SkeletonPage';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionCard } from '@/components/layout/SectionCard';
import { ModuleGrid } from '@/components/layout/ModuleGrid';

const statusLabels: Record<string, string> = {
  PENDING: 'En attente',
  APPROVED: 'Approuvée',
  REJECTED: 'Rejetée',
  IMPLEMENTED: 'Implémentée',
};

const statusVariants: Record<string, 'warning' | 'success' | 'error' | 'info'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  IMPLEMENTED: 'info',
};

export default function SuggestionsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [staffResponse, setStaffResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sendContent, setSendContent] = useState('');
  const [sendChannelId, setSendChannelId] = useState('');
  const [sending, setSending] = useState(false);

  const load = async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSuggestions(guildId, { page: String(p), limit: '15' });
      const payload = (res as { data?: { suggestions?: Suggestion[]; pagination?: { totalPages?: number } } })?.data;
      if (payload) {
        setSuggestions(payload.suggestions ?? []);
        setTotalPages(payload.pagination?.totalPages ?? 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(page); }, [guildId, page]);

  useEffect(() => {
    const interval = setInterval(() => load(page), 10000);
    return () => clearInterval(interval);
  }, [guildId, page]);

  const handleSend = async () => {
    if (!sendContent.trim() || !sendChannelId) return;
    setSending(true);
    try {
      await api.post(`/api/guilds/${guildId}/suggestions/send`, {
        content: sendContent.trim(),
        channelId: sendChannelId,
      });
      setSendContent('');
      load(page);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur envoi');
    } finally {
      setSending(false);
    }
  };

  const handleVote = async (suggestionId: string, vote: 'up' | 'down') => {
    setVotingId(suggestionId);
    setActionError(null);
    try {
      await api.post(`/api/guilds/${guildId}/suggestions/${suggestionId}/vote`, { vote });
      load(page);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur lors du vote');
    } finally {
      setVotingId(null);
    }
  };

  const handleAction = async (suggestionId: string, action: 'APPROVED' | 'REJECTED' | 'IMPLEMENTED') => {
    if (!staffResponse.trim()) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await api.post(`/api/guilds/${guildId}/suggestions/${suggestionId}/respond`, { action, response: staffResponse.trim() });
      setSelectedSuggestion(null);
      setStaffResponse('');
      load(page);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur lors de la réponse');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteSuggestion = async (suggestionId: string) => {
    if (!confirm('Supprimer cette suggestion ?')) return;
    setActionError(null);
    try {
      await api.delete(`/api/guilds/${guildId}/suggestions/${suggestionId}`);
      load(page);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur lors de la suppression');
    }
  };

  const stats = {
    total: suggestions.length,
    pending: suggestions.filter((s) => s.status === 'PENDING').length,
    approved: suggestions.filter((s) => s.status === 'APPROVED' || s.status === 'IMPLEMENTED').length,
    rejected: suggestions.filter((s) => s.status === 'REJECTED').length,
  };

  const columns: Column<Suggestion>[] = [
    { key: 'content', label: 'Suggestion', render: (s) => <span className="text-sm truncate max-w-[250px] block">{s.content}</span> },
    { key: 'authorId', label: 'Auteur', render: (s) => <span className="font-mono text-xs">{s.authorId.slice(0, 8)}…</span> },
    { key: 'votes', label: 'Votes', render: (s) => (
      <div className="flex items-center gap-2">
        <button onClick={() => handleVote(s.id, 'up')} disabled={votingId === s.id} className="flex items-center gap-0.5 text-xs text-[var(--success)] hover:opacity-80 transition-opacity disabled:opacity-40">
          <ThumbsUp size={12} />{s.votes?.up ?? 0}
        </button>
        <button onClick={() => handleVote(s.id, 'down')} disabled={votingId === s.id} className="flex items-center gap-0.5 text-xs text-[var(--error)] hover:opacity-80 transition-opacity disabled:opacity-40">
          <ThumbsDown size={12} />{s.votes?.down ?? 0}
        </button>
      </div>
    )},
    { key: 'status', label: 'Statut', sortable: true, render: (s) => <Badge variant={statusVariants[s.status]}>{statusLabels[s.status]}</Badge> },
    {
      key: 'actions', label: 'Actions', render: (s) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedSuggestion(s); setStaffResponse(''); }}><MessageSquare size={12} /> Répondre</Button>
          <Button variant="ghost" size="sm" onClick={() => deleteSuggestion(s.id)}><Trash2 size={12} /></Button>
        </div>
      ),
    },
  ];

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <ErrorMessage title="Erreur" message={error} onRetry={() => load(page)} />
      </motion.div>
    );
  }

  if (loading) {
    return <SkeletonPage rows={1} />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <PageLayout
        title="Suggestions"
        description="Gérez les suggestions des membres."
      >
        <div className="mb-4">
          <ModuleToggle guildId={guildId} moduleKey="suggestions" label="Suggestions" />
        </div>

        <ModuleGrid>
          <SectionCard title="Configuration" icon={<Settings size={16} />}>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">Envoyer une suggestion</label>
                <textarea
                  value={sendContent}
                  onChange={(e) => setSendContent(e.target.value)}
                  placeholder="Votre suggestion..."
                  className="w-full px-3 py-2 text-sm border border-[var(--border-color)] bg-transparent min-h-[80px]"
                />
              </div>
              <DiscordSelect type="channel" guildId={guildId} label="Salon" value={sendChannelId} onChange={setSendChannelId} />
              <Button loading={sending} onClick={handleSend} disabled={!sendContent.trim() || !sendChannelId}>
                <Send size={14} className="mr-1" /> Envoyer sur Discord
              </Button>
            </div>
          </SectionCard>

          <SectionCard title="Statistiques" icon={<BarChart size={16} />}>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[var(--bg-surface-alt)] text-center">
                <div className="text-2xl font-bold text-[var(--text-primary)]">{stats.total}</div>
                <div className="text-xs text-[var(--text-secondary)] tracking-wide uppercase mt-1">Total</div>
              </div>
              <div className="p-3 bg-[var(--bg-surface-alt)] text-center">
                <div className="text-2xl font-bold text-[var(--warning)]">{stats.pending}</div>
                <div className="text-xs text-[var(--text-secondary)] tracking-wide uppercase mt-1">En attente</div>
              </div>
              <div className="p-3 bg-[var(--bg-surface-alt)] text-center">
                <div className="text-2xl font-bold text-[var(--success)]">{stats.approved}</div>
                <div className="text-xs text-[var(--text-secondary)] tracking-wide uppercase mt-1">Approuvées</div>
              </div>
              <div className="p-3 bg-[var(--bg-surface-alt)] text-center">
                <div className="text-2xl font-bold text-[var(--error)]">{stats.rejected}</div>
                <div className="text-xs text-[var(--text-secondary)] tracking-wide uppercase mt-1">Refusées</div>
              </div>
            </div>
          </SectionCard>
        </ModuleGrid>

          <SectionCard title="Suggestions récentes" icon={<Lightbulb size={16} />}>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : suggestions.length === 0 ? (
              <EmptyState title="Aucune suggestion" description="Aucune suggestion pour le moment." icon={<Lightbulb size={32} />} />
            ) : (
              <>
                <Table columns={columns} data={suggestions} keyExtractor={(s) => s.id} />
                <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)] mt-3">
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
          </SectionCard>
      </PageLayout>

      <Modal open={!!selectedSuggestion} onClose={() => setSelectedSuggestion(null)} title="Réponse à la suggestion">
        {selectedSuggestion && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-primary)] bg-[var(--bg-surface-alt)] p-3">
              {selectedSuggestion.content}
            </p>
            <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
              <span className="flex items-center gap-1"><ThumbsUp size={12} /> {selectedSuggestion.votes.up}</span>
              <span className="flex items-center gap-1"><ThumbsDown size={12} /> {selectedSuggestion.votes.down}</span>
              <Badge variant={statusVariants[selectedSuggestion.status]}>{statusLabels[selectedSuggestion.status]}</Badge>
            </div>
            {selectedSuggestion.staffResponse && (
              <div className="p-3 bg-[var(--bg-surface-alt)]">
                <span className="text-xs text-[var(--text-secondary)]">Réponse du staff:</span>
                <p className="text-sm text-[var(--text-primary)] mt-1">{selectedSuggestion.staffResponse.response}</p>
              </div>
            )}
            <Input label="Votre réponse" value={staffResponse} onChange={(e) => setStaffResponse(e.target.value)} placeholder="Réponse du staff" />
            {actionError && <div className="text-sm text-[var(--error)] bg-[var(--error-bg)] p-2">{actionError}</div>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setSelectedSuggestion(null)}>Annuler</Button>
              <Button variant="success" disabled={!staffResponse.trim() || submitting} onClick={() => handleAction(selectedSuggestion.id, 'APPROVED')} loading={submitting}>
                <Check size={14} /> Approuver
              </Button>
              <Button variant="danger" disabled={!staffResponse.trim() || submitting} onClick={() => handleAction(selectedSuggestion.id, 'REJECTED')} loading={submitting}>
                <X size={14} /> Rejeter
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
