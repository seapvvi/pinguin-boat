'use client';
import { useState } from 'react';
import { motion } from 'motion/react';
import { Input, Button } from '@pinguin/ui';

interface ConfirmActionModalProps {
  action: string;
  confirmWord: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmActionModal({ action, confirmWord, description, onConfirm, onCancel }: ConfirmActionModalProps) {
  const [input, setInput] = useState('');
  const match = input.toUpperCase() === confirmWord.toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        padding: 16,
      }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 400,
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          padding: 24,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          Confirmer : {action}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.5 }}>
          {description}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Tape <strong style={{ color: 'var(--accent)' }}>{confirmWord}</strong> pour confirmer :
        </p>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={confirmWord}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
          <Button disabled={!match} onClick={onConfirm}>
            Confirmer
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
