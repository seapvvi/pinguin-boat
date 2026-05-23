'use client';

import { useEffect, type ReactNode } from 'react';
import { useTheme, useSnowflakes, useMediaQuery, Snowflakes } from '@pinguin/ui';

export function Providers({ children }: { children: ReactNode }) {
  const prefersReduced = useMediaQuery('(prefers-reduced-motion: reduce)');

  useEffect(() => {
    if (prefersReduced) return;
  }, [prefersReduced]);

  return (
    <ThemeWrapper>
      <SnowflakesWrapper>
        {children}
      </SnowflakesWrapper>
    </ThemeWrapper>
  );
}

function ThemeWrapper({ children }: { children: ReactNode }) {
  const { current, isDark } = useTheme();

  useEffect(() => {
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  }, [isDark]);

  return <>{children}</>;
}

function SnowflakesWrapper({ children }: { children: ReactNode }) {
  const { enabled } = useSnowflakes();

  return (
    <>
      <Snowflakes enabled={enabled} count={35} />
      {children}
    </>
  );
}
