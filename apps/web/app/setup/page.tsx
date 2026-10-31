'use client';

import { useEffect, useState } from 'react';

type Step = 'loading' | 'password' | 'form' | 'done' | 'locked';

interface FormState {
  clientId: string;
  clientSecret: string;
  token: string;
  ownerId: string;
  publicKey: string;
  devGuildId: string;
  databaseUrl: string;
  ownerPassword: string;
  sessionSecret: string;
  botInternalSecret: string;
  appUrl: string;
  apiUrl: string;
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 13,
  fontFamily: 'var(--font-jetbrains), monospace',
  color: 'var(--text-primary)',
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-sm)',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
  marginBottom: 6,
};

const sectionStyle: React.CSSProperties = {
  border: '1px solid var(--border-color)',
  background: 'var(--bg-surface)',
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

function Field({
  label, value, onChange, type = 'text', placeholder = '', hint = '',
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        style={inputStyle}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      {hint && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export default function SetupPage() {
  const [step, setStep] = useState<Step>('loading');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dbTest, setDbTest] = useState('');
  const [form, setForm] = useState<FormState>({
    clientId: '', clientSecret: '', token: '', ownerId: '', publicKey: '', devGuildId: '',
    databaseUrl: 'postgresql://pinguin:password@localhost:5432/pinguinboat',
    ownerPassword: '',
    sessionSecret: randomHex(32),
    botInternalSecret: randomHex(32),
    appUrl: '', apiUrl: '',
  });

  const set = (key: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  useEffect(() => {
    fetch('/api/setup/status')
      .then((r) => r.json())
      .then((d: { setupRequired?: boolean }) => {
        setStep(d.setupRequired ? 'password' : 'locked');
      })
      .catch(() => setStep('password'));

    const { protocol, hostname } = window.location;
    setForm((f) => ({
      ...f,
      appUrl: f.appUrl || `${protocol}//${hostname}:3000`,
      apiUrl: f.apiUrl || `${protocol}//${hostname}:4000`,
    }));
  }, []);

  async function verifyPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/setup/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        setStep('form');
      } else {
        setError(data.error ?? 'Mot de passe incorrect.');
      }
    } catch {
      setError('Erreur réseau. Réessayez.');
    } finally {
      setBusy(false);
    }
  }

  async function testDb() {
    setBusy(true);
    setDbTest('');
    try {
      const res = await fetch('/api/setup/test-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseUrl: form.databaseUrl }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      setDbTest(data.ok ? '✓ Connexion réussie' : `✗ ${data.error ?? 'Échec'}`);
    } catch {
      setDbTest('✗ Erreur réseau');
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, ...form }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        setStep('done');
      } else {
        setError(data.error ?? 'Erreur inconnue.');
      }
    } catch {
      setError('Erreur réseau. Réessayez.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '48px 16px',
      fontFamily: 'var(--font-jetbrains), monospace',
    }}>
      <div style={{ width: '100%', maxWidth: 640 }}>
        {/* En-tête */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/logo.svg" alt="Pinguin" width={56} height={56} style={{ objectFit: 'contain' }} />
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', margin: '16px 0 6px' }}>
            Configuration initiale
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            Pinguin BOAT — premier démarrage
          </p>
        </div>

        {step === 'loading' && (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Chargement…</p>
        )}

        {step === 'locked' && (
          <div style={sectionStyle}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, textAlign: 'center' }}>
              La configuration est déjà terminée. Cette page est verrouillée.
            </p>
          </div>
        )}

        {step === 'password' && (
          <form onSubmit={verifyPassword} style={sectionStyle}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              Entrez le mot de passe de setup défini dans votre{' '}
              <code style={{ color: 'var(--accent)' }}>.env</code> (variable{' '}
              <code style={{ color: 'var(--accent)' }}>SETUP_PASSWORD</code>).
            </p>
            <Field
              label="Mot de passe de setup"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
            />
            {error && <div style={{ fontSize: 12, color: 'var(--error)' }}>{error}</div>}
            <button type="submit" disabled={busy || !password} className="cta-discord" style={{ border: 'none', cursor: 'pointer', justifyContent: 'center' }}>
              {busy ? 'Vérification…' : 'Continuer'}
            </button>
          </form>
        )}

        {step === 'form' && (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Discord */}
            <div style={sectionStyle}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Discord
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                Portail développeur → discord.com/developers/applications
              </p>
              <Field label="Client ID" value={form.clientId} onChange={set('clientId')} placeholder="123456789012345678" hint="General Information → Application ID" />
              <Field label="Client Secret" value={form.clientSecret} onChange={set('clientSecret')} hint="OAuth2 → Client Secret" />
              <Field label="Token du bot" value={form.token} onChange={set('token')} hint="Bot → Token (regénérez-le si partagé)" />
              <Field label="Votre ID Discord (owner)" value={form.ownerId} onChange={set('ownerId')} placeholder="123456789012345678" hint="Clic droit sur votre profil → Copier l'ID (mode dev activé)" />
              <Field label="Clé publique" value={form.publicKey} onChange={set('publicKey')} hint="General Information → Public Key (64 caractères)" />
              <Field label="ID serveur de test (optionnel)" value={form.devGuildId} onChange={set('devGuildId')} hint="Commandes déployées instantanément sur ce serveur en dev" />
            </div>

            {/* Base de données */}
            <div style={sectionStyle}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Base de données
              </h2>
              <Field label="URL PostgreSQL" value={form.databaseUrl} onChange={set('databaseUrl')} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button type="button" onClick={testDb} disabled={busy} className="cta-outline" style={{ cursor: 'pointer', fontSize: 12 }}>
                  Tester la connexion
                </button>
                {dbTest && (
                  <span style={{ fontSize: 12, color: dbTest.startsWith('✓') ? 'var(--success)' : 'var(--error)' }}>
                    {dbTest}
                  </span>
                )}
              </div>
            </div>

            {/* Sécurité */}
            <div style={sectionStyle}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Sécurité
              </h2>
              <Field label="Mot de passe owner (dashboard)" type="password" value={form.ownerPassword} onChange={set('ownerPassword')} hint="12 caractères minimum — pour le panel owner" />
              <div>
                <label style={labelStyle}>Session secret</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input style={{ ...inputStyle, flex: 1 }} value={form.sessionSecret} onChange={(e) => set('sessionSecret')(e.target.value)} spellCheck={false} />
                  <button type="button" className="cta-outline" style={{ cursor: 'pointer', fontSize: 12 }} onClick={() => set('sessionSecret')(randomHex(32))}>
                    ↻
                  </button>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Secret interne bot</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input style={{ ...inputStyle, flex: 1 }} value={form.botInternalSecret} onChange={(e) => set('botInternalSecret')(e.target.value)} spellCheck={false} />
                  <button type="button" className="cta-outline" style={{ cursor: 'pointer', fontSize: 12 }} onClick={() => set('botInternalSecret')(randomHex(32))}>
                    ↻
                  </button>
                </div>
              </div>
            </div>

            {/* URLs */}
            <div style={sectionStyle}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                URLs
              </h2>
              <Field label="URL du site" value={form.appUrl} onChange={set('appUrl')} hint="Pré-remplie avec l'adresse actuelle" />
              <Field label="URL de l'API" value={form.apiUrl} onChange={set('apiUrl')} />
            </div>

            {error && <div style={{ fontSize: 12, color: 'var(--error)' }}>{error}</div>}

            <button type="submit" disabled={busy} className="cta-discord" style={{ border: 'none', cursor: 'pointer', justifyContent: 'center', padding: '14px 18px' }}>
              {busy ? 'Écriture…' : 'Enregistrer la configuration'}
            </button>
          </form>
        )}

        {step === 'done' && (
          <div style={sectionStyle}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)', margin: 0 }}>
              ✓ Configuration enregistrée
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>
              Les fichiers <code style={{ color: 'var(--accent)' }}>.env</code> (racine) et{' '}
              <code style={{ color: 'var(--accent)' }}>apps/web/.env.local</code> ont été écrits.
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>
              Dans le terminal, arrêtez puis relancez :
            </p>
            <pre style={{
              fontSize: 12, background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
              padding: '12px 14px', color: 'var(--text-primary)', overflowX: 'auto', margin: 0,
            }}>
{`pnpm dev

# puis dans un autre terminal :
pnpm db:push`}
            </pre>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.7 }}>
              N'oubliez pas d'ajouter l'URL de callback OAuth2 dans le portail Discord :{' '}
              <code style={{ color: 'var(--accent)' }}>{form.appUrl}/auth/callback</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
