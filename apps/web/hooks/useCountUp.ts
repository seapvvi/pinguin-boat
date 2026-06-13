import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

export function useCountUp(target: number, duration = 800): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);
  const frameRef = useRef<number>();

  useEffect(() => {
    if (reduced) { setValue(target); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // Easing easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(Math.round(eased * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration, reduced]);

  return value;
}
