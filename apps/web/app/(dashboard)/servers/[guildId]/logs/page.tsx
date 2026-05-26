'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  ScrollText, MessageSquare, Users, Hash, Activity
} from 'lucide-react';
import { Card, Toggle, Input, Button, Skeleton } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { api } from '@/lib/api';
import type { LogSettings } from '@pinguin/shared';
import { LogEventType } from '@pinguin/shared';
import { ModuleToggle } from '@/components/ModuleToggle';
import { DiscordSelect } from '@/components/DiscordSelect';
import { useAutoRefresh, useAutoSave } from '@/lib/hooks';

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

const defaultLogs: LogSettings = {
  enabled: true,
  logChannelId: null,
  enabledEvents: [],
  ignoreChannels: [],
  ignoreUsers: [],
};

export default function LogsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [local, setLocal] = useState<LogSettings | null>(null);
  const [ignoreChannelsInput, setIgnoreChannelsInput] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<{ data: LogSettings & { enabledEvents?: LogEventType[] } }>(`/api/guilds/${guildId}/logs`);
      if (res.success && res.data) {
        const d = res.data as any;
        setLocal({
          enabled: d.enabled ?? true,
          logChannelId: d.logChannelId ?? null,
          enabledEvents: d.enabledEvents ?? d.events ?? [],
          ignoreChannels: d.ignoreChannels ?? d.ignoredChannels ?? [],
          ignoreUsers: d.ignoreUsers ?? d.ignoredRoles ?? [],
        });
      } else {
        setLocal({ ...defaultLogs });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load, 10000, [guildId]);

  const saveLogs = useCallback(async (data: LogSettings) => {
    await api.put(`/api/guilds/${guildId}/logs`, {
      logChannelId: data.logChannelId,
      enabledEvents: data.enabledEvents,
      ignoreChannels: data.ignoreChannels,
      ignoreUsers: data.ignoreUsers,
    });
  }, [guildId]);

  useAutoSave(local, saveLogs, { intervalMs: 10000, enabled: !!local });

  const handleSave = async () => {
    if (!local) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveLogs(local);
    } catch (e: any) {
      setSaveError(e?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

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

  if (error && !local) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </motion.div>
    );
  }

  if (loading || !local) {
    return (
      <motion.div className="space-y-4">
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
      {saveError && <div className="text-sm text-[var(--error)] bg-[var(--error-bg)] p-2 rounded mb-4">{saveError}</div>}

      <div className="mb-4">
        <ModuleToggle guildId={guildId} moduleKey="logs" label="Logs" />
      </div>

      <div className="space-y-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScrollText size={18} className="text-[var(--accent)]" />
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Module de logs</h2>
            </div>
            <Toggle checked={local.enabled} onChange={(v) => setLocal({ ...local, enabled: v })} />
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Salon de logs</h2>
          <DiscordSelect
            type="channel"
            guildId={guildId}
            value={local.logChannelId ?? ''}
            onChange={(id) => setLocal({ ...local, logChannelId: id || null })}
          />
        </Card>

        <Card className="p-4">
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
                    <label key={evt.value} className="flex items-center gap-2 p-2 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)] cursor-pointer">
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

        <Card className="p-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Salons ignorés</h2>
          <div className="flex gap-2 mb-3">
            <div className="flex-1">
              <DiscordSelect
                type="channel"
                guildId={guildId}
                value={ignoreChannelsInput}
                onChange={setIgnoreChannelsInput}
                placeholder="Choisir un salon"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (!ignoreChannelsInput) return;
                setLocal({
                  ...local,
                  ignoreChannels: [...(local.ignoreChannels ?? []), ignoreChannelsInput],
                });
                setIgnoreChannelsInput('');
              }}
            >
              Ajouter
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(local.ignoreChannels ?? []).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setLocal({ ...local, ignoreChannels: local.ignoreChannels?.filter((c) => c !== id) })}
                className="text-xs px-2 py-1 rounded bg-[var(--bg-surface-alt)] border border-[var(--border-color)]"
              >
                {id} ×
              </button>
            ))}
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
