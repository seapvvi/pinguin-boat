'use client';

import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, ShieldAlert } from 'lucide-react';

const SESSION_KEY = 'pinguin_owner_auth';

interface Props {
  children: React.ReactNode;
}

export default function OwnerPasswordGate({ children }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const val = sessionStorage.getItem(SESSION_KEY);
    if (val === '1') setUnlocked(true);
    setChecking(false);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError('');
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
      const res = await fetch(`${apiUrl}/api/owner/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        sessionStorage.setItem(SESSION_KEY, '1');
        setUnlocked(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.message || 'Mot de passe incorrect.');
      }
    } catch {
      setError('Erreur de connexion.');
    } finally {
      setLoading(false);
    }
  }

  if (checking) return null;
  if (unlocked) return <>{children}</>;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', padding: 24,
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          padding: 32,
          maxWidth: 360,
          width: '100%',
          display: 'flex', flexDirection: 'column', gap: 20,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            backgroundColor: 'var(--bg-surface-alt)',
            border: '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldAlert size={22} style={{ color: 'var(--accent)' }} />
          </div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Accès Owner restreint
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, textAlign: 'center' }}>
            Entrez le mot de passe owner pour accéder au panel d&apos;administration.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              backgroundColor: 'var(--bg-surface-alt)',
              border: `1px solid ${error ? 'var(--error)' : 'var(--border-color)'}`,
              borderRadius: 6, padding: '8px 12px',
            }}>
              <Lock size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="Mot de passe owner"
                autoFocus
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  fontSize: 14, color: 'var(--text-primary)',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-secondary)' }}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && (
            <p style={{ fontSize: 12, color: 'var(--error)', margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px 16px', fontSize: 13, fontWeight: 500,
              backgroundColor: 'var(--accent)', color: 'var(--bg-primary)',
              border: 'none', borderRadius: 6, cursor: loading ? 'wait' : 'pointer',
              opacity: (loading || !password.trim()) ? 0.6 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? (
              <svg className="animate-spin" width={14} height={14} viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : <Lock size={14} />}
            Accéder au panel
          </button>
        </form>
      </div>
    </div>
  );
}
