'use client';

import { useEffect, useState } from 'react';
import { Card, Toggle, Input, Button, Skeleton, Select } from '@pinguin/ui';
import { api } from '@/lib/api';
import { DiscordSelect } from '@/components/DiscordSelect';
function sanitizeTicketSettingsPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const { ...editable } = payload;
  delete editable.id;
  delete editable.guildId;
  delete editable.createdAt;
  delete editable.updatedAt;
  delete editable.enabled;
  return editable;
}

export function TicketSettingsForm({ guildId }: { guildId: string }) {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ data: Record<string, unknown> }>(`/api/guilds/${guildId}/tickets/settings`)
      .then((res) => {
        const payload = (res as { data?: Record<string, unknown> })?.data;
        if (payload) setSettings(sanitizeTicketSettingsPayload(payload));
      })
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
      await api.patch(`/api/guilds/${guildId}/tickets/settings`, sanitizeTicketSettingsPayload(settings));
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
      <DiscordSelect type="channel" guildId={guildId} label="Catégorie (salon parent)" value={str('categoryId')} onChange={(id) => update('categoryId', id || null)} channelTypes={[4]} />
      <DiscordSelect type="channel" guildId={guildId} label="Salon de logs" value={str('logChannelId')} onChange={(id) => update('logChannelId', id || null)} />
      <Input label="Format des salons" value={str('channelFormat')} onChange={(e) => update('channelFormat', e.target.value)} placeholder="ticket-{username}" />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase">
          Message du panneau (/ticket panel)
        </label>
        <textarea
          rows={3}
          value={str('panelMessage')}
          onChange={(e) => update('panelMessage', e.target.value)}
          placeholder="Cliquez sur le bouton ci-dessous pour ouvrir un ticket."
          className="w-full px-3 py-2 text-sm text-[var(--text-primary)] rounded-[var(--radius-sm)] outline-none bg-transparent border border-[var(--border-color)] focus:border-[var(--accent)] placeholder:text-[var(--text-secondary)] resize-y"
        />
      </div>

      <Input label="Texte du bouton du panneau" value={str('panelButtonText')} onChange={(e) => update('panelButtonText', e.target.value)} placeholder="Ouvrir un ticket" />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase">
          Message d&apos;accueil à l&apos;ouverture d&apos;un ticket
        </label>
        <textarea
          rows={3}
          value={str('openMessage')}
          onChange={(e) => update('openMessage', e.target.value)}
          placeholder="Bienvenue ! Décris ton problème."
          className="w-full px-3 py-2 text-sm text-[var(--text-primary)] rounded-[var(--radius-sm)] outline-none bg-transparent border border-[var(--border-color)] focus:border-[var(--accent)] placeholder:text-[var(--text-secondary)] resize-y"
        />
      </div>

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
      <DiscordSelect type="channel" guildId={guildId} label="Salon des transcripts" value={str('transcriptChannelId')} onChange={(id) => update('transcriptChannelId', id || null)} />
      <Select
        label="Format des transcripts"
        options={[
          { value: 'HTML', label: 'HTML (riche, avec embeds)' },
          { value: 'TXT', label: 'TXT (texte brut)' },
        ]}
        value={str('transcriptFormat')}
        onChange={(e) => update('transcriptFormat', e.target.value)}
      />
    </Card>
  );
}
