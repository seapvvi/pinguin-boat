'use client';

import { useState } from 'react';
import { Button } from '@pinguin/ui';

const DISCORD_URL = 'https://discord.gg/EJHhcYkXMQ';

export function EarlyAlphaPopup() {
  const [open, setOpen] = useState(true);

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
          <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button className="w-full">Rejoindre le Discord</Button>
          </a>
          <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
            J&apos;ai compris
          </Button>
        </div>
        <p className="text-xs text-[var(--text-secondary)] text-center">
          Cette popup apparaît à chaque visite tant que le projet est en alpha.
        </p>
      </div>
    </div>
  );
}
