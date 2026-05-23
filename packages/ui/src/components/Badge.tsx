import React from 'react';
import { cn } from '../utils/cn';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] border-[var(--border-color)]',
  success: 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/30',
  warning: 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/30',
  error: 'bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/30',
  info: 'bg-[var(--info)]/10 text-[var(--info)] border-[var(--info)]/30',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-[var(--radius-sm)] border',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
