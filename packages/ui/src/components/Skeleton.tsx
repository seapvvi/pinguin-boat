import React from 'react';
import { cn } from '../utils/cn';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: boolean;
}

export function Skeleton({ className, width, height, rounded = false }: SkeletonProps) {
  return (
    <div
      className={cn(
        'bg-[var(--bg-surface-alt)]',
        rounded ? 'rounded-[0px]' : 'rounded-[var(--radius-sm)]',
        className,
      )}
      style={{
        width,
        height,
        animation: 'pinguin-shimmer 1.5s infinite ease-in-out',
        backgroundImage: 'linear-gradient(90deg, var(--bg-surface-alt) 0%, var(--bg-surface) 50%, var(--bg-surface-alt) 100%)',
        backgroundSize: '200% 100%',
      }}
    />
  );
}
