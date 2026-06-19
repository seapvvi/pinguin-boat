'use client';

import { useEffect, useRef, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { useSSE } from '@/hooks/useSSE';

interface Popup {
  message: string;
  duration: number;
}

export default function OwnerPopupListener() {
  const [popup, setPopup] = useState<Popup | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [canClose, setCanClose] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useSSE({
    onPopup: (p) => {
      setPopup(p);
      setRemaining(p.duration);
      setCanClose(false);
    },
  });

  useEffect(() => {
    if (!popup) return;
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setCanClose(true);
          clearInterval(countdownRef.current!);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [popup]);

  if (!popup) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        backgroundColor: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--accent)',
          borderRadius: 8,
          padding: 28,
          maxWidth: 480,
          width: '100%',
          display: 'flex', flexDirection: 'column', gap: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Megaphone size={18} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Message de l&apos;administrateur
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
              Pinguin BOAT
            </p>
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-surface-alt)',
          borderRadius: 6,
          padding: '12px 14px',
          fontSize: 14,
          color: 'var(--text-primary)',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {popup.message}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            disabled={!canClose}
            onClick={() => setPopup(null)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', fontSize: 13, fontWeight: 500,
              backgroundColor: canClose ? 'var(--accent)' : 'var(--bg-surface-alt)',
              color: canClose ? 'var(--bg-primary)' : 'var(--text-secondary)',
              border: 'none', borderRadius: 6,
              cursor: canClose ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s ease',
            }}
          >
            {canClose ? 'Fermer' : `Attendre ${remaining}s`}
          </button>
        </div>
      </div>
    </div>
  );
}
