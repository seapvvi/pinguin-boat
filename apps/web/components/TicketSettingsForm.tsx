'use client';

import { useEffect, useState } from 'react';
import { Card, Toggle, Input, Button, Skeleton } from '@pinguin/ui';
import { api } from '@/lib/api';
import { DiscordSelect } from '@/components/DiscordSelect';

export function TicketSettingsForm({ guildId }: { guildId: string }) {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ data: Record<string, unknown> }>(`/api/guilds/${guildId}/tickets/settings`)
      .then((res) => { if (res.success && res.data) setSettings(res.data as Record<string, unknown>); })
      .finally(() => setLoading(false));
  }, [guildId]);

  const update = (key: string, value: unknown) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await api.patch(`/api/guilds/${guildId}/tickets/settings`, settings);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton className="h-48 w-full" />;
  if (!settings) return null;

  const bool = (k: string) => !!settings[k];
  const str = (k: string) => String(settings[k] ?? '');

  return (
    <Card className="p-4 space-y-4 mb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Configuration des tickets</h2>
        <Button loading={saving} onClick={save}>Enregistrer</Button>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm">Module activé</span>
        <Toggle checked={bool('enabled')} onChange={(v) => update('enabled', v)} />
      </div>
      <DiscordSelect type="channel" guildId={guildId} label="Catégorie (salon parent)" value={str('categoryId')} onChange={(id) => update('categoryId', id || null)} channelTypes={[4]} />
      <DiscordSelect type="channel" guildId={guildId} label="Salon de logs" value={str('logChannelId')} onChange={(id) => update('logChannelId', id || null)} />
      <Input label="Format des salons" value={str('channelFormat')} onChange={(e) => update('channelFormat', e.target.value)} placeholder="ticket-{username}" />
      <div className="flex items-center justify-between">
        <span className="text-sm">Validation requise</span>
        <Toggle checked={bool('requireValidation')} onChange={(v) => update('requireValidation', v)} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm">Motif d&apos;ouverture</span>
        <Toggle checked={bool('requireOpenReason')} onChange={(v) => update('requireOpenReason', v)} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm">Motif de fermeture</span>
        <Toggle checked={bool('requireCloseReason')} onChange={(v) => update('requireCloseReason', v)} />
      </div>
      <Input label="Tickets max par membre" type="number" value={str('maxOpenPerUser')} onChange={(e) => update('maxOpenPerUser', parseInt(e.target.value) || 1)} />
      <div className="flex items-center justify-between">
        <span className="text-sm">Mention modérateurs</span>
        <Toggle checked={bool('mentionModerators')} onChange={(v) => update('mentionModerators', v)} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm">Suppression auto à la fermeture</span>
        <Toggle checked={bool('autoDelete')} onChange={(v) => update('autoDelete', v)} />
      </div>
    </Card>
  );
}
