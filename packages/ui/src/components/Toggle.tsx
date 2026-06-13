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
  const trackW = size === 'sm' ? 28 : 36;
  const trackH = size === 'sm' ? 16 : 20;
  const thumbSize = size === 'sm' ? 10 : 14;
  const thumbOff = 3;
  const thumbOn = trackW - thumbSize - thumbOff;

  return (
    <label
      className={cn(
        'inline-flex items-center gap-2 cursor-pointer select-none',
        disabled && 'opacity-40 cursor-not-allowed pointer-events-none'
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => !disabled && onChange(!checked)}
        className="relative shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
        style={{
          width: trackW,
          height: trackH,
          borderRadius: 0,
          border: `2px solid ${checked ? 'var(--accent-primary)' : 'var(--border-color-strong, #555)'}`,
          backgroundColor: checked ? 'var(--accent-primary)' : 'transparent',
          transition: 'background-color 150ms ease, border-color 150ms ease',
          padding: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <motion.span
          animate={{ x: checked ? thumbOn : thumbOff }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          style={{
            position: 'absolute',
            top: '50%',
            y: '-50%',
            width: thumbSize,
            height: thumbSize,
            borderRadius: 0,
            backgroundColor: checked ? 'white' : 'var(--text-secondary)',
          }}
        />
      </button>
      {label && (
        <span className="text-sm text-[var(--text-primary)]">{label}</span>
      )}
    </label>
  );
}
