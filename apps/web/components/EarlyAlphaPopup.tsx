'use client';

import { useEffect, useState } from 'react';
import { Button } from '@pinguin/ui';
import { getUser } from '@/lib/auth';
import { useConfetti } from '@/hooks/useConfetti';

const DISCORD_URL = 'https://discord.gg/EJHhcYkXMQ';
const STORAGE_PREFIX = 'pinguin-alpha-seen-';
const WAIT_SECONDS = 5;

export function EarlyAlphaPopup() {
  const [open, setOpen] = useState(false);
  const [countdown, setCountdown] = useState(WAIT_SECONDS);
  const [ready, setReady] = useState(false);
  const { fire } = useConfetti();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await getUser();
      if (cancelled) return;
      if (!user) return;
      const key = `${STORAGE_PREFIX}${user.id}`;
      if (localStorage.getItem(key) === '1') return;
      setOpen(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!open) return;
    setCountdown(WAIT_SECONDS);
    setReady(false);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          setReady(true);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [open]);

  const close = async () => {
    if (!ready) return;
    const user = await getUser();
    if (user) localStorage.setItem(`${STORAGE_PREFIX}${user.id}`, '1');
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="max-w-md w-full rounded-[var(--radius)] border border-[var(--border-color)] p-6 shadow-xl"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          🚧 Projet en Early Alpha
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Pinguin Boat est en cours de développement actif. Vous pouvez rencontrer des bugs ou des
          fonctionnalités incomplètes.
        </p>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Rejoignez notre serveur Discord pour reporter des bugs et faire des suggestions :
        </p>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="flex-1" onClick={() => fire('discord')}>
            <Button className="w-full">Rejoindre le Discord</Button>
          </a>
          <Button variant="secondary" className="flex-1" onClick={close} disabled={!ready}>
            {ready ? "J'ai compris" : `Patientez (${countdown}s)`}
          </Button>
        </div>
        <p className="text-xs text-[var(--text-secondary)] text-center">
          Ce message ne s&apos;affichera qu&apos;une seule fois après votre première connexion.
        </p>
      </div>
    </div>
  );
}
