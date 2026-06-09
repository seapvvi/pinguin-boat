'use client';

const sources = [
  { value: 'top.gg', label: 'Top.gg' },
  { value: 'word_of_mouth', label: 'Bouche à oreille' },
  { value: 'social_media', label: 'Réseaux sociaux' },
  { value: 'other', label: 'Autre' },
];

interface StepSourceProps {
  selectedSource: string;
  details: string;
  onSourceChange: (source: string) => void;
  onDetailsChange: (details: string) => void;
}

export function StepSource({ selectedSource, details, onSourceChange, onDetailsChange }: StepSourceProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        Comment avez-vous découvert Pinguin ? (facultatif)
      </p>

      <div className="flex flex-wrap gap-2">
        {sources.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onSourceChange(s.value)}
            className={`px-4 py-2 text-sm rounded-[var(--radius-sm)] border transition-colors ${
              selectedSource === s.value
                ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                : 'border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent)]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {selectedSource === 'other' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase">
            Dites-nous en plus...
          </label>
          <textarea
            value={details}
            onChange={(e) => onDetailsChange(e.target.value)}
            placeholder="Comment nous avez-vous connu ?"
            className="w-full px-3 py-2 text-sm text-[var(--text-primary)] bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] outline-none focus:border-[var(--accent)] transition-colors resize-none h-24"
          />
        </div>
      )}
    </div>
  );
}
