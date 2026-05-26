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
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          checked
            ? 'bg-[var(--accent)] focus-visible:ring-[var(--accent)]'
            : 'bg-[var(--bg-surface-alt)] focus-visible:ring-[var(--border-color)]',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 rounded-full shadow-sm transition-all duration-300 ease-in-out',
            checked
              ? 'translate-x-6 bg-white opacity-100'
              : 'translate-x-1 bg-white/30 opacity-60',
          )}
        />
      </button>
      {label && <span className="text-sm text-[var(--text-primary)]">{label}</span>}
    </label>
  );
}
