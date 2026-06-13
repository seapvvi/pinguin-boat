'use client';
import { motion } from 'motion/react';
import { cn } from '../utils/cn';

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
  size?: 'sm' | 'md';
}

export function Toggle({ checked, onChange, disabled = false, label, size = 'md' }: ToggleProps) {
  // Proportions corrigées : thumb = trackH - 8px pour avoir 4px de marge de chaque côté
  const trackW = size === 'sm' ? 32 : 40;
  const trackH = size === 'sm' ? 18 : 22;
  const padding = 3; // marge intérieure fixe de chaque côté
  const thumbSize = trackH - padding * 2; // sm: 12px, md: 16px
  const thumbOff = padding; // position X quand OFF
  const thumbOn = trackW - thumbSize - padding; // position X quand ON

  return (
    <label
      className={cn(
        'inline-flex items-center gap-2 select-none',
        disabled && 'opacity-40 pointer-events-none',
        !disabled && 'cursor-pointer'
      )}
      onClick={(e) => {
        if (!disabled) {
          e.preventDefault();
          onChange(!checked);
        }
      }}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        tabIndex={0}
        className={cn(
          'relative shrink-0',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
          'focus-visible:outline-[var(--accent-primary)]'
        )}
        style={{
          width: trackW,
          height: trackH,
          borderRadius: 0,
          border: checked ? '2px solid var(--accent-primary)' : '2px solid var(--border-color-strong)',
          backgroundColor: checked ? 'var(--accent-primary)' : 'transparent',
          transition: 'background-color 150ms ease, border-color 150ms ease',
          padding: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxSizing: 'content-box'
        }}
      >
        <motion.span
          animate={{ x: checked ? thumbOn : thumbOff }}
          initial={false}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          style={{
            position: 'absolute',
            top: padding,
            left: 0,
            width: thumbSize,
            height: thumbSize,
            borderRadius: 0,
            backgroundColor: checked ? '#ffffff' : 'var(--text-primary)'
          }}
        />
      </button>

      {label && <span className="text-sm text-[var(--text-primary)]">{label}</span>}
    </label>
  );
}

