'use client';

import { useEffect, useState } from 'react';
import { Avatar } from '@pinguin/ui';
import { Menu, LogOut } from 'lucide-react';
import ThemeSelector from './ThemeSelector';
import ServerSelector from './ServerSelector';
import { getAvatarUrl } from '@/lib/utils';
import { api } from '@/lib/api';

interface HeaderProps {
  user: {
    id: string;
    username: string;
    avatar: string | null;
  } | null;
  onMenuToggle: () => void;
  onLogout: () => void;
  guildId?: string;
}

export default function Header({ user, onMenuToggle, onLogout, guildId }: HeaderProps) {
  const [isDonor, setIsDonor] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.get<{ data: { donors: { userId: string }[] } }>('/api/donors')
      .then((res) => {
        const donors = (res as any)?.data?.donors as { userId: string }[] | undefined;
        if (donors?.some((d) => d.userId === user.id)) setIsDonor(true);
      })
      .catch(() => {});
  }, [user?.id]);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 60,
        padding: '0 24px',
        backgroundColor: 'var(--bg-header)',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar
              src={getAvatarUrl(user) ?? undefined}
              name={user.username}
              size={28}
            />
            <span
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Bienvenue, {user.username}
              {isDonor && (
                <span title="Donateur" style={{ fontSize: 16, lineHeight: 1 }}>💙</span>
              )}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onMenuToggle}
          title="Menu"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            border: 'none',
            borderRadius: 8,
            background: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Menu size={20} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {guildId && <ServerSelector guildId={guildId} />}
        <ThemeSelector />
        <button
          type="button"
          onClick={onLogout}
          title="Déconnexion"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            border: 'none',
            borderRadius: 8,
            background: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'background-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)';
            e.currentTarget.style.color = 'var(--error)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
