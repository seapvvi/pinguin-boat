'use client';
import React from 'react';
import { cn } from '../utils/cn';

type InputVariant = 'default' | 'filled';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  inputVariant?: InputVariant;
}

export function Input({
  label,
  error,
  helperText,
  inputVariant = 'default',
  className,
  id,
  ...props
}: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'w-full px-3 py-2 text-sm text-[var(--text-primary)] rounded-[var(--radius-sm)] outline-none transition-colors duration-150',
          'placeholder:text-[var(--text-secondary)] placeholder:text-sm',
          inputVariant === 'default' &&
            'bg-transparent border border-[var(--border-color)] focus:border-[var(--accent)]',
          inputVariant === 'filled' &&
            'bg-[var(--bg-surface-alt)] border border-transparent focus:border-[var(--border-color)]',
          error && 'border-[var(--error)] focus:border-[var(--error)]',
          className,
        )}
        {...props}
      />
      {error && <span className="text-xs text-[var(--error)]">{error}</span>}
      {helperText && !error && (
        <span className="text-xs text-[var(--text-secondary)]">{helperText}</span>
      )}
    </div>
  );
}
