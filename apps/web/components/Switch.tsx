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
      className="relative inline-flex shrink-0 items-center"
      style={{
        width: 40,
        height: 22,
        backgroundColor: checked ? 'var(--accent)' : 'var(--toggle-bg-off)',
        border: checked ? '2px solid var(--accent)' : '2px solid var(--border-color-strong)',
        borderRadius: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background-color 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms ease',
        boxShadow: checked ? '0 0 0 3px rgba(34, 197, 94, 0.15)' : 'none',
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
          transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      />
    </button>
  );
}
