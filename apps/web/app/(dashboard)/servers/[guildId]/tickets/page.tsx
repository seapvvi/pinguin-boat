'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Ticket, Plus, MessageSquare, UserCheck, X,
  ChevronLeft, ChevronRight, Send, Lock
} from 'lucide-react';
import { Card, Table, Input, Button, Badge, Modal, Skeleton, EmptyState } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchTickets, api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { TicketData } from '@pinguin/shared';
import type { Column } from '@pinguin/ui';
import { TicketStatus } from '@pinguin/shared';
import { ModuleToggle } from '@/components/ModuleToggle';
import { PermissionGate } from '@/components/PermissionGate';
import { TicketSettingsForm } from '@/components/TicketSettingsForm';

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

export default function TicketsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null);
  const [form, setForm] = useState({ subject: '', description: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTickets(guildId, { page: String(p), limit: '15' });
      if (res.success && res.data) {
        setTickets(res.data.tickets);
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
    if (!form.subject.trim()) errs.subject = 'Requis';
    if (!form.description.trim()) errs.description = 'Requis';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    setActionError(null);
    try {
      await api.post(`/api/guilds/${guildId}/tickets`, form);
      setCreateOpen(false);
      setForm({ subject: '', description: '' });
      load(page);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur lors de la création');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (ticketId: string, action: string) => {
    setActionError(null);
    try {
      await api.put(`/api/guilds/${guildId}/tickets/${ticketId}`, { action });
      load(page);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur lors de l\'action');
    }
  };

  const columns: Column<TicketData>[] = [
    { key: 'subject', label: 'Sujet', render: (t) => <span className="text-sm font-medium">{t.id.slice(0, 8)}…</span> },
    { key: 'category', label: 'Catégorie', render: (t) => <Badge>{(t as TicketData & { categoryId?: string }).categoryId ?? '—'}</Badge> },
    { key: 'status', label: 'Statut', sortable: true, render: (t) => <Badge variant={statusVariants[t.status]}>{statusLabels[t.status]}</Badge> },
    { key: 'creatorId', label: 'Créateur', render: (t) => <span className="font-mono text-xs">{t.creatorId.slice(0, 8)}…</span> },
    { key: 'createdAt', label: 'Date', sortable: true, render: (t) => <span className="text-xs text-[var(--text-secondary)]">{formatDate(t.createdAt)}</span> },
    {
      key: 'actions', label: 'Actions', render: (t) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTicket(t)}><MessageSquare size={12} /></Button>
          {t.status === TicketStatus.OPEN && <Button variant="ghost" size="sm" onClick={() => handleAction(t.id, 'claim')}><UserCheck size={12} /></Button>}
          {t.status !== TicketStatus.CLOSED && <Button variant="ghost" size="sm" onClick={() => handleAction(t.id, 'close')}><Lock size={12} /></Button>}
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
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Tickets</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Gérez les tickets de support.</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus size={14} /> Nouveau ticket</Button>
      </div>

      <PermissionGate permission="manageMessages">
      <div className="mb-4">
        <ModuleToggle guildId={guildId} moduleKey="tickets" label="Tickets" />
      </div>

      <TicketSettingsForm guildId={guildId} />

      <Card padding={false}>
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau ticket">
        <div className="space-y-4">
          <Input label="Sujet" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} error={formErrors.subject} placeholder="Résumé du problème" />
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} error={formErrors.description} placeholder="Détails du ticket" />
          {actionError && <div className="text-sm text-[var(--error)] bg-[var(--error-bg)] p-2 rounded">{actionError}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button loading={submitting} onClick={handleCreate}>Créer</Button>
          </div>
        </div>
      </Modal>

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
                <p className="text-sm">{(selectedTicket as TicketData & { categoryId?: string }).categoryId ?? '—'}</p>
              </div>
              <div>
                <span className="text-xs text-[var(--text-secondary)]">Créateur</span>
                <p className="text-sm font-mono">{selectedTicket.creatorId.slice(0, 12)}…</p>
              </div>
              {selectedTicket.transcriptId && (
                <div className="col-span-2">
                  <span className="text-xs text-[var(--text-secondary)]">Transcription</span>
                  <p className="text-sm">
                    <a href={selectedTicket.transcriptId} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline">
                      Voir sur Pastebin
                    </a>
                  </p>
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
              {selectedTicket.status !== TicketStatus.CLOSED && (
                <Button variant="danger" size="sm" onClick={() => { handleAction(selectedTicket.id, 'close'); setSelectedTicket(null); }}><Lock size={14} /> Fermer</Button>
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
