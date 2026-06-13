'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Input, Button, Toggle, Select } from '@pinguin/ui';
import RankCardPreview, { type RankCardPreviewData } from './RankCardPreview';
import { fetchRankCardSettings, updateRankCardSettings } from '@/lib/api';

interface Props {
  guildId: string;
}

const DEFAULT_SETTINGS: RankCardPreviewData = {
  backgroundType: 'COLOR',
  backgroundColor: '#23272a',
  backgroundImage: null,
  gradientFrom: '#23272a',
  gradientTo: '#2c2f33',
  xpBarColor: '#5865f2',
  xpBarBackground: '#4f545c',
  textColor: '#ffffff',
  avatarBorder: true,
  avatarBorderColor: '#5865f2',
  fontFamily: 'Sans-serif',
};

const FONT_OPTIONS = [
  { value: 'Sans-serif', label: 'Sans-serif' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Verdana', label: 'Verdana' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'monospace', label: 'Monospace' },
];

export default function RankCardEditor({ guildId }: Props) {
  const [settings, setSettings] = useState<RankCardPreviewData>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<RankCardPreviewData>(DEFAULT_SETTINGS);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchRankCardSettings(guildId);
        if (res.success && res.data?.settings) {
          const s = res.data.settings as Record<string, unknown>;
          const loaded: RankCardPreviewData = {
            backgroundType: (s.backgroundType as RankCardPreviewData['backgroundType']) || 'COLOR',
            backgroundColor: (s.backgroundColor as string) || '#23272a',
            backgroundImage: (s.backgroundImage as string | null) || null,
            gradientFrom: (s.gradientFrom as string) || '#23272a',
            gradientTo: (s.gradientTo as string) || '#2c2f33',
            xpBarColor: (s.xpBarColor as string) || '#5865f2',
            xpBarBackground: (s.xpBarBackground as string) || '#4f545c',
            textColor: (s.textColor as string) || '#ffffff',
            avatarBorder: (s.avatarBorder as boolean) ?? true,
            avatarBorderColor: (s.avatarBorderColor as string) || '#5865f2',
            fontFamily: (s.fontFamily as string) || 'Sans-serif',
          };
          setSettings(loaded);
          setPreviewData(loaded);
        }
      } catch {
        // Use defaults
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [guildId]);

  const debouncedSetPreview = useCallback((s: RankCardPreviewData) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPreviewData({ ...s });
    }, 100);
  }, []);

  const update = useCallback((patch: Partial<RankCardPreviewData>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      debouncedSetPreview(next);
      return next;
    });
  }, [debouncedSetPreview]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await updateRankCardSettings(guildId, settings as unknown as Record<string, unknown>);
      if (!res.success) {
        setError(res.error || 'Erreur lors de la sauvegarde');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-[var(--text-secondary)]">Chargement...</div>;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left panel - Controls */}
      <div className="flex-1 space-y-4">
        <div>
          <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">
            Type de fond
          </label>
          <div className="flex gap-2">
            {(['COLOR', 'GRADIENT', 'IMAGE'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => update({ backgroundType: t })}
                className={`px-3 py-1.5 text-xs rounded-[var(--radius-sm)] border transition-colors ${
                  settings.backgroundType === t
                    ? 'bg-[var(--accent)] text-[var(--bg-primary)] border-[var(--accent)]'
                    : 'text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--accent)]'
                }`}
              >
                {t === 'COLOR' ? 'Couleur' : t === 'GRADIENT' ? 'Dégradé' : 'Image'}
              </button>
            ))}
          </div>
        </div>

        {settings.backgroundType === 'COLOR' && (
          <Input label="Couleur de fond" type="color" value={settings.backgroundColor} onChange={(e) => update({ backgroundColor: e.target.value })} className="h-10 p-1" />
        )}

        {settings.backgroundType === 'GRADIENT' && (
          <div className="grid grid-cols-2 gap-2">
            <Input label="Dégradé début" type="color" value={settings.gradientFrom} onChange={(e) => update({ gradientFrom: e.target.value })} className="h-10 p-1" />
            <Input label="Dégradé fin" type="color" value={settings.gradientTo} onChange={(e) => update({ gradientTo: e.target.value })} className="h-10 p-1" />
          </div>
        )}

        {settings.backgroundType === 'IMAGE' && (
          <Input
            label="URL de l'image de fond"
            type="text"
            placeholder="https://..."
            value={settings.backgroundImage || ''}
            onChange={(e) => update({ backgroundImage: e.target.value || null })}
          />
        )}

        <div className="grid grid-cols-2 gap-2">
          <Input label="Couleur barre XP" type="color" value={settings.xpBarColor} onChange={(e) => update({ xpBarColor: e.target.value })} className="h-10 p-1" />
          <Input label="Fond barre XP" type="color" value={settings.xpBarBackground} onChange={(e) => update({ xpBarBackground: e.target.value })} className="h-10 p-1" />
        </div>

        <Input label="Couleur du texte" type="color" value={settings.textColor} onChange={(e) => update({ textColor: e.target.value })} className="h-10 p-1" />

        <Select
          label="Police d'écriture"
          options={FONT_OPTIONS}
          value={settings.fontFamily}
          onChange={(e) => update({ fontFamily: e.target.value })}
        />

        <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
          <span className="text-sm text-[var(--text-primary)]">Bordure d'avatar</span>
          <Toggle checked={settings.avatarBorder} onChange={(v) => update({ avatarBorder: v })} />
        </div>

        {settings.avatarBorder && (
          <Input label="Couleur bordure avatar" type="color" value={settings.avatarBorderColor} onChange={(e) => update({ avatarBorderColor: e.target.value })} className="h-10 p-1" />
        )}

        {error && <div className="text-sm text-[var(--error)] bg-[var(--error-bg)] p-2 rounded">{error}</div>}

        <Button loading={saving} onClick={handleSave}>Enregistrer la carte</Button>
      </div>

      {/* Right panel - Preview */}
      <div className="lg:w-[620px] flex-shrink-0">
        <div className="sticky top-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Aperçu</h2>
          <RankCardPreview data={{
            ...previewData,
            username: previewData.username ?? 'Jean#1234',
            level: previewData.level ?? 15,
            currentXp: previewData.currentXp ?? 2400,
            requiredXp: previewData.requiredXp ?? 3000,
            rank: previewData.rank ?? 5,
          }} width={600} height={200} />
          <p className="text-xs text-[var(--text-secondary)] mt-2 text-center">
            Aperçu avec données fictives
          </p>
        </div>
      </div>
    </div>
  );
}
