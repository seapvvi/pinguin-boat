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
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--accent-primary)] text-white hover:brightness-110 border border-[var(--accent-primary)]',
  secondary:
    'bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] border border-[var(--border-color)]',
  ghost:
    'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] border border-transparent',
  danger:
    'bg-[var(--accent-danger)] text-white hover:brightness-110 border border-[var(--accent-danger)]',
  success:
    'bg-[var(--accent-live)] text-white hover:brightness-110 border border-[var(--accent-live)]',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12, ease: 'easeInOut' }}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 ease-in-out cursor-pointer select-none',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
        'relative',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      style={{ borderRadius: 0 }}
      {...(props as any)}
    >
      {loading && (
        <svg
          className="absolute animate-spin"
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
      <span className={cn(loading && 'invisible')}>{children}</span>
    </motion.button>
  );
}
