'use client';

import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, ShieldAlert, KeyRound } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

type Step = 'checking' | 'password' | '2fa' | 'unlocked';

export default function OwnerPasswordGate({ children }: Props) {
  const [step, setStep] = useState<Step>('checking');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/owner/status', {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.verified) {
          if (data.data.twoFAEnabled && !data.data.twoFAVerified) {
            setStep('2fa');
          } else {
            setStep('unlocked');
          }
        } else {
          setStep('password');
        }
      })
      .catch(() => setStep('password'));
  }, []);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/owner/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.data?.requires2FA) {
          setStep('2fa');
        } else {
          setStep('unlocked');
        }
      } else {
        setError(data?.message || 'Mot de passe incorrect.');
      }
    } catch {
      setError('Erreur de connexion.');
    } finally {
      setLoading(false);
    }
  }

  async function handle2FASubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/owner/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStep('unlocked');
      } else {
        setError(data?.message || 'Code invalide.');
      }
    } catch {
      setError('Erreur de connexion.');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'unlocked') return <>{children}</>;

  const containerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '60vh', padding: 24,
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: 32,
    maxWidth: 360,
    width: '100%',
    display: 'flex', flexDirection: 'column', gap: 20,
  };

  const inputContainerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    backgroundColor: 'var(--bg-surface-alt)',
    border: `1px solid ${error ? 'var(--error)' : 'var(--border-color)'}`,
    borderRadius: 6, padding: '8px 12px',
  };

  const inputStyle: React.CSSProperties = {
    flex: 1, background: 'none', border: 'none', outline: 'none',
    fontSize: 14, color: 'var(--text-primary)',
  };

  const buttonStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '9px 16px', fontSize: 13, fontWeight: 500,
    backgroundColor: 'var(--accent)', color: 'var(--bg-primary)',
    border: 'none', borderRadius: 6, cursor: loading ? 'wait' : 'pointer',
    opacity: (loading) ? 0.6 : 1,
    transition: 'opacity 0.15s',
  };

  if (step === 'checking') return null;

  if (step === 'password') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
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

          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={inputContainerStyle}>
              <Lock size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="Mot de passe owner"
                autoFocus
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-secondary)' }}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {error && (
              <p style={{ fontSize: 12, color: 'var(--error)', margin: 0 }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password.trim()}
              style={{ ...buttonStyle, opacity: (loading || !password.trim()) ? 0.6 : 1 }}
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

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            backgroundColor: 'var(--bg-surface-alt)',
            border: '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <KeyRound size={22} style={{ color: 'var(--accent)' }} />
          </div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Double authentification
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, textAlign: 'center' }}>
            Entrez le code à 6 chiffres de votre application d&apos;authentification.
          </p>
        </div>

        <form onSubmit={handle2FASubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={inputContainerStyle}>
            <input
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              placeholder="000000"
              maxLength={6}
              autoFocus
              style={{ ...inputStyle, textAlign: 'center', letterSpacing: 4, fontSize: 18 }}
            />
          </div>

          {error && (
            <p style={{ fontSize: 12, color: 'var(--error)', margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || code.length < 6}
            style={{ ...buttonStyle, opacity: (loading || code.length < 6) ? 0.6 : 1 }}
          >
            {loading ? (
              <svg className="animate-spin" width={14} height={14} viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : <KeyRound size={14} />}
            Vérifier
          </button>
        </form>
      </div>
    </div>
  );
}
