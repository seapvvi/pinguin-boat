'use client';

import { useEffect, useRef } from 'react';

export interface WelcomeCardPreviewData {
  cardBackground: 'COLOR' | 'IMAGE' | 'GRADIENT';
  cardBgColor: string;
  cardBgImage: string | null;
  cardTextColor: string;
  cardSubtextColor: string;
  cardAccentColor: string;
  cardBlurBackground: boolean;
  cardText: string;
  cardSubtext: string;
}

interface Props {
  data: WelcomeCardPreviewData;
  width?: number;
  height?: number;
}

function replaceVars(text: string): string {
  return text
    .replace(/\{user\}/gi, 'NouveauMembre')
    .replace(/\{username\}/gi, 'nouveau_membre')
    .replace(/\{server\}/gi, 'Nom du serveur')
    .replace(/\{memberCount\}/gi, '1337')
    .replace(/\{members\}/gi, '1337')
    .replace(/\{count\}/gi, '1337');
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export default function WelcomeCardPreview({ data, width = 700, height = 250 }: Props) {
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
      if (data.cardBackground === 'COLOR') {
        ctx.fillStyle = data.cardBgColor;
        ctx.fillRect(0, 0, width, height);
      } else if (data.cardBackground === 'GRADIENT') {
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, data.cardBgColor);
        grad.addColorStop(1, data.cardAccentColor);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      } else if (data.cardBackground === 'IMAGE' && data.cardBgImage) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = data.cardBgImage;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          if (cancelled) return;
          ctx.drawImage(img, 0, 0, width, height);
          if (data.cardBlurBackground) {
            ctx.filter = 'blur(8px)';
            ctx.drawImage(img, 0, 0, width, height);
            ctx.filter = 'none';
          }
        } catch {
          if (cancelled) return;
          ctx.fillStyle = data.cardBgColor;
          ctx.fillRect(0, 0, width, height);
        }
      } else {
        ctx.fillStyle = data.cardBgColor;
        ctx.fillRect(0, 0, width, height);
      }

      // Dark overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, width, height);

      const avatarSize = 90;
      const avatarX = 35;
      const avatarY = (height - avatarSize) / 2;

      // Avatar border
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 3, 0, Math.PI * 2);
      ctx.fillStyle = data.cardAccentColor;
      ctx.fill();

      // Avatar clip
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // Placeholder avatar
      ctx.fillStyle = data.cardAccentColor;
      ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 40px Sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', avatarX + avatarSize / 2, avatarY + avatarSize / 2);
      ctx.restore();

      // Text
      const textX = avatarX + avatarSize + 30;
      const textMaxWidth = width - textX - 40;

      const mainText = replaceVars(data.cardText);
      ctx.fillStyle = data.cardTextColor;
      ctx.font = 'bold 28px Sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      const mainLines = wrapText(ctx, mainText, textMaxWidth);
      let textY = height / 2 - 30;

      for (const line of mainLines) {
        ctx.fillText(line, textX, textY);
        textY += 36;
      }

      const subText = replaceVars(data.cardSubtext);
      ctx.fillStyle = data.cardSubtextColor;
      ctx.font = '18px Sans-serif';
      const subLines = wrapText(ctx, subText, textMaxWidth);

      for (const line of subLines) {
        ctx.fillText(line, textX, textY);
        textY += 24;
      }
    };

    draw();

    return () => {
      cancelled = true;
    };
  }, [data, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width, height, borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}
    />
  );
}
