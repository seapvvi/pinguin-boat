'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Vote, BarChart3, X, Plus as PlusIcon,
  Trash2, CheckCircle, Clock
} from 'lucide-react';
import { Input, Button, Badge, Modal, Skeleton, EmptyState, Select } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchPolls, fetchGuildChannels, api } from '@/lib/api';
import type { Poll } from '@pinguin/shared';
import { ModuleToggle } from '@/components/ModuleToggle';
import { useBackgroundRefresh } from '@/lib/hooks';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionCard } from '@/components/layout/SectionCard';

const OPTION_COLORS = ['#5865f2', '#ed4245', '#57f287', '#fee75c', '#eb459e', '#00b0f4', '#95e5d7', '#ff73fa', '#faa61a'];

export default function PollsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page] = useState(1);
  const [, setTotalPages] = useState(1);
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [form, setForm] = useState({ question: '', options: ['', ''], duration: 300, channelId: '' });
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = async (p: number, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetchPolls(guildId, { page: String(p), limit: '15' });
      if (res.success && res.data) {
        setPolls(res.data.polls);
        setTotalPages(res.data.pagination.totalPages);
      }
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { load(page); }, [guildId, page]);
  useBackgroundRefresh((silent) => load(page, silent), 8000, [guildId, page]);

  useEffect(() => {
    let cancelled = false;
    fetchGuildChannels(guildId).then((res) => {
      if (!res.success || !res.data || cancelled) return;
      const availableChannels = res.data.channels
        .filter((c) => c.type === 0)
        .map((c) => ({ id: String(c.id), name: String(c.name) })) as { id: string; name: string }[];
      setChannels(availableChannels);
      setForm((prev) => {
        const hasCurrent = availableChannels.some((c) => c.id === prev.channelId);
        const nextChannelId = hasCurrent ? prev.channelId : (availableChannels[0]?.id ?? '');
        return nextChannelId === prev.channelId ? prev : { ...prev, channelId: nextChannelId };
      });
      setFormErrors((prev) => {
        if (!prev.channelId) return prev;
        return Object.fromEntries(
          Object.entries(prev).filter(([k]) => k !== 'channelId')
        );
      });
    }).catch(() => {
      if (!cancelled) setChannels([]);
    });
    return () => { cancelled = true; };
  }, [guildId]);

  const handleCreate = async () => {
    const errs: Record<string, string> = {};
    if (!form.question.trim()) errs.question = 'Requis';
    const validOptions = form.options.filter((o) => o.trim());
    if (validOptions.length < 2) errs.options = 'Au moins 2 options';
    if (validOptions.length > 9) errs.options = 'Maximum 9 options';
    if (!form.channelId) errs.channelId = 'Salon requis';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      await api.post(`/api/guilds/${guildId}/polls`, {
        question: form.question.trim(),
        options: validOptions,
        channelId: form.channelId,
      });
      setForm({ question: '', options: ['', ''], duration: 300, channelId: '' });
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

  const activePolls = polls.filter((p) => p.status === 'ACTIVE');
  const endedPolls = polls.filter((p) => p.status === 'CLOSED' || p.status !== 'ACTIVE');

  const totalVotesForOption = (poll: Poll, optionId: string) => {
    return Object.values(poll.votes).filter((v) => v === optionId).length;
  };

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <ErrorMessage title="Erreur" message={error} onRetry={() => load(page)} />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <PageLayout
        title="Sondages"
        description="Créez et gérez des sondages."
      >
        <div className="mb-4"><ModuleToggle guildId={guildId} moduleKey="polls" label="Sondages" /></div>

        <SectionCard title="Créer un sondage" icon={<PlusIcon size={16} />}>
          <div className="space-y-4">
            <Input label="Question" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} error={formErrors.question} placeholder="Votre question" />
            <Select
              label="Salon Discord"
              options={channels.map((c) => ({ value: c.id, label: `#${c.name}` }))}
              value={form.channelId}
              onChange={(e) => setForm({ ...form, channelId: e.target.value })}
            />
            {formErrors.channelId && <span className="text-xs text-[var(--error)]">{formErrors.channelId}</span>}
            <Input label="Durée (secondes)" type="number" value={String(form.duration)} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} />
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase">Options</span>
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
              <Button loading={submitting} onClick={handleCreate}>Créer le sondage</Button>
            </div>
          </div>
        </SectionCard>

          <SectionCard title="Sondages actifs" icon={<Clock size={16} />}>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : activePolls.length === 0 ? (
              <EmptyState title="Aucun sondage actif" description="Créez votre premier sondage." icon={<Vote size={32} />} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activePolls.map((poll) => {
                  const tv = totalVotes(poll);
                  return (
                    <div key={poll.id} className="p-4 bg-[var(--bg-surface-alt)]">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{poll.question}</h3>
                        <Badge variant="success">Actif</Badge>
                      </div>
                      <div className="space-y-2 mb-3">
                        {poll.options.map((opt, oi) => {
                          const count = totalVotesForOption(poll, opt.id);
                          const pct = tv > 0 ? Math.round((count / tv) * 100) : 0;
                          return (
                            <div key={opt.id}>
                              <div className="flex items-center justify-between text-xs mb-0.5">
                                <span className="text-[var(--text-primary)]">{opt.label}</span>
                                <span className="text-[var(--text-secondary)]">{count} ({pct}%)</span>
                              </div>
                              <div className="h-1.5 bg-[var(--bg-surface)]">
                                <div
                                  className="h-full transition-all duration-300"
                                  style={{ width: `${pct}%`, backgroundColor: OPTION_COLORS[oi % OPTION_COLORS.length] }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--text-secondary)]">{tv} vote(s)</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedPoll(poll)}><BarChart3 size={12} /></Button>
                          <Button variant="ghost" size="sm" onClick={() => closePoll(poll.id)}><X size={12} /></Button>
                          <Button variant="ghost" size="sm" onClick={() => deletePoll(poll.id)}><Trash2 size={12} /></Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Sondages terminés" icon={<CheckCircle size={16} />}>
            {endedPolls.length === 0 ? (
              <span className="text-xs text-[var(--text-secondary)]">Aucun sondage terminé.</span>
            ) : (
              <div className="space-y-2">
                {endedPolls.map((poll) => {
                  const tv = totalVotes(poll);
                  return (
                    <div key={poll.id} className="flex items-center justify-between p-3 bg-[var(--bg-surface-alt)]">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-sm truncate text-[var(--text-primary)]">{poll.question}</span>
                        <Badge variant={poll.status === 'CLOSED' ? 'error' : 'default'}>
                          {poll.status === 'CLOSED' ? 'Fermé' : 'Supprimé'}
                        </Badge>
                        <span className="text-xs text-[var(--text-secondary)]">{tv} vote(s)</span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedPoll(poll)}><BarChart3 size={12} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => deletePoll(poll.id)}><Trash2 size={12} /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
      </PageLayout>

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
                    <div className="h-2 bg-[var(--bg-surface-alt)]">
                      <div className="h-full bg-[var(--accent)] transition-all duration-300" style={{ width: `${pct}%` }} />
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
