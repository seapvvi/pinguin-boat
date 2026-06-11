import { GuildMember } from 'discord.js';
import { createCanvas, loadImage, registerFont } from '@napi-rs/canvas';

interface CardSettings {
  cardBackground: string;
  cardBgColor: string;
  cardBgImage: string | null;
  cardTextColor: string;
  cardSubtextColor: string;
  cardAccentColor: string;
  cardBlurBackground: boolean;
  cardText: string;
  cardSubtext: string;
}

const WIDTH = 700;
const HEIGHT = 250;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
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

function replaceCardVars(text: string, member: GuildMember): string {
  return text
    .replace(/\{user\}/gi, member.displayName)
    .replace(/\{username\}/gi, member.user.username)
    .replace(/\{server\}/gi, member.guild.name)
    .replace(/\{memberCount\}/gi, String(member.guild.memberCount))
    .replace(/\{members\}/gi, String(member.guild.memberCount))
    .replace(/\{count\}/gi, String(member.guild.memberCount));
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

export async function generateCard(
  member: GuildMember,
  settings: CardSettings,
): Promise<Buffer> {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background
  if (settings.cardBackground === 'COLOR') {
    ctx.fillStyle = settings.cardBgColor;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  } else if (settings.cardBackground === 'GRADIENT') {
    const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    grad.addColorStop(0, settings.cardBgColor);
    grad.addColorStop(1, settings.cardAccentColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  } else if (settings.cardBackground === 'IMAGE' && settings.cardBgImage) {
    try {
      const img = await loadImage(settings.cardBgImage);
      ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);
      if (settings.cardBlurBackground) {
        ctx.filter = 'blur(8px)';
        ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);
        ctx.filter = 'none';
      }
    } catch {
      ctx.fillStyle = settings.cardBgColor;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
  } else {
    ctx.fillStyle = settings.cardBgColor;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  // Dark overlay for readability
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const avatarSize = 90;
  const avatarX = 35;
  const avatarY = (HEIGHT - avatarSize) / 2;

  // Avatar border (accent circle)
  ctx.save();
  ctx.beginPath();
  ctx.arc(
    avatarX + avatarSize / 2,
    avatarY + avatarSize / 2,
    avatarSize / 2 + 3,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = settings.cardAccentColor;
  ctx.fill();

  // Avatar clip
  ctx.beginPath();
  ctx.arc(
    avatarX + avatarSize / 2,
    avatarY + avatarSize / 2,
    avatarSize / 2,
    0,
    Math.PI * 2,
  );
  ctx.closePath();
  ctx.clip();

  // Draw avatar
  try {
    const avatarUrl = member.user.displayAvatarURL({
      extension: 'png',
      size: 256,
    });
    const avatarImg = await loadImage(avatarUrl);
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
  } catch {
    ctx.fillStyle = settings.cardAccentColor;
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
  }
  ctx.restore();

  // Text
  const textX = avatarX + avatarSize + 30;
  const textMaxWidth = WIDTH - textX - 40;

  // Main text
  const mainText = replaceCardVars(settings.cardText, member);
  ctx.fillStyle = settings.cardTextColor;
  ctx.font = 'bold 28px Sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const mainLines = wrapText(ctx, mainText, textMaxWidth);
  let textY = HEIGHT / 2 - 30;

  for (const line of mainLines) {
    ctx.fillText(line, textX, textY);
    textY += 36;
  }

  // Subtext
  const subText = replaceCardVars(settings.cardSubtext, member);
  ctx.fillStyle = settings.cardSubtextColor;
  ctx.font = '18px Sans-serif';
  const subLines = wrapText(ctx, subText, textMaxWidth);

  for (const line of subLines) {
    ctx.fillText(line, textX, textY);
    textY += 24;
  }

  return canvas.toBuffer('image/png');
}
