import confetti from 'canvas-confetti';
import { useReducedMotion } from './useReducedMotion';

type ConfettiPreset = 'donate' | 'invite' | 'discord';

const PRESETS: Record<ConfettiPreset, () => void> = {
  donate: () => {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.55 },
      colors: ['#f59e0b', '#ef4444', '#ec4899', '#f97316', '#fbbf24'],
      scalar: 1.1,
      gravity: 0.9,
    });
    setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 100,
        origin: { y: 0.5, x: 0.3 },
        colors: ['#3b82f6', '#8b5cf6', '#06b6d4'],
        scalar: 0.9,
        gravity: 0.85,
      });
    }, 150);
  },

  invite: () => {
    confetti({
      particleCount: 80,
      angle: 90,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'],
      scalar: 1.0,
    });
  },

  discord: () => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors: ['#9146ff', '#bf9ffb', '#e9d5ff', '#ffffff'],
    });
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
      colors: ['#9146ff', '#bf9ffb', '#e9d5ff', '#ffffff'],
    });
  },
};

export function useConfetti() {
  const reduced = useReducedMotion();

  const fire = (preset: ConfettiPreset) => {
    if (reduced) return;
    PRESETS[preset]();
  };

  return { fire };
}