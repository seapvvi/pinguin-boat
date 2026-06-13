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
  const trackW = size === 'sm' ? 32 : 40;
  const trackH = size === 'sm' ? 18 : 22;
  const thumbSize = size === 'sm' ? 12 : 16;
  const thumbOff = size === 'sm' ? 3 : 4;
  const thumbOn = trackW - thumbSize - thumbOff;

  return (
    <label
      className={cn(
        'inline-flex items-center gap-2 select-none',
        disabled && 'opacity-40 pointer-events-none'
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
        className="relative shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
        style={{
          width: trackW,
          height: trackH,
          borderRadius: trackH / 2,
          border: 'none',
          backgroundColor: checked ? 'var(--accent-primary)' : 'var(--border-color)',
          transition: 'background-color 150ms ease',
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
            borderRadius: thumbSize / 2,
            backgroundColor: checked ? 'var(--thumb-checked)' : 'var(--text-secondary)',
          }}
        />
      </button>
      {label && (
        <span className="text-sm text-[var(--text-primary)] cursor-pointer">{label}</span>
      )}
    </label>
  );
}
