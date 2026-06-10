'use client';

import { useRef, useCallback } from 'react';
import { Plus, X, ArrowUp, ArrowDown } from 'lucide-react';
import { Input, Button } from '@pinguin/ui';
import type { EmbedData } from '@pinguin/db';
import DiscordEmbedPreview from './DiscordEmbedPreview';
import VariableChip from './VariableChip';

interface EmbedEditorProps {
  value: EmbedData;
  onChange: (data: EmbedData) => void;
}

const DEFAULT_VARIABLES = [
  { key: '{{user}}', label: 'Utilisateur' },
  { key: '{{server}}', label: 'Serveur' },
  { key: '{{date}}', label: 'Date' },
  { key: '{{memberCount}}', label: 'Membres' },
  { key: '{{channel}}', label: 'Salon' },
];

export default function EmbedEditor({ value, onChange }: EmbedEditorProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const focusedField = useRef<'title' | 'description' | null>(null);

  const update = useCallback((patch: Partial<EmbedData>) => {
    onChange({ ...value, ...patch });
  }, [value, onChange]);

  const addField = () => {
    update({ fields: [...value.fields, { name: '', value: '', inline: false }] });
  };

  const removeField = (index: number) => {
    update({ fields: value.fields.filter((_, i) => i !== index) });
  };

  const updateField = (index: number, key: 'name' | 'value' | 'inline', val: string | boolean) => {
    const fields = value.fields.map((f, i) => (i === index ? { ...f, [key]: val } : f));
    update({ fields });
  };

  const moveField = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= value.fields.length) return;
    const fields = [...value.fields];
    [fields[index], fields[target]] = [fields[target], fields[index]];
    update({ fields });
  };

  const insertVariable = useCallback((variable: string) => {
    const el = focusedField.current === 'title'
      ? titleRef.current
      : focusedField.current === 'description'
        ? descRef.current
        : null;
    if (!el) return;

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const newValue = before + variable + after;
    const newCursor = start + variable.length;

    const nativeSetter = Object.getOwnPropertyDescriptor(
      (el.constructor as typeof HTMLInputElement | typeof HTMLTextAreaElement).prototype,
      'value'
    )?.set;
    if (nativeSetter) {
      nativeSetter.call(el, newValue);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.setSelectionRange(newCursor, newCursor);
    }
    el.focus();
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Formulaire gauche */}
      <div className="flex-1 space-y-4">
        <div>
          <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">Titre</label>
          <input
            ref={titleRef}
            type="text"
            value={value.title ?? ''}
            onChange={(e) => update({ title: e.target.value || undefined })}
            onFocus={() => { focusedField.current = 'title'; }}
            placeholder="Titre de l'embed"
            className="w-full px-3 py-2 text-sm text-[var(--text-primary)] bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">Description</label>
          <textarea
            ref={descRef}
            value={value.description ?? ''}
            onChange={(e) => update({ description: e.target.value || undefined })}
            onFocus={() => { focusedField.current = 'description'; }}
            placeholder="Description de l'embed"
            rows={4}
            className="w-full px-3 py-2 text-sm text-[var(--text-primary)] bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] outline-none focus:border-[var(--accent)] transition-colors resize-none"
          />
        </div>

        <Input
          label="Couleur"
          type="color"
          value={value.color}
          onChange={(e) => update({ color: e.target.value })}
          className="h-10 p-1"
        />

        {/* Variables */}
        <div>
          <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-2">Variables</label>
          <div className="flex flex-wrap gap-1.5">
            {DEFAULT_VARIABLES.map((v) => (
              <VariableChip key={v.key} variable={v.key} label={v.label} onInsert={insertVariable} />
            ))}
          </div>
        </div>

        {/* Champs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
              Champs ({value.fields.length})
            </span>
            <Button variant="ghost" size="sm" onClick={addField}><Plus size={12} /> Ajouter</Button>
          </div>
          <div className="space-y-2">
            {value.fields.map((field, i) => (
              <div key={i} className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)] space-y-2 border border-[var(--border-color)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-secondary)]">Champ {i + 1}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveField(i, -1)}
                      disabled={i === 0}
                      className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors cursor-pointer"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveField(i, 1)}
                      disabled={i === value.fields.length - 1}
                      className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors cursor-pointer"
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeField(i)}
                      className="text-[var(--text-secondary)] hover:text-[var(--error)] transition-colors cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <Input
                  placeholder="Nom du champ"
                  value={field.name}
                  onChange={(e) => updateField(i, 'name', e.target.value)}
                />
                <Input
                  placeholder="Valeur du champ"
                  value={field.value}
                  onChange={(e) => updateField(i, 'value', e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`inline-${i}`}
                    checked={field.inline}
                    onChange={(e) => updateField(i, 'inline', e.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  <label htmlFor={`inline-${i}`} className="text-xs text-[var(--text-secondary)] cursor-pointer">
                    Inline
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Input
          label="Footer"
          placeholder="Texte du footer"
          value={value.footer ?? ''}
          onChange={(e) => update({ footer: e.target.value || undefined })}
        />

        <Input
          label="Image (URL)"
          placeholder="https://..."
          value={value.image ?? ''}
          onChange={(e) => update({ image: e.target.value || undefined })}
        />

        <Input
          label="Thumbnail (URL)"
          placeholder="https://..."
          value={value.thumbnail ?? ''}
          onChange={(e) => update({ thumbnail: e.target.value || undefined })}
        />

        <Input
          label="Nom de l'auteur"
          placeholder="Nom de l'auteur"
          value={value.authorName ?? ''}
          onChange={(e) => update({ authorName: e.target.value || undefined })}
        />

        <Input
          label="Icône de l'auteur (URL)"
          placeholder="https://..."
          value={value.authorIcon ?? ''}
          onChange={(e) => update({ authorIcon: e.target.value || undefined })}
        />

        <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)] border border-[var(--border-color)]">
          <span className="text-sm text-[var(--text-primary)]">Afficher le timestamp</span>
          <input
            type="checkbox"
            checked={value.timestamp}
            onChange={(e) => update({ timestamp: e.target.checked })}
            className="accent-[var(--accent)]"
          />
        </div>
      </div>

      {/* Prévisualisation droite */}
      <div className="lg:w-[520px] flex-shrink-0">
        <div className="sticky top-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Aperçu</h2>
          <DiscordEmbedPreview data={value} />
        </div>
      </div>
    </div>
  );
}
