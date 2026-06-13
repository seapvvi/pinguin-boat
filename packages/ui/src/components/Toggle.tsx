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
          'relative inline-flex shrink-0 items-center transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2',
          checked ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-surface-alt)]',
        )}
        style={{ width: 32, height: 18, borderRadius: 0 }}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 bg-white transition-transform duration-150',
          )}
          style={{
            width: 14,
            height: 14,
            borderRadius: 0,
            transform: checked ? 'translateX(14px)' : 'translateX(0)',
          }}
        />
      </button>
      {label && <span className="text-sm text-[var(--text-primary)]">{label}</span>}
    </label>
  );
}
