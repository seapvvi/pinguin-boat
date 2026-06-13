'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  MessageSquare, Users, Hash, Activity
} from 'lucide-react';
import { Button, Toggle } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { api } from '@/lib/api';
import type { LogSettings } from '@pinguin/shared';
import { LogEventType } from '@pinguin/shared';
import { ModuleToggle } from '@/components/ModuleToggle';
import { PermissionGate } from '@/components/PermissionGate';
import { DiscordSelect } from '@/components/DiscordSelect';
import { useBackgroundRefresh, useAutoSave } from '@/lib/hooks';
import { SkeletonPage } from '@/components/layout/SkeletonPage';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionCard } from '@/components/layout/SectionCard';
import { ModuleGrid } from '@/components/layout/ModuleGrid';

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

  const load = useCallback(async (silent = false) => {
    setError(null);
    try {
      const res = await api.get<{ data: LogSettings & { enabledEvents?: LogEventType[] } }>(`/api/guilds/${guildId}/logs`);
      const payload = (res as { data?: unknown })?.data;
      if (payload) {
        const d = payload as { enabled?: boolean; logChannelId?: string | null; enabledEvents?: LogEventType[]; events?: LogEventType[]; ignoreChannels?: string[]; ignoredChannels?: string[]; ignoreUsers?: string[]; ignoredRoles?: string[] };
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
      if (!silent) setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [guildId]);

  useEffect(() => { load(); }, [load]);
  useBackgroundRefresh(load, 10000, [guildId]);

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
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde');
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
    return <SkeletonPage rows={3} />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <PermissionGate permission="manageMessages">
        <PageLayout
          title="Logs"
          description="Configurez les événements à journaliser."
          actions={<Button loading={saving} onClick={handleSave}>Enregistrer</Button>}
        >
          {saveError && (
            <div className="text-sm text-[var(--error)] bg-[var(--error)]/10 px-3 py-2 mb-4">{saveError}</div>
          )}

          <div className="mb-4">
            <ModuleToggle guildId={guildId} moduleKey="logs" label="Logs" />
          </div>

          <SectionCard
            title="Configuration des logs"
            description="Salon de destination pour les logs"
          >
            <DiscordSelect
              type="channel"
              guildId={guildId}
              value={local.logChannelId ?? ''}
              onChange={(id) => setLocal({ ...local, logChannelId: id || null })}
            />
          </SectionCard>

          <div className="mt-6">
            <ModuleGrid>
              {eventCategories.map((cat) => {
                const catEnabled = cat.events.some((e) => (local.enabledEvents ?? []).includes(e.value));
                return (
                  <SectionCard
                    key={cat.label}
                    title={cat.label}
                    icon={cat.icon}
                    headerAction={
                      <Toggle
                        checked={catEnabled}
                        onChange={(v) => {
                          const enabledEvents = local.enabledEvents ?? [];
                          if (v) {
                            setLocal({
                              ...local,
                              enabledEvents: [...new Set([...enabledEvents, ...cat.events.map((e) => e.value)])],
                            });
                          } else {
                            setLocal({
                              ...local,
                              enabledEvents: enabledEvents.filter((e) => !cat.events.some((ce) => ce.value === e)),
                            });
                          }
                        }}
                      />
                    }
                  >
                    <div className={!catEnabled ? 'opacity-50' : ''}>
                      <div className="space-y-1">
                        {cat.events.map((evt) => (
                          <label key={evt.value} className="flex items-center gap-2 py-1.5 cursor-pointer">
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
                  </SectionCard>
                );
              })}

              <SectionCard
                title="Salons ignorés"
                icon={<Hash size={16} />}
              >
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
                      className="text-xs px-2 py-1 bg-[var(--bg-surface-alt)] border border-[var(--border-color)]"
                    >
                      {id} ×
                    </button>
                  ))}
                </div>
              </SectionCard>
            </ModuleGrid>
          </div>
        </PageLayout>
      </PermissionGate>
    </motion.div>
  );
}
