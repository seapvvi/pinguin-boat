'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  ScrollText, MessageSquare, Users, Shield, Hash,
  Music, Ticket, Activity
} from 'lucide-react';
import { Card, Toggle, Input, Select, Button, Badge, Skeleton } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchGuildSettings, updateGuildSettings } from '@/lib/api';
import type { GuildConfig, LogSettings } from '@pinguin/shared';
import { LogEventType } from '@pinguin/shared';

const eventCategories: { label: string; icon: React.ReactNode; events: { value: LogEventType; label: string }[] }[] = [
  {
    label: 'Messages',
    icon: <MessageSquare size={14} />,
    events: [
      { value: LogEventType.MESSAGE_DELETE, label: 'Suppression de message' },
      { value: LogEventType.MESSAGE_EDIT, label: 'Modification de message' },
    ],
  },
  {
    label: 'Membres',
    icon: <Users size={14} />,
    events: [
      { value: LogEventType.MEMBER_JOIN, label: 'Arrivée d\'un membre' },
      { value: LogEventType.MEMBER_LEAVE, label: 'Départ d\'un membre' },
      { value: LogEventType.MEMBER_BAN, label: 'Bannissement' },
      { value: LogEventType.MEMBER_UNBAN, label: 'Débannissement' },
      { value: LogEventType.MEMBER_KICK, label: 'Expulsion' },
      { value: LogEventType.MEMBER_MUTE, label: 'Silence' },
      { value: LogEventType.MEMBER_UNMUTE, label: 'Désilence' },
      { value: LogEventType.MEMBER_ROLE_ADD, label: 'Ajout de rôle' },
      { value: LogEventType.MEMBER_ROLE_REMOVE, label: 'Retrait de rôle' },
    ],
  },
  {
    label: 'Salons',
    icon: <Hash size={14} />,
    events: [
      { value: LogEventType.CHANNEL_CREATE, label: 'Création de salon' },
      { value: LogEventType.CHANNEL_DELETE, label: 'Suppression de salon' },
      { value: LogEventType.CHANNEL_UPDATE, label: 'Modification de salon' },
    ],
  },
  {
    label: 'Autres',
    icon: <Activity size={14} />,
    events: [
      { value: LogEventType.INVITE_CREATE, label: 'Création d\'invitation' },
      { value: LogEventType.VOICE_STATE_UPDATE, label: 'État vocal' },
      { value: LogEventType.TICKET_CREATE, label: 'Création de ticket' },
      { value: LogEventType.TICKET_CLOSE, label: 'Fermeture de ticket' },
      { value: LogEventType.AUTOMOD_ACTION, label: 'Action d\'automodération' },
    ],
  },
];

export default function LogsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [config, setConfig] = useState<GuildConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [local, setLocal] = useState<LogSettings | null>(null);
  const [ignoreChannelsInput, setIgnoreChannelsInput] = useState('');
  const [ignoreRolesInput, setIgnoreRolesInput] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchGuildSettings(guildId);
      if (res.success && res.data) {
        setConfig(res.data.guild);
        setLocal({ ...res.data.guild.logs });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);

  const toggleEvent = (event: LogEventType) => {
    if (!local) return;
    const enabledEvents = local.enabledEvents ?? [];
    const enabled = enabledEvents.includes(event);
    setLocal({
      ...local,
      enabledEvents: enabled
        ? enabledEvents.filter((e) => e !== event)
        : [...enabledEvents, event],
    });
  };

  const addIgnoreChannel = () => {
    if (!local || !ignoreChannelsInput.trim()) return;
    setLocal({ ...local, ignoreChannels: [...(local.ignoreChannels ?? []), ignoreChannelsInput.trim()] });
    setIgnoreChannelsInput('');
  };

  const addIgnoreRole = () => {
    if (!local || !ignoreRolesInput.trim()) return;
    setLocal({ ...local, ignoreUsers: [...(local.ignoreUsers ?? []), ignoreRolesInput.trim()] });
    setIgnoreRolesInput('');
  };

  const removeIgnoreChannel = (id: string) => {
    if (!local) return;
    setLocal({ ...local, ignoreChannels: (local.ignoreChannels ?? []).filter((c) => c !== id) });
  };

  const removeIgnoreRole = (id: string) => {
    if (!local) return;
    setLocal({ ...local, ignoreUsers: (local.ignoreUsers ?? []).filter((u) => u !== id) });
  };

  const handleSave = async () => {
    if (!local) return;
    setSaving(true);
    try {
      const res = await updateGuildSettings(guildId, { logs: local });
      if (res.success && res.data) setConfig(res.data.guild);
    } catch { /* ignore */ } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </motion.div>
    );
  }

  if (loading || !local) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-[var(--radius)]" />
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Logs</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Configurez les événements à journaliser.</p>
        </div>
        <Button loading={saving} onClick={handleSave}>Enregistrer</Button>
      </div>

      <div className="space-y-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ScrollText size={18} className="text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Module de logs</h2>
            </div>
            <Toggle checked={local.enabled} onChange={(v) => setLocal({ ...local, enabled: v })} />
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Salon de logs</h2>
          <Input
            placeholder="ID du salon (ex: 123456789)"
            value={local.logChannelId ?? ''}
            onChange={(e) => setLocal({ ...local, logChannelId: e.target.value || null })}
          />
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Événements journalisés</h2>
          <div className="space-y-4">
            {eventCategories.map((cat) => (
              <div key={cat.label}>
                <div className="flex items-center gap-2 mb-2">
                  {cat.icon}
                  <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">{cat.label}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {cat.events.map((evt) => (
                    <label key={evt.value} className="flex items-center gap-2 p-2 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)] cursor-pointer hover:bg-[var(--bg-surface)] transition-colors">
                      <input
                        type="checkbox"
                        checked={(local.enabledEvents ?? []).includes(evt.value)}
                        onChange={() => toggleEvent(evt.value)}
                        className="accent-[var(--accent)]"
                      />
                      <span className="text-sm text-[var(--text-primary)]">{evt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Salons ignorés</h2>
          <div className="flex gap-2 mb-3">
            <Input placeholder="ID du salon" value={ignoreChannelsInput} onChange={(e) => setIgnoreChannelsInput(e.target.value)} className="flex-1" />
            <Button variant="secondary" size="sm" onClick={addIgnoreChannel}>Ajouter</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(local.ignoreChannels ?? []).map((id) => (
              <span key={id} onClick={() => removeIgnoreChannel(id)} className="cursor-pointer inline-flex">
                <Badge variant="default">
                  {id.slice(0, 8)}… <span className="ml-1">×</span>
                </Badge>
              </span>
            ))}
            {(local.ignoreChannels ?? []).length === 0 && (
              <span className="text-xs text-[var(--text-secondary)]">Aucun salon ignoré</span>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Utilisateurs ignorés</h2>
          <div className="flex gap-2 mb-3">
            <Input placeholder="ID de l'utilisateur" value={ignoreRolesInput} onChange={(e) => setIgnoreRolesInput(e.target.value)} className="flex-1" />
            <Button variant="secondary" size="sm" onClick={addIgnoreRole}>Ajouter</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(local.ignoreUsers ?? []).map((id) => (
              <span key={id} onClick={() => removeIgnoreRole(id)} className="cursor-pointer inline-flex">
                <Badge variant="default">
                  {id.slice(0, 8)}… <span className="ml-1">×</span>
                </Badge>
              </span>
            ))}
            {(local.ignoreUsers ?? []).length === 0 && (
              <span className="text-xs text-[var(--text-secondary)]">Aucun utilisateur ignoré</span>
            )}
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
