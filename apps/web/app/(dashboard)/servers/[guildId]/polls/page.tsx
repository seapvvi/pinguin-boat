'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Vote, Plus, BarChart3, X, Plus as PlusIcon,
  ChevronLeft, ChevronRight, Trash2
} from 'lucide-react';
import { Card, Table, Input, Button, Badge, Modal, Skeleton, EmptyState } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchPolls, api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Poll } from '@pinguin/shared';
import type { Column } from '@pinguin/ui';
import { ModuleToggle } from '@/components/ModuleToggle';

export default function PollsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [form, setForm] = useState({ question: '', options: ['', ''], duration: 300 });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPolls(guildId, { page: String(p), limit: '15' });
      if (res.success && res.data) {
        setPolls(res.data.polls);
        setTotalPages(res.data.pagination.totalPages);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(page); }, [guildId, page]);

  const handleCreate = async () => {
    const errs: Record<string, string> = {};
    if (!form.question.trim()) errs.question = 'Requis';
    const validOptions = form.options.filter((o) => o.trim());
    if (validOptions.length < 2) errs.options = 'Au moins 2 options';
    if (validOptions.length > 9) errs.options = 'Maximum 9 options';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      await api.post(`/api/guilds/${guildId}/polls`, {
        question: form.question.trim(),
        options: validOptions,
      });
      setCreateOpen(false);
      setForm({ question: '', options: ['', ''], duration: 300 });
      load(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la création');
    } finally {
      setSubmitting(false);
    }
  };

  const addOption = () => {
    if (form.options.length >= 9) return;
    setForm({ ...form, options: [...form.options, ''] });
  };

  const removeOption = (index: number) => {
    if (form.options.length <= 2) return;
    setForm({ ...form, options: form.options.filter((_, i) => i !== index) });
  };

  const closePoll = async (pollId: string) => {
    try {
      await api.put(`/api/guilds/${guildId}/polls/${pollId}`, { status: 'CLOSED' });
      load(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la fermeture');
    }
  };

  const deletePoll = async (pollId: string) => {
    if (!confirm('Supprimer ce sondage ?')) return;
    try {
      await api.delete(`/api/guilds/${guildId}/polls/${pollId}`);
      load(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la suppression');
    }
  };

  const totalVotes = (poll: Poll) => Object.keys(poll.votes).length;

  const columns: Column<Poll>[] = [
    { key: 'question', label: 'Question', sortable: true, render: (p) => <span className="text-sm truncate max-w-[200px] block">{p.question}</span> },
    { key: 'options', label: 'Options', render: (p) => <span className="text-xs">{p.options.length}</span> },
    { key: 'votes', label: 'Votes', render: (p) => <span className="text-xs">{totalVotes(p)}</span> },
    { key: 'status', label: 'Statut', sortable: true, render: (p) => (
      <Badge variant={p.status === 'ACTIVE' ? 'success' : p.status === 'CLOSED' ? 'error' : 'default'}>
        {p.status === 'ACTIVE' ? 'Actif' : p.status === 'CLOSED' ? 'Fermé' : 'Supprimé'}
      </Badge>
    )},
    {
      key: 'actions', label: 'Actions', render: (p) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setSelectedPoll(p)}><BarChart3 size={12} /></Button>
          {p.status === 'ACTIVE' && <Button variant="ghost" size="sm" onClick={() => closePoll(p.id)}><X size={12} /></Button>}
          <Button variant="ghost" size="sm" onClick={() => deletePoll(p.id)}><Trash2 size={12} /></Button>
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Sondages</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Créez et gérez des sondages.</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus size={14} /> Nouveau sondage</Button>
      </div>

      <div className="mb-4"><ModuleToggle guildId={guildId} moduleKey="polls" label="Sondages" /></div>

      <Card padding={false}>
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : polls.length === 0 ? (
          <EmptyState title="Aucun sondage" description="Créez votre premier sondage." icon={<Vote size={32} />} />
        ) : (
          <>
            <Table columns={columns} data={polls} keyExtractor={(p) => p.id} />
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau sondage">
        <div className="space-y-4">
          <Input label="Question" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} error={formErrors.question} placeholder="Votre question" />
          <Input label="Durée (secondes)" type="number" value={String(form.duration)} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} />
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Options</span>
              {form.options.length < 9 && (
                <Button variant="ghost" size="sm" onClick={addOption}><PlusIcon size={12} /> Ajouter</Button>
              )}
            </div>
            {formErrors.options && <span className="text-xs text-[var(--error)] mb-2 block">{formErrors.options}</span>}
            <div className="space-y-2">
              {form.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={opt} onChange={(e) => {
                    const opts = [...form.options];
                    opts[i] = e.target.value;
                    setForm({ ...form, options: opts });
                  }} placeholder={`Option ${i + 1}`} className="flex-1" />
                  {form.options.length > 2 && (
                    <button onClick={() => removeOption(i)} className="text-[var(--text-secondary)] hover:text-[var(--error)] transition-colors">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button loading={submitting} onClick={handleCreate}>Créer</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!selectedPoll} onClose={() => setSelectedPoll(null)} title="Résultats du sondage">
        {selectedPoll && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{selectedPoll.question}</h3>
            <p className="text-xs text-[var(--text-secondary)]">Total: {totalVotes(selectedPoll)} votes</p>
            <div className="space-y-3">
              {selectedPoll.options.map((opt) => {
                const count = opt.votes;
                const pct = totalVotes(selectedPoll) > 0 ? Math.round((count / totalVotes(selectedPoll)) * 100) : 0;
                return (
                  <div key={opt.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-[var(--text-primary)]">{opt.label}</span>
                      <span className="text-xs text-[var(--text-secondary)]">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 rounded-[0px] bg-[var(--bg-surface-alt)] overflow-hidden">
                      <div className="h-full bg-[var(--accent)] rounded-[0px] transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              {selectedPoll.status === 'ACTIVE' && (
                <Button variant="danger" size="sm" onClick={() => { closePoll(selectedPoll.id); setSelectedPoll(null); }}>Fermer le sondage</Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setSelectedPoll(null)}>Fermer</Button>
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
