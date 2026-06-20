'use client';
import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const ORBS = [
  { size: 90, top: '20%', left: '10%', speed: 0.015, color: 'var(--accent)', opacity: 4 },
  { size: 70, top: '60%', left: '70%', speed: 0.025, color: 'var(--info)', opacity: 3 },
  { size: 50, top: '80%', left: '30%', speed: 0.04, color: 'var(--accent)', opacity: 5 },
] as const;

export function ParallaxBackground() {
  const reduced = useReducedMotion();
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const mouse = useRef({ x: 0.5, y: 0.5 });
  const current = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    if (reduced) return;
    const onMouse = (e: MouseEvent) => {
      mouse.current = { x: e.clientX / innerWidth, y: e.clientY / innerHeight };
    };
    window.addEventListener('mousemove', onMouse);
    let raf = requestAnimationFrame(function tick() {
      current.current.x += (mouse.current.x - current.current.x) * 0.05;
      current.current.y += (mouse.current.y - current.current.y) * 0.05;
      const cx = (current.current.x - 0.5) * 2;
      const cy = (current.current.y - 0.5) * 2;
      for (let i = 0; i < refs.current.length; i++) {
        const el = refs.current[i];
        if (!el) continue;
        const orb = ORBS[i];
        el.style.transform = `translate(${cx * orb.speed * 100}px, ${cy * orb.speed * 100}px)`;
      }
      raf = requestAnimationFrame(tick);
    });
    return () => {
      window.removeEventListener('mousemove', onMouse);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none', overflow: 'hidden' }}
      aria-hidden="true"
    >
      {/* Grille carreaux — identique landing page */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, color-mix(in srgb, var(--border-color) 60%, transparent) 1px, transparent 1px),
            linear-gradient(to bottom, color-mix(in srgb, var(--border-color) 60%, transparent) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse 100% 100% at 50% 0%, black 30%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(ellipse 100% 100% at 50% 0%, black 30%, transparent 85%)',
          opacity: 0.6,
        }}
      />

      {/* Scanline subtile */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, color-mix(in srgb, var(--bg-primary) 4%, transparent) 2px, color-mix(in srgb, var(--bg-primary) 4%, transparent) 4px)',
          opacity: 0.3,
          pointerEvents: 'none',
        }}
      />

      {/* Glow accent haut de page */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '250px',
          background: 'radial-gradient(ellipse 70% 60% at 50% -10%, color-mix(in srgb, var(--accent) 6%, transparent), transparent)',
          pointerEvents: 'none',
        }}
      />

      {/* Orbs parallax existants */}
      {!reduced && ORBS.map((orb, i) => (
        <div
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          style={{
            position: 'absolute',
            width: `${orb.size}vw`,
            height: `${orb.size}vw`,
            borderRadius: '50%',
            background: `radial-gradient(circle, color-mix(in srgb, ${orb.color} ${orb.opacity}%, transparent), transparent 70%)`,
            top: orb.top,
            left: orb.left,
            willChange: 'transform',
          }}
        />
      ))}
    </div>
  );
}
