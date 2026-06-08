'use client';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  MessageSquare, Send, Globe, Server, History,
  CheckCircle, XCircle, AlertTriangle, Megaphone
} from 'lucide-react';
import {
  Card, Button, Badge, Skeleton, EmptyState, ErrorMessage,
  Modal, Input, Select
} from '@pinguin/ui';
import { sendAnnouncement, fetchAnnouncements } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { Announcement } from '@pinguin/shared';

export default function OwnerAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [formMessage, setFormMessage] = useState('');
  const [formTarget, setFormTarget] = useState<'ALL' | 'GUILD'>('ALL');
  const [formGuildId, setFormGuildId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAnnouncements({ limit: '50' });
      if (res.success && res.data) setAnnouncements(res.data.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSend = async () => {
    if (!formMessage.trim()) return;
    setActionLoading(true);
    try {
      await sendAnnouncement(formMessage.trim(), formTarget, formTarget === 'GUILD' ? formGuildId.trim() : undefined);
      setShowCreate(false);
      setFormMessage('');
      setFormGuildId('');
      load();
    } catch { /* ignore */ } finally { setActionLoading(false); }
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Annonces globales</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Envoyez des annonces via le bot Discord.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}><Megaphone size={14} /> Nouvelle annonce</Button>
      </div>

      <Card className="mb-6">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Créer une annonce</h2>
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase">Message</label>
            <textarea
              value={formMessage}
              onChange={(e) => setFormMessage(e.target.value)}
              placeholder="Contenu de l'annonce..."
              rows={4}
              className="w-full px-3 py-2 text-sm text-[var(--text-primary)] bg-[var(--bg-surface-alt)] border border-[var(--border-color)] rounded-[var(--radius-sm)] outline-none focus:border-[var(--accent)] transition-colors resize-none placeholder:text-[var(--text-secondary)]"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Cible" options={[
              { value: 'ALL', label: 'Tous les serveurs' },
              { value: 'GUILD', label: 'Serveur spécifique' },
            ]} value={formTarget} onChange={(e) => setFormTarget(e.target.value as 'ALL' | 'GUILD')} />
            {formTarget === 'GUILD' && (
              <Input label="ID du serveur" placeholder="Entrez l'ID du serveur..." value={formGuildId} onChange={(e) => setFormGuildId(e.target.value)} />
            )}
          </div>
          <div className="flex justify-end">
            <Button size="sm" loading={actionLoading} disabled={!formMessage.trim() || (formTarget === 'GUILD' && !formGuildId.trim())} onClick={handleSend}>
              <Send size={14} /> Envoyer l'annonce
            </Button>
          </div>
        </div>
      </Card>

      <Card padding={false}>
        <div className="px-5 py-3 border-b border-[var(--border-color)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Historique des annonces</h2>
        </div>
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-[var(--radius-sm)]" />)}
          </div>
        ) : announcements.length === 0 ? (
          <EmptyState icon={<MessageSquare size={24} />} title="Aucune annonce" description="Aucune annonce envoyée pour le moment." />
        ) : (
          <div className="divide-y divide-[var(--border-color)]">
            {announcements.map((a) => (
              <div key={a.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)]">{a.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-secondary)]">
                      <span className="flex items-center gap-1">
                        {a.targetType === 'ALL' ? <Globe size={11} /> : <Server size={11} />}
                        {a.targetType === 'ALL' ? 'Global' : `Serveur ${a.guildId?.slice(0, 8)}...`}
                      </span>
                      <span>{formatDate(a.createdAt)}</span>
                      <span>par {a.sentBy}</span>
                    </div>
                  </div>
                  <Badge variant={a.status === 'SENT' ? 'success' : a.status === 'PENDING' ? 'warning' : 'error'}>
                    {a.status === 'SENT' ? 'Envoyé' : a.status === 'PENDING' ? 'En attente' : 'Échoué'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
