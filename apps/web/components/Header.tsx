'use client';

import { Logo } from '@pinguin/ui';
import { Menu, LogOut } from 'lucide-react';
import ThemeSelector from './ThemeSelector';
import ServerSelector from './ServerSelector';

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
        <Logo withText size={28} />
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
