import React from 'react';
import { cn } from '../utils/cn';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[var(--bg-surface-alt)] text-[var(--text-secondary)]',
  success: 'bg-[var(--accent-live)]/15 text-[var(--accent-live)]',
  warning: 'bg-[var(--accent-warning)]/15 text-[var(--accent-warning)]',
  error: 'bg-[var(--accent-danger)]/15 text-[var(--accent-danger)]',
  info: 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
