'use client';
import { cn } from '../utils/cn';

interface SkeletonProps {
  className?: string;
  // Variantes prédéfinies pour les cas courants
  variant?: 'text' | 'heading' | 'avatar' | 'button' | 'card' | 'custom';
}

export function Skeleton({ className, variant = 'custom' }: SkeletonProps) {
  const variantClass: Record<string, string> = {
    text: 'h-4 w-full',
    heading: 'h-6 w-2/5',
    avatar: 'w-10 h-10',
    button: 'h-10 w-28',
    card: 'h-40 w-full',
    custom: '',
  };

  return (
    <div
      className={cn(
        // Animation shimmer — compatible avec les thèmes clair et sombre
        'relative overflow-hidden',
        'bg-[var(--bg-surface-alt)]',
        // Shimmer via pseudo-élément simulé avec gradient animé
        'before:absolute before:inset-0',
        'before:bg-gradient-to-r',
        'before:from-transparent',
        'before:via-[rgba(255,255,255,0.06)]',
        'before:to-transparent',
        'before:translate-x-[-100%]',
        'before:animate-[shimmer_1.6s_ease-in-out_infinite]',
        variantClass[variant],
        className,
      )}
      aria-hidden="true"
    />
  );
}

