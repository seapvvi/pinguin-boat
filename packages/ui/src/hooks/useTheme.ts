'use client';
import { useState, useEffect, useCallback } from 'react';
import { ThemeName, getTheme } from '@pinguin/shared';
import { applyTheme } from '../utils/theme';

interface ThemeState {
  current: ThemeName;
  setTheme: (name: ThemeName) => void;
  isDark: boolean;
}

export function useTheme(): ThemeState {
  const [current, setCurrent] = useState<ThemeName>(ThemeName.OLED);

  useEffect(() => {
    const stored = localStorage.getItem('pinguin-theme') as ThemeName | null;
    if (stored) {
      setCurrent(stored);
      applyTheme(getTheme(stored));
    } else {
      applyTheme(getTheme(ThemeName.OLED));
    }
  }, []);

  const setTheme = useCallback((name: ThemeName) => {
    setCurrent(name);
    localStorage.setItem('pinguin-theme', name);
    applyTheme(getTheme(name));
  }, []);

  const isDark = getTheme(current).isDark;

  return { current, setTheme, isDark };
}
