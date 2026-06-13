'use client';
import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../utils/cn';

const SPRING_SNAPPY = {
  type: 'spring' as const,
  stiffness: 600,
  damping: 35,
  mass: 0.8,
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ ...SPRING_SNAPPY }}
            className={cn(
              'relative w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-color)] p-6',
              className,
            )}
            style={{ borderRadius: 0 }}
          >
            {title && (
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
                <button
                  onClick={onClose}
                  className="flex items-center justify-center w-6 h-6 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] transition-colors duration-150"
                  style={{ borderRadius: 0 }}
                >
                  <X size={14} />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
