'use client';
import React from 'react';
import { cn } from '../utils/cn';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
}

/** Interrupteur rectangulaire : actif = couleur accent, inactif = fond sombre semi-transparent + bordure. */
export function Toggle({ checked, onChange, disabled = false, className, label }: ToggleProps) {
  return (
    <label
      className={cn(
        'inline-flex items-center gap-2 cursor-pointer select-none',
        disabled && 'opacity-40 cursor-not-allowed',
        className,
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border px-1 text-[10px] font-semibold uppercase tracking-wide',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2',
          checked
            ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-primary)]'
            : 'border-[var(--border-color)] bg-[var(--bg-surface-alt)]/40 text-[var(--text-secondary)] opacity-70',
        )}
      >
        {checked ? 'ON' : 'OFF'}
      </button>
      {label && <span className="text-sm text-[var(--text-primary)]">{label}</span>}
    </label>
  );
}
