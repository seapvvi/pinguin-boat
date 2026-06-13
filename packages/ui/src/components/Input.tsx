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
          className="text-[11px] font-semibold text-[var(--text-secondary)] tracking-widest uppercase mb-1.5 block"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'w-full text-sm text-[var(--text-primary)] transition-colors duration-150',
          'placeholder:text-[var(--text-secondary)] placeholder:text-sm',
          'outline-none focus:outline-2 focus:outline-[var(--accent-primary)] focus:outline-offset-0',
          inputVariant === 'default' &&
            'bg-transparent border border-[var(--border-color)]',
          inputVariant === 'filled' &&
            'bg-[var(--bg-surface-alt)] border border-transparent',
          error && 'border-[var(--error)]',
          className,
        )}
        style={{
          height: 'var(--input-height)',
          paddingLeft: 'var(--input-padding-x)',
          paddingRight: 'var(--input-padding-x)',
          borderRadius: 0,
        }}
        {...props}
      />
      {error && <span className="text-xs text-[var(--error)] mt-1">{error}</span>}
      {helperText && !error && (
        <span className="text-[11px] text-[var(--text-secondary)] mt-1">{helperText}</span>
      )}
    </div>
  );
}
