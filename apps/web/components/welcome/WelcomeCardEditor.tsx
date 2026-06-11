'use client';

import { Input, Toggle } from '@pinguin/ui';
import WelcomeCardPreview, { type WelcomeCardPreviewData } from './WelcomeCardPreview';

interface Props {
  settings: WelcomeCardPreviewData;
  onChange: (patch: Partial<WelcomeCardPreviewData>) => void;
}

export default function WelcomeCardEditor({ settings, onChange }: Props) {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
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
                onClick={() => onChange({ cardBackground: t })}
                className={`px-3 py-1.5 text-xs rounded-[var(--radius-sm)] border transition-colors ${
                  settings.cardBackground === t
                    ? 'bg-[var(--accent)] text-[var(--bg-primary)] border-[var(--accent)]'
                    : 'text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--accent)]'
                }`}
              >
                {t === 'COLOR' ? 'Couleur' : t === 'GRADIENT' ? 'Dégradé' : 'Image'}
              </button>
            ))}
          </div>
        </div>

        {settings.cardBackground === 'COLOR' && (
          <Input
            label="Couleur de fond"
            type="color"
            value={settings.cardBgColor}
            onChange={(e) => onChange({ cardBgColor: e.target.value })}
            className="h-10 p-1"
          />
        )}

        {settings.cardBackground === 'GRADIENT' && (
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Couleur début"
              type="color"
              value={settings.cardBgColor}
              onChange={(e) => onChange({ cardBgColor: e.target.value })}
              className="h-10 p-1"
            />
            <Input
              label="Couleur fin"
              type="color"
              value={settings.cardAccentColor}
              onChange={(e) => onChange({ cardAccentColor: e.target.value })}
              className="h-10 p-1"
            />
          </div>
        )}

        {settings.cardBackground === 'IMAGE' && (
          <div className="space-y-3">
            <Input
              label="URL de l'image de fond"
              type="text"
              placeholder="https://..."
              value={settings.cardBgImage || ''}
              onChange={(e) => onChange({ cardBgImage: e.target.value || null })}
            />
            <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
              <span className="text-sm text-[var(--text-primary)]">Flou sur l'image</span>
              <Toggle checked={settings.cardBlurBackground} onChange={(v) => onChange({ cardBlurBackground: v })} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Couleur du texte"
            type="color"
            value={settings.cardTextColor}
            onChange={(e) => onChange({ cardTextColor: e.target.value })}
            className="h-10 p-1"
          />
          <Input
            label="Couleur sous-texte"
            type="color"
            value={settings.cardSubtextColor}
            onChange={(e) => onChange({ cardSubtextColor: e.target.value })}
            className="h-10 p-1"
          />
        </div>

        <Input
          label="Couleur d'accent (bordure avatar)"
          type="color"
          value={settings.cardAccentColor}
          onChange={(e) => onChange({ cardAccentColor: e.target.value })}
          className="h-10 p-1"
        />

        <div>
          <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">
            Texte principal
          </label>
          <input
            type="text"
            value={settings.cardText}
            onChange={(e) => onChange({ cardText: e.target.value })}
            placeholder="Bienvenue sur {server} !"
            className="w-full px-3 py-2 text-sm text-[var(--text-primary)] bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">
            Sous-texte
          </label>
          <input
            type="text"
            value={settings.cardSubtext}
            onChange={(e) => onChange({ cardSubtext: e.target.value })}
            placeholder="Tu es le {memberCount}ème membre"
            className="w-full px-3 py-2 text-sm text-[var(--text-primary)] bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>
      </div>

      <div className="lg:w-[720px] flex-shrink-0">
        <div className="sticky top-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Aperçu</h2>
          <WelcomeCardPreview data={settings} width={700} height={250} />
          <p className="text-xs text-[var(--text-secondary)] mt-2 text-center">
            Aperçu avec données fictives &mdash; utilisez les variables {'{user}'}, {'{server}'}, {'{memberCount}'}
          </p>
        </div>
      </div>
    </div>
  );
}
