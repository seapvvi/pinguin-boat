'use client';
import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'pinguin-snowflakes';
const EVENT_NAME = 'pinguin-snowflakes-change';

function readEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored !== null ? stored === 'true' : true;
}

export function useSnowflakes() {
  const [enabled, setEnabled] = useState(readEnabled);

  useEffect(() => {
    const sync = () => setEnabled(readEnabled());
    window.addEventListener('storage', sync);
    window.addEventListener(EVENT_NAME, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(EVENT_NAME, sync);
    };
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      window.dispatchEvent(new Event(EVENT_NAME));
      return next;
    });
  }, []);

  return { enabled, toggle };
}
