'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { ThemeName, themes } from '@pinguin/shared';
import { useTheme } from '@pinguin/ui';
import { Palette, Check, ChevronDown, Lock } from 'lucide-react';
import { api } from '@/lib/api';

const DONOR_THEMES: ThemeName[] = Object.values(ThemeName).filter(
  (t) => t !== ThemeName.OLED && t !== ThemeName.DARK && t !== ThemeName.LIGHT
);

const themeLabels: Record<ThemeName, string> = {
  [ThemeName.OLED]: 'OLED',
  [ThemeName.DARK]: 'Sombre',
  [ThemeName.LIGHT]: 'Clair',
  [ThemeName.CATPPUCCIN]: 'Catppuccin',
  [ThemeName.NORD]: 'Nord',
  [ThemeName.DRACULA]: 'Dracula',
  [ThemeName.GRUVBOX]: 'Gruvbox',
  [ThemeName.TOKYO_NIGHT]: 'Tokyo Night',
  [ThemeName.ROSE_PINE]: 'Rose Pine',
  [ThemeName.MONOKAI]: 'Monokai',
  [ThemeName.GOLD]: 'Gold',
  [ThemeName.AURORA]: 'Aurora',
  [ThemeName.CRIMSON]: 'Crimson',
  [ThemeName.SYNTHWAVE]: 'Synthwave',
  [ThemeName.EVERFOREST]: 'Everforest',
  [ThemeName.COBALT]: 'Cobalt2',
};

export default function ThemeSelector() {
  const { current, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [isDonor, setIsDonor] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.style.transition = 'background-color 300ms ease, color 300ms ease';
    return () => {
      document.documentElement.style.transition = '';
    };
  }, []);

  useEffect(() => {
    api.get<{ data?: { isDonor?: boolean; isOwner?: boolean } }>('/api/auth/me')
      .then((res) => {
        const user = (res as { data?: { isDonor?: boolean; isOwner?: boolean } })?.data;
        if (user?.isDonor || user?.isOwner) setIsDonor(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          background: 'transparent',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: 13,
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <Palette size={16} />
        <span style={{ display: 'none' }} className="sm:inline">
          {themeLabels[current]}
        </span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: 4,
            width: 200,
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            overflow: 'hidden',
            zIndex: 60,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          }}
        >
          {Object.values(ThemeName).map((name) => {
            const theme = themes[name];
            const isSelected = current === name;
            const isDonorTheme = DONOR_THEMES.includes(name);
            const locked = isDonorTheme && !isDonor;
            return (
              <motion.button
                type="button"
                key={name}
                whileHover={locked ? undefined : { scale: 1.03 }}
                whileTap={locked ? undefined : { scale: 0.97 }}
                onClick={() => {
                  if (locked) {
                    showToast('💙 Réservé aux donateurs — soutenez le projet !');
                    setOpen(false);
                    return;
                  }
                  setTheme(name);
                  setOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  background: isSelected ? 'var(--bg-surface-alt)' : 'transparent',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: locked ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  textAlign: 'left',
                  opacity: locked ? 0.55 : 1,
                  transition: 'background-color 0.1s',
                }}
                onMouseEnter={(e) => {
                  if (!locked) e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isSelected ? 'var(--bg-surface-alt)' : 'transparent';
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${theme.colors.sidebar} 50%, ${theme.colors.accent} 50%)`,
                    border: `2px solid ${theme.colors.border}`,
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1 }}>{themeLabels[name]}</span>
                {locked && <Lock size={12} style={{ color: 'var(--text-secondary)' }} />}
                {isSelected && !locked && <Check size={14} style={{ color: 'var(--accent)' }} />}
              </motion.button>
            );
          })}
        </div>
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            padding: '10px 16px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            fontSize: 13,
            color: 'var(--text-primary)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
