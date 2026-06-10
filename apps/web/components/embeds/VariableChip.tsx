'use client';

interface VariableChipProps {
  variable: string;
  label: string;
  onInsert: (variable: string) => void;
}

export default function VariableChip({ variable, label, onInsert }: VariableChipProps) {
  return (
    <button
      type="button"
      onClick={() => onInsert(variable)}
      title={`Insérer ${variable} — ${label}`}
      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono rounded-[var(--radius-sm)] border border-[var(--border-color)] text-[var(--accent)] hover:bg-[var(--bg-surface-alt)] transition-colors cursor-pointer"
    >
      <span>{variable}</span>
      <span className="text-[var(--text-secondary)] font-sans text-[10px]">({label})</span>
    </button>
  );
}
