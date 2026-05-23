'use client';
import React, { useRef, useEffect, useCallback } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';

interface Snowflake {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  sway: number;
  swaySpeed: number;
}

interface SnowflakesProps {
  enabled?: boolean;
  count?: number;
}

export function Snowflakes({ enabled = true, count = 35 }: SnowflakesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flakesRef = useRef<Snowflake[]>([]);
  const rafRef = useRef<number>(0);
  const prefersReduced = useMediaQuery('(prefers-reduced-motion: reduce)');

  const init = useCallback(() => {
    const flakes: Snowflake[] = [];
    for (let i = 0; i < count; i++) {
      flakes.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.random() * 2.5 + 0.5,
        speed: Math.random() * 0.3 + 0.1,
        opacity: Math.random() * 0.4 + 0.1,
        sway: Math.random() * 30,
        swaySpeed: Math.random() * 0.005 + 0.002,
      });
    }
    flakesRef.current = flakes;
  }, [count]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const flake of flakesRef.current) {
      flake.y += flake.speed;
      flake.x += Math.sin(flake.y * flake.swaySpeed) * 0.3;

      if (flake.y > canvas.height) {
        flake.y = -flake.size;
        flake.x = Math.random() * canvas.width;
      }
      if (flake.x < -5) flake.x = canvas.width + 5;
      if (flake.x > canvas.width + 5) flake.x = -5;

      ctx.beginPath();
      ctx.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${flake.opacity})`;
      ctx.fill();
    }

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (!enabled || prefersReduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    init();
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, prefersReduced, init, animate]);

  if (!enabled || prefersReduced) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}
    />
  );
}
