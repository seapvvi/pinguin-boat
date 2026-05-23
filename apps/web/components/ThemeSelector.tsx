'use client';

import { useState, useRef, useEffect } from 'react';
import { ThemeName, themes } from '@pinguin/shared';
import { useTheme } from '@pinguin/ui';
import { Palette, Check, ChevronDown } from 'lucide-react';

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
};

export default function ThemeSelector() {
  const { current, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
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
            return (
              <button
                key={name}
                onClick={() => {
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
                  cursor: 'pointer',
                  fontSize: 13,
                  textAlign: 'left',
                  transition: 'background-color 0.1s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)';
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
                    backgroundColor: theme.colors.accent,
                    border: '1px solid var(--border-color)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1 }}>{themeLabels[name]}</span>
                {isSelected && <Check size={14} style={{ color: 'var(--accent)' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
