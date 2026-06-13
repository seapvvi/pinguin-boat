'use client';

import { useEffect, useRef } from 'react';

export interface RankCardPreviewData {
  backgroundType: 'COLOR' | 'IMAGE' | 'GRADIENT';
  backgroundColor: string;
  backgroundImage?: string | null;
  gradientFrom: string;
  gradientTo: string;
  xpBarColor: string;
  xpBarBackground: string;
  textColor: string;
  avatarBorder: boolean;
  avatarBorderColor: string;
  fontFamily: string;
  username?: string;
  level?: number;
  currentXp?: number;
  requiredXp?: number;
  avatarUrl?: string;
  rank?: number;
}

interface Props {
  data: RankCardPreviewData;
  width?: number;
  height?: number;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export default function RankCardPreview({ data, width = 600, height = 200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cancelled = false;

    const draw = async () => {
      if (cancelled) return;

      ctx.clearRect(0, 0, width, height);

      // Background
      if (data.backgroundType === 'COLOR') {
        ctx.fillStyle = data.backgroundColor;
        ctx.fillRect(0, 0, width, height);
      } else if (data.backgroundType === 'GRADIENT') {
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, data.gradientFrom);
        grad.addColorStop(1, data.gradientTo);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      } else if (data.backgroundType === 'IMAGE' && data.backgroundImage) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = data.backgroundImage;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          if (cancelled) return;
          ctx.drawImage(img, 0, 0, width, height);
        } catch {
          if (cancelled) return;
          ctx.fillStyle = data.backgroundColor;
          ctx.fillRect(0, 0, width, height);
        }
      } else {
        ctx.fillStyle = data.backgroundColor;
        ctx.fillRect(0, 0, width, height);
      }

      // Avatar
      const avatarSize = 80;
      const avatarX = 20;
      const avatarY = (height - avatarSize) / 2;
      const avatarUrl = data.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png';

      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      try {
        const avatarImg = new Image();
        avatarImg.crossOrigin = 'anonymous';
        avatarImg.src = avatarUrl;
        await new Promise((resolve, reject) => {
          avatarImg.onload = resolve;
          avatarImg.onerror = reject;
        });
        if (cancelled) return;
        ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
      } catch {
        if (cancelled) return;
        ctx.fillStyle = '#5865f2';
        ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold 32px ${data.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', avatarX + avatarSize / 2, avatarY + avatarSize / 2);
      }
      ctx.restore();

      // Avatar border
      if (data.avatarBorder) {
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.strokeStyle = data.avatarBorderColor;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Username
      ctx.fillStyle = data.textColor;
      ctx.font = `bold 24px ${data.fontFamily}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const username = data.username || 'Jean#1234';
      ctx.fillText(username, 120, 30);

      // Level
      ctx.fillStyle = data.textColor;
      ctx.globalAlpha = 0.7;
      ctx.font = `14px ${data.fontFamily}`;
      const level = data.level ?? 15;
      ctx.fillText(`Niveau ${level}`, 120, 60);
      ctx.globalAlpha = 1;

      // Rank
      const rank = data.rank ?? 5;
      ctx.fillStyle = data.xpBarColor;
      ctx.font = `bold 16px ${data.fontFamily}`;
      ctx.fillText(`Rang #${rank}`, 120, 80);

      // XP bar
      const barX = 120;
      const barY = 115;
      const barWidth = width - 150;
      const barHeight = 16;
      const borderRadius = 8;

      // Background bar
      ctx.fillStyle = data.xpBarBackground;
      roundRect(ctx, barX, barY, barWidth, barHeight, borderRadius);
      ctx.fill();

      // Progress
      const currentXp = data.currentXp ?? 2400;
      const requiredXp = data.requiredXp ?? 3000;
      const progress = Math.min(currentXp / requiredXp, 1);
      const progressWidth = barWidth * progress;

      if (progressWidth > 0) {
        ctx.fillStyle = data.xpBarColor;
        roundRect(ctx, barX, barY, Math.max(progressWidth, borderRadius * 2), barHeight, borderRadius);
        ctx.fill();
      }

      // XP text
      ctx.fillStyle = data.textColor;
      ctx.font = `12px ${data.fontFamily}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${currentXp} / ${requiredXp} XP`, barX, barY - 4);

      // Percentage
      ctx.textAlign = 'right';
      ctx.fillText(`${(progress * 100).toFixed(1)}%`, barX + barWidth, barY - 4);
    };

    draw();

    return () => {
      cancelled = true;
    };
  }, [data, width, height]);

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width, height, borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}
      />
    </div>
  );
}
