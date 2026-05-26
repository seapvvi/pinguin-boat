'use client';

import { useEffect, type ReactNode } from 'react';
import { useTheme, useSnowflakes, useMediaQuery, Snowflakes } from '@pinguin/ui';
import { EarlyAlphaPopup } from '@/components/EarlyAlphaPopup';

export function Providers({ children }: { children: ReactNode }) {
  const prefersReduced = useMediaQuery('(prefers-reduced-motion: reduce)');

  // This file is always client-side; the crash you saw likely comes from
  // a hook inside @pinguin/ui. We must never block rendering the app.
  return (
    <SafeTheme>
      <SafeSnowflakes disabled={prefersReduced}>
        <EarlyAlphaPopup />
        {children}
      </SafeSnowflakes>
    </SafeTheme>
  );
}

function SafeTheme({ children }: { children: ReactNode }) {
  try {
    const { isDark } = useTheme();

    useEffect(() => {
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    }, [isDark]);

    return <>{children}</>;
  } catch {
    // Fail open: still render children.
    return <>{children}</>;
  }
}

function SafeSnowflakes({ children, disabled }: { children: ReactNode; disabled: boolean }) {
  try {
    const { enabled } = useSnowflakes();

    // Fail open: if enabled logic breaks, still render children.
    return (
      <>
        {!disabled && <Snowflakes enabled={enabled} count={35} />}
        {children}
      </>
    );
  } catch {
    return <>{children}</>;
  }
}

