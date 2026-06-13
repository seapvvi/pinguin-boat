'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useConfetti } from '@/hooks/useConfetti';

interface InviteBotButtonProps {
  guildId?: string;
  className?: string;
  children?: React.ReactNode;
}

export function InviteBotButton({ guildId, className, children }: InviteBotButtonProps) {
  const [url, setUrl] = useState<string | null>(null);
  const { fire } = useConfetti();

  useEffect(() => {
    const q = guildId ? `?guild_id=${guildId}` : '';
    api.get<{ success: boolean; data: { url: string } }>(`/api/bot/invite${q}`)
      .then((res) => {
        const url = (res as { data?: { url: string } }).data?.url;
        if (url) setUrl(url);
      })
      .catch(() => {});
  }, [guildId]);

  if (!url) {
    return (
      <span className={className ?? 'inline-flex items-center gap-2 px-4 py-2 text-sm opacity-50'}>
        <Plus size={14} /> Chargement…
      </span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => fire('invite')}
      className={
        className ??
        'inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-[var(--radius-sm)] border bg-[var(--accent)] text-[var(--bg-primary)] border-[var(--accent)] hover:opacity-90 no-underline'
      }
    >
      {children ?? (
        <>
          <Plus size={14} /> Inviter le bot
        </>
      )}
    </a>
  );
}
