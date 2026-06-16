'use client';
import { motion } from 'motion/react';
import { cn } from '../utils/cn';

const SPRING_BOUNCY = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 22,
  mass: 0.9,
};

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
        !disabled && 'cursor-pointer',
      )}
      onClick={(e) => {
        if (!disabled) {
          e.preventDefault();
          onChange(!checked);
        }
      }}
    >
      <motion.div
        animate={checked ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        style={{ display: 'inline-flex' }}
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
            'focus-visible:outline-[var(--accent-primary)]',
          )}
          style={{
            width: trackW,
            height: trackH,
            borderRadius: 0,
            border: checked ? '2px solid var(--accent-primary)' : '2px solid var(--border-color-strong)',
      backgroundColor: checked ? 'var(--accent-primary)' : 'var(--toggle-bg-off)',
      transition: 'background-color 150ms ease, border-color 150ms ease',
      padding: 0,
      cursor: disabled ? 'not-allowed' : 'pointer',
      boxSizing: 'content-box',
      boxShadow: checked ? 'none' : 'inset 0 0 0 1px color-mix(in srgb, var(--text-secondary) 15%, transparent)',
          }}
        >
          <motion.span
            animate={{ x: checked ? thumbOn : thumbOff }}
            initial={false}
            transition={SPRING_BOUNCY}
            style={{
              position: 'absolute',
              top: padding,
              left: 0,
              width: thumbSize,
              height: thumbSize,
              borderRadius: 0,
              backgroundColor: '#ffffff',
            }}
          />
        </button>
      </motion.div>

      {label && <span className="text-sm text-[var(--text-primary)]">{label}</span>}
    </label>
  );
}

