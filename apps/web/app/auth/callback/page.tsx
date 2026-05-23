'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { handleCallback } from '@/lib/auth';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');

    if (!code) {
      setError('Code d\'autorisation manquant');
      return;
    }

    handleCallback(code)
      .then(() => {
        router.replace('/dashboard');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Erreur d\'authentification');
      });
  }, [searchParams, router]);

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--bg-primary)',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            padding: '32px 40px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            maxWidth: 400,
          }}
        >
          <h1
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: 'var(--error)',
              margin: '0 0 8px',
            }}
          >
            Erreur d&apos;authentification
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 24px' }}>
            {error}
          </p>
          <button
            onClick={() => router.replace('/auth/login')}
            style={{
              padding: '10px 24px',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              background: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: '2px solid var(--border-color)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
        }}
      />
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
        Authentification en cours…
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--bg-primary)',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            border: '2px solid var(--border-color)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite',
          }}
        />
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
