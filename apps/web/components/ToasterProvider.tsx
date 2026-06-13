'use client';
import { Toaster } from 'sonner';

export function ToasterProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: { borderRadius: 0, background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' },
      }}
    />
  );
}
