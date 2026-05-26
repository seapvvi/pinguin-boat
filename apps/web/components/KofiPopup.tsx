'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';

const KOFI_URL = 'https://ko-fi.com/pvvi';
const DELAY_MS = 3000;

interface KofiPopupProps {
  onClose: () => void;
}

export default function KofiPopup({ onClose }: KofiPopupProps) {
  const [remaining, setRemaining] = useState(Math.ceil(DELAY_MS / 1000));
  const [canClose, setCanClose] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          setCanClose(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, []);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          padding: 28,
          maxWidth: 440,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>💙</span>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Avant de continuer
          </h2>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-surface-alt)',
            border: '1px solid var(--border-color)',
            borderRadius: 6,
            padding: '12px 14px',
            fontSize: 13,
            color: 'var(--text-primary)',
            lineHeight: 1.6,
          }}
        >
          <p style={{ margin: '0 0 8px 0', fontWeight: 500 }}>📌 Important pour débloquer vos privilèges :</p>
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)' }}>
            <li>La somme minimale pour obtenir les privilèges est de <strong style={{ color: 'var(--text-primary)' }}>5 €</strong>.</li>
            <li style={{ marginTop: 4 }}>
              Lors du paiement, <strong style={{ color: 'var(--accent)' }}>indiquez votre ID Discord</strong> dans le message (ex : <code style={{ fontSize: 11, background: 'var(--bg-primary)', padding: '1px 4px', borderRadius: 3 }}>123456789012345678</code>).
            </li>
            <li style={{ marginTop: 4 }}>Sans votre ID Discord, les privilèges ne pourront pas être attribués.</li>
          </ul>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
          Vous pouvez trouver votre ID Discord en activant le Mode Développeur dans les paramètres Discord, puis en faisant clic droit sur votre profil.
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          {canClose ? (
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '7px 14px', fontSize: 13,
                background: 'none', border: '1px solid var(--border-color)',
                borderRadius: 6, cursor: 'pointer',
                color: 'var(--text-secondary)',
              }}
            >
              Annuler
            </button>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Veuillez lire… ({remaining}s)
            </span>
          )}
          <a
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={canClose ? onClose : undefined}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', fontSize: 13, fontWeight: 500,
              backgroundColor: canClose ? 'var(--accent)' : 'var(--bg-surface-alt)',
              color: canClose ? 'var(--bg-primary)' : 'var(--text-secondary)',
              border: `1px solid ${canClose ? 'var(--accent)' : 'var(--border-color)'}`,
              borderRadius: 6,
              textDecoration: 'none',
              pointerEvents: canClose ? 'auto' : 'none',
              cursor: canClose ? 'pointer' : 'default',
              transition: 'background-color 0.2s, color 0.2s',
            }}
          >
            <ExternalLink size={13} /> Faire un don sur Ko-fi
          </a>
        </div>
      </div>
    </div>
  );
}
