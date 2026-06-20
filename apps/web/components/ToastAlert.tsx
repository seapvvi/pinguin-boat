'use client';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ToastAlertProps {
  show: boolean;
  message: string;
  type?: 'error' | 'warning';
  onDismiss: () => void;
  duration?: number;
}

export function ToastAlert({ show, message, type = 'error', onDismiss, duration = 5000 }: ToastAlertProps) {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [show, onDismiss, duration]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.95 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 100,
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px',
            backgroundColor: type === 'error'
              ? 'color-mix(in srgb, var(--error) 10%, var(--bg-surface))'
              : 'color-mix(in srgb, var(--warning) 10%, var(--bg-surface))',
            border: `1px solid ${type === 'error' ? 'var(--error)' : 'var(--warning)'}`,
            color: type === 'error' ? 'var(--error)' : 'var(--warning)',
            fontSize: 13, fontWeight: 500,
            maxWidth: 360,
          }}
        >
          <span>{message}</span>
          <button
            type="button"
            onClick={onDismiss}
            style={{
              background: 'none', border: 'none', color: 'inherit',
              cursor: 'pointer', padding: 2, display: 'flex',
              fontSize: 16, lineHeight: 1,
            }}
          >
            &times;
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
