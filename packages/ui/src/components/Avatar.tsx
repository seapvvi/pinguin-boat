import React from 'react';
import { cn } from '../utils/cn';

interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: number;
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const backgroundColors = [
  '#e0e0e0',
  '#c0c0c0',
  '#a0a0a0',
  '#b0b0b0',
  '#d0d0d0',
  '#909090',
];

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return backgroundColors[Math.abs(hash) % backgroundColors.length];
}

export function Avatar({ src, alt = '', name, size = 32, className }: AvatarProps) {
  const initials = name ? getInitials(name) : '?';
  const bgColor = name ? hashColor(name) : '#666';

  if (src) {
    return (
      <img
        src={src}
        alt={alt || name || 'Avatar'}
        width={size}
        height={size}
        className={cn('rounded-full object-cover flex-shrink-0', className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center flex-shrink-0 font-medium select-none',
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: bgColor,
        color: '#111',
        fontSize: size * 0.4,
      }}
      aria-label={alt || name || 'Avatar'}
    >
      {initials}
    </div>
  );
}
