'use client';
import { motion } from 'motion/react';

interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

export function Switch({ checked, onChange, disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className="relative inline-flex shrink-0 items-center transition-colors duration-200"
      style={{
        width: 40,
        height: 22,
        backgroundColor: checked ? 'var(--accent)' : 'var(--toggle-bg-off)',
        border: checked ? '2px solid var(--accent)' : '2px solid var(--border-color-strong)',
        borderRadius: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <motion.span
        animate={{ x: checked ? 18 : 2 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        style={{
          width: 14,
          height: 14,
          backgroundColor: 'var(--toggle-thumb)',
          borderRadius: 0,
        }}
      />
    </button>
  );
}
