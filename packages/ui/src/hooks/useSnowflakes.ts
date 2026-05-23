'use client';
import { useState, useCallback } from 'react';

export function useSnowflakes() {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('pinguin-snowflakes');
    return stored !== null ? stored === 'true' : true;
  });

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('pinguin-snowflakes', String(next));
      return next;
    });
  }, []);

  return { enabled, toggle };
}
