declare module 'canvas-confetti' {
  interface ConfettiOptions {
    particleCount?: number;
    angle?: number;
    spread?: number;
    origin?: { x?: number; y?: number };
    colors?: string[];
    scalar?: number;
    gravity?: number;
    ticks?: number;
    startVelocity?: number;
    drift?: number;
    shapes?: string[];
    zIndex?: number;
    disableForReducedMotion?: boolean;
  }

  interface ConfettiFunction {
    (options?: ConfettiOptions): Promise<null>;
    reset(): void;
    create(canvas: HTMLCanvasElement, options?: { resize?: boolean; useWorker?: boolean }): ConfettiFunction;
  }

  const confetti: ConfettiFunction;
  export default confetti;
}