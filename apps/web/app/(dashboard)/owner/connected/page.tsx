'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { Users, RefreshCw, LogOut, Megaphone, Clock, Send, X } from 'lucide-react';
import { Card, Button, Badge, Skeleton, EmptyState, Input, Modal } from '@pinguin/ui';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface ActiveSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  user: {
    id: string;
    username: string;
    discordId: string;
    avatar: string | null;
  };
}

export default function ConnectedUsersPage() {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [kicking, setKicking] = useState<string | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [targetSession, setTargetSession] = useState<ActiveSession | null>(null);
  const [popupMessage, setPopupMessage] = useState('');
  const [popupDuration, setPopupDuration] = useState('5');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/api/owner/sessions');
      setSessions((res as any)?.data?.sessions ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const handleKick = async (sessionId: string) => {
    setKicking(sessionId);
    try {
      await api.delete(`/api/owner/sessions/${sessionId}`);
      await load();
    } finally {
      setKicking(null);
    }
  };

  const handleBroadcast = async () => {
    if (!popupMessage.trim()) return;
    setSending(true);
    try {
      await api.post('/api/owner/broadcast-popup', {
        message: popupMessage.trim(),
        duration: parseInt(popupDuration) || 5,
        targetUserId: targetSession?.user.id ?? undefined,
      });
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setBroadcastOpen(false);
        setPopupMessage('');
        setTargetSession(null);
      }, 1500);
    } finally {
      setSending(false);
    }
  };

  const avatarUrl = (u: ActiveSession['user']) =>
    u.avatar
      ? `https://cdn.discordapp.com/avatars/${u.discordId}/${u.avatar}.png?size=32`
      : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Utilisateurs connectés</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Sessions actives en temps réel. Refresh automatique toutes les 15s.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={load}><RefreshCw size={14} /> Rafraîchir</Button>
          <Button size="sm" onClick={() => { setTargetSession(null); setBroadcastOpen(true); }}>
            <Megaphone size={14} /> Popup à tous
          </Button>
        </div>
      </div>

      <Card className="p-3 mb-4 flex items-center gap-3 bg-[var(--bg-surface-alt)]">
        <Users size={16} className="text-[var(--accent)]" />
        <span className="text-sm text-[var(--text-primary)] font-medium">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''} active{sessions.length !== 1 ? 's' : ''}
        </span>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-[var(--radius-sm)]" />)}
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState title="Aucune session active" description="Aucun utilisateur connecté en ce moment." />
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] border border-[var(--border-color)] bg-[var(--bg-surface)]">
              <div className="flex items-center gap-3">
                <div className="relative">
                  {avatarUrl(s.user) ? (
                    <img src={avatarUrl(s.user)!} alt="" className="w-9 h-9 rounded-full" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[var(--bg-surface-alt)] flex items-center justify-center text-sm font-bold text-[var(--text-secondary)]">
                      {s.user.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--success)] border-2 border-[var(--bg-surface)]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{s.user.username}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <code className="text-xs text-[var(--text-secondary)]">{s.user.discordId}</code>
                    <span className="text-[var(--border-color)]">·</span>
                    <Clock size={10} className="text-[var(--text-secondary)]" />
                    <span className="text-xs text-[var(--text-secondary)]">
                      Connecté {formatDate(s.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setTargetSession(s); setBroadcastOpen(true); }}
                  title="Envoyer un popup"
                >
                  <Send size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={kicking === s.id}
                  onClick={() => handleKick(s.id)}
                  title="Déconnecter"
                >
                  <LogOut size={13} className="text-[var(--error)]" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={broadcastOpen}
        onClose={() => { setBroadcastOpen(false); setPopupMessage(''); setTargetSession(null); }}
        title={targetSession ? `Popup pour ${targetSession.user.username}` : 'Popup à tous les connectés'}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            {targetSession
              ? `Ce popup sera envoyé uniquement à ${targetSession.user.username}. Il ne pourra pas le fermer pendant la durée définie.`
              : 'Ce popup sera envoyé à tous les utilisateurs connectés. Ils ne pourront pas le fermer pendant la durée définie.'}
          </p>
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">
              Message
            </label>
            <textarea
              value={popupMessage}
              onChange={(e) => setPopupMessage(e.target.value)}
              placeholder="Message important à afficher..."
              className="w-full px-3 py-2 text-sm text-[var(--text-primary)] bg-[var(--bg-surface-alt)] border border-[var(--border-color)] rounded-[var(--radius-sm)] outline-none focus:border-[var(--accent)] transition-colors resize-none h-24"
            />
          </div>
          <Input
            label="Durée non-skippable (secondes, min 3)"
            type="number"
            value={popupDuration}
            onChange={(e) => setPopupDuration(e.target.value)}
          />
          {sent && (
            <p className="text-sm text-[var(--success)] flex items-center gap-1">
              <span>✓</span> Popup envoyé avec succès.
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" size="sm" onClick={() => setBroadcastOpen(false)}>Annuler</Button>
            <Button
              size="sm"
              loading={sending}
              disabled={!popupMessage.trim()}
              onClick={handleBroadcast}
            >
              <Send size={14} /> Envoyer
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
