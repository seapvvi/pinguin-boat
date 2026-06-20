'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { Button } from '@pinguin/ui';

interface Props {
  action: string;
  confirmWord: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmActionModal({
  action,
  confirmWord,
  description,
  onConfirm,
  onCancel,
}: Props) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isMatch = inputValue.trim().toUpperCase() === confirmWord.toUpperCase();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onCancel}
        className="fixed inset-0 z-50 flex items-center justify-center
                   bg-black/50 backdrop-blur-sm"
      >
        <motion.div
          key="panel"
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-sm mx-4 rounded-[var(--radius)]
                     bg-[var(--bg-surface)] border border-[var(--border-color)]
                     p-6 shadow-xl"
        >
          <button
            type="button"
            onClick={onCancel}
            className="absolute top-3 right-3 p-1.5 rounded
                       text-[var(--text-secondary)]
                       hover:text-[var(--text-primary)]
                       hover:bg-[var(--bg-surface-alt)]
                       transition-colors"
            aria-label="Fermer"
          >
            <X size={16} />
          </button>

          <h2 className="text-base font-semibold text-[var(--text-primary)] mb-2">
            Confirmer : {action}
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            {description}
          </p>

          <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">
            Tape{' '}
            <strong className="text-[var(--text-primary)] font-mono">
              {confirmWord}
            </strong>{' '}
            pour confirmer :
          </label>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isMatch) onConfirm();
            }}
            placeholder={confirmWord}
            className="w-full px-3 py-2 text-sm rounded-[var(--radius-sm)]
                       bg-transparent border border-[var(--border-color)]
                       text-[var(--text-primary)] font-mono
                       focus:outline-none focus:border-[var(--accent)]
                       transition-colors mb-4"
            autoComplete="off"
            spellCheck={false}
          />

          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={onCancel} type="button">
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={onConfirm}
              disabled={!isMatch}
              type="button"
            >
              Confirmer
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
