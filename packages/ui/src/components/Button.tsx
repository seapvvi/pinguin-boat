'use client';
import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  asChild?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent-primary)] text-white border border-[var(--accent-primary)] ' +
    'hover:bg-[var(--accent-primary-hover)] hover:border-[var(--accent-primary-hover)]',
  secondary:
    'bg-[var(--bg-surface-alt)] text-[var(--text-primary)] border border-[var(--border-color)] ' +
    'hover:bg-[var(--bg-surface-alt-hover)] hover:border-[var(--border-color-strong)]',
  ghost:
    'bg-transparent text-[var(--text-secondary)] border border-transparent ' +
    'hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt-hover)] hover:border-[var(--border-color)]',
  danger:
    'bg-[var(--accent-danger)] text-white border border-[var(--accent-danger)] ' +
    'hover:bg-[var(--accent-danger-hover)] hover:border-[var(--accent-danger-hover)]',
  success:
    'bg-[var(--accent-live)] text-white border border-[var(--accent-live)] ' +
    'hover:bg-[var(--accent-live-hover)] hover:border-[var(--accent-live-hover)]',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-base',
  lg: 'h-12 px-6 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  asChild = false,
  className,
  children,
  ...props
}: ButtonProps) {
  const Tag = asChild ? motion.span : motion.button;
  const extraProps = asChild
    ? {}
    : { type: (props as any).type ?? ('button' as const), disabled: disabled || loading };

  return (
      <Tag
      whileTap={
        asChild
          ? undefined
          : variant === 'primary'
            ? { scale: 0.94, y: 1, transition: { duration: 0.08 } }
            : { scale: 0.94, transition: { duration: 0.08 } }
      }
      whileHover={variant === 'ghost' || asChild ? undefined : { scale: 1.02, transition: { duration: 0.12 } }}
      transition={{ duration: 0.12, ease: 'easeInOut' }}
      {...extraProps}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 ease-in-out cursor-pointer select-none whitespace-nowrap',
        !asChild && 'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
        'relative',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      style={{ borderRadius: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      {...(props as any)}
    >
      {loading && (
        <svg
          className="absolute animate-spin top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          width={size === 'sm' ? 12 : size === 'lg' ? 18 : 14}
          height={size === 'sm' ? 12 : size === 'lg' ? 18 : 14}
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      )}
      <span className={cn('flex items-center gap-2 whitespace-nowrap', loading && 'invisible')}>{children}</span>
    </Tag>
  );
}
