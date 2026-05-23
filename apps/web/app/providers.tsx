'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import Lenis from 'lenis';
import { useTheme, useSnowflakes, useMediaQuery, Snowflakes } from '@pinguin/ui';

export function Providers({ children }: { children: ReactNode }) {
  const prefersReduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (prefersReduced) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
    });

    lenisRef.current = lenis;

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
      lenisRef.current = null;
    };
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
