'use client';

import { useState, useEffect } from 'react';
import { Radio, Video, Palette, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { Button, Select, Input, Toggle } from '@pinguin/ui';
import { DiscordSelect } from '@/components/DiscordSelect';
import { fetchGuildRoles } from '@/lib/api';

interface StreamFormValues {
  platform: 'TWITCH' | 'YOUTUBE';
  channelName: string;
  channelId: string;
  discordChannelId: string;
  customTitle: string;
  customDescription: string;
  customColor: string;
  customFooter: string;
  mentionRoleId: string | null;
  pingEveryoneOnLive: boolean;
}

interface StreamFormProps {
  guildId: string;
  initialValues?: StreamFormValues;
  onSubmit: (values: StreamFormValues) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

const DEFAULT_VALUES: StreamFormValues = {
  platform: 'TWITCH',
  channelName: '',
  channelId: '',
  discordChannelId: '',
  customTitle: '',
  customDescription: '',
  customColor: '#9146ff',
  customFooter: '',
  mentionRoleId: null,
  pingEveryoneOnLive: false,
};

export function StreamForm({ guildId, initialValues, onSubmit, onCancel, submitLabel = 'Ajouter la notification' }: StreamFormProps) {
  const [values, setValues] = useState<StreamFormValues>(initialValues ?? DEFAULT_VALUES);
  const [showCustom, setShowCustom] = useState(!!initialValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (!guildId) return;
    fetchGuildRoles(guildId).then((res) => {
      if (res.success && res.data) {
        setRoles(res.data.roles.map((r) => ({
          value: String(r.id),
          label: String(r.name),
        })));
      }
    }).catch(() => {});
  }, [guildId]);

  const update = (patch: Partial<StreamFormValues>) => {
    setValues((prev) => ({ ...prev, ...patch }));
  };

  const validate = (): string | null => {
    if (!values.channelName.trim()) return 'Le nom du streamer est requis';
    if (!values.discordChannelId) return 'Le salon Discord de destination est requis';
    if (values.platform === 'YOUTUBE' && values.channelId && !values.channelId.startsWith('UC')) {
      return 'L\'ID de chaîne YouTube doit commencer par "UC"';
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la soumission');
    } finally {
      setSaving(false);
    }
  };

  const previewEmbed = {
    color: values.customColor || '#5865F2',
    title: values.customTitle
      ? values.customTitle.replace(/{streamer}/g, values.channelName || 'Streamer').replace(/{game}/g, 'Jeu').replace(/{title}/g, 'Titre du live')
      : `${values.channelName || 'Streamer'} est en direct !`,
    description: values.customDescription
      ? values.customDescription.replace(/{streamer}/g, values.channelName || 'Streamer').replace(/{game}/g, 'Jeu').replace(/{title}/g, 'Titre du live')
      : 'Aperçu de la notification de live.',
    footer: values.customFooter || undefined,
    timestamp: true,
    fields: [],
  };

  const showEveryoneWarning = values.pingEveryoneOnLive;
  const showRoleWarning = values.pingEveryoneOnLive && values.mentionRoleId;
  const mentionOptions = [
    { value: '', label: 'Personne (aucun rôle)' },
    { value: '@everyone', label: '@everyone' },
    ...roles,
  ];

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm text-[var(--error)] bg-[var(--error-bg)] p-2 rounded">{error}</div>
      )}

      <div>
        <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">Plateforme</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => update({ platform: 'TWITCH', channelId: '', customColor: '#9146ff' })}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-[var(--radius-sm)] border text-sm font-medium transition-colors cursor-pointer ${
              values.platform === 'TWITCH'
                ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-purple-500/50'
            }`}
          >
            <Radio size={16} />
            Twitch
          </button>
          <button
            type="button"
            onClick={() => update({ platform: 'YOUTUBE', channelId: '', customColor: '#ff0000' })}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-[var(--radius-sm)] border text-sm font-medium transition-colors cursor-pointer ${
              values.platform === 'YOUTUBE'
                ? 'border-red-500 bg-red-500/10 text-red-400'
                : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-red-500/50'
            }`}
          >
            <Video size={16} />
            YouTube
          </button>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">
          {values.platform === 'TWITCH' ? 'Nom du streamer' : 'Nom de la chaîne'}
        </label>
        <Input
          value={values.channelName}
          onChange={(e) => update({ channelName: e.target.value })}
          placeholder={values.platform === 'TWITCH' ? 'ex: xQc' : 'ex: MrBeast'}
        />
      </div>

      <div>
        <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">
          ID de chaîne {values.platform === 'YOUTUBE' ? '(obligatoire pour YouTube si le nom ne suffit pas)' : '(optionnel)'}
        </label>
        <Input
          value={values.channelId}
          onChange={(e) => update({ channelId: e.target.value })}
          placeholder={values.platform === 'TWITCH' ? 'ex: 123456789' : 'ex: UCxxxxxxxxxxxxxxxxxxxxxxx'}
          helperText={values.platform === 'YOUTUBE' ? 'Doit commencer par "UC"' : undefined}
        />
      </div>

      <DiscordSelect
        type="channel"
        guildId={guildId}
        label="Salon Discord"
        value={values.discordChannelId}
        onChange={(id) => update({ discordChannelId: id })}
        channelTypes={[0]}
      />

      <div className="border-t border-[var(--border-color)] pt-4">
        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          <Palette size={14} />
          Message personnalisé (optionnel)
          {showCustom ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showCustom && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Titre personnalisé"
                value={values.customTitle}
                onChange={(e) => update({ customTitle: e.target.value })}
                placeholder="{streamer} est en live !"
                helperText="Disponible : {streamer}, {game}, {title}"
              />
              <Input
                label="Couleur"
                type="color"
                value={values.customColor}
                onChange={(e) => update({ customColor: e.target.value })}
                className="h-10 p-1"
              />
            </div>

            <Input
              label="Description personnalisée"
              value={values.customDescription}
              onChange={(e) => update({ customDescription: e.target.value })}
              placeholder="{streamer} joue à {game} — {title}"
              helperText="Disponible : {streamer}, {game}, {title}"
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Footer personnalisé"
                value={values.customFooter}
                onChange={(e) => update({ customFooter: e.target.value })}
                placeholder="Propulsé par Pinguin"
              />

              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">Rôle à mentionner</label>
                <Select
                  options={mentionOptions}
                  value={values.mentionRoleId ?? ''}
                  onChange={(e) => update({ mentionRoleId: e.target.value || null })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Toggle
                  checked={values.pingEveryoneOnLive}
                  onChange={(checked) => update({ pingEveryoneOnLive: checked })}
                  label="Ping @everyone en live"
                />
              </div>
            </div>

            {showEveryoneWarning && (
              <div className="flex items-start gap-2 p-3 rounded-[var(--radius-sm)] bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <span>Ping @everyone peut irriter les membres. Utilisez avec parcimonie.</span>
              </div>
            )}

            {showRoleWarning && (
              <div className="flex items-start gap-2 p-3 rounded-[var(--radius-sm)] bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <span>Vous allez pinger @everyone ET un rôle — c&apos;est redondant.</span>
              </div>
            )}

            <div className="rounded-md overflow-hidden border border-[var(--border-color)]">
              <div className="bg-[var(--bg-surface-alt)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] border-b border-[var(--border-color)]">
                Aperçu de l&apos;embed
              </div>
              <div className="p-3" style={{ backgroundColor: '#2f3136' }}>
                <div className="flex">
                  <div className="w-1 flex-shrink-0 rounded-l-md" style={{ backgroundColor: previewEmbed.color }} />
                  <div className="flex-1 p-3" style={{ backgroundColor: '#36393f' }}>
                    {previewEmbed.title && (
                      <h3 className="text-base font-semibold mb-1" style={{ color: '#f2f3f5' }}>{previewEmbed.title}</h3>
                    )}
                    <p className="text-sm whitespace-pre-wrap mb-3" style={{ color: '#dcddde' }}>{previewEmbed.description}</p>
                    <div className="flex items-center gap-2 mt-1 pt-2 border-t" style={{ borderColor: '#3f4147' }}>
                      {previewEmbed.footer && (
                        <span className="text-xs" style={{ color: '#dcddde' }}>{previewEmbed.footer}</span>
                      )}
                      {previewEmbed.timestamp && (
                        <span className="text-xs ml-auto" style={{ color: '#dcddde' }}>
                          {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>Annuler</Button>
        )}
        <Button loading={saving} onClick={handleSubmit}>{submitLabel}</Button>
      </div>
    </div>
  );
}
