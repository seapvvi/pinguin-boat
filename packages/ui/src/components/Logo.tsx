import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  withText?: boolean;
}

export function Logo({ className = '', size = 32, withText = false }: LogoProps) {
  return (
    <div className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', flexShrink: 0 }}
      >
        <ellipse cx="32" cy="38" rx="20" ry="22" fill="var(--text-primary, '#f5f5f5')" />
        <ellipse cx="32" cy="40" rx="13" ry="16" fill="var(--bg-primary, '#000000')" />
        <ellipse cx="24" cy="48" rx="4" ry="7" fill="var(--accent, '#e0e0e0')" transform="rotate(-15, 24, 48)" />
        <ellipse cx="40" cy="48" rx="4" ry="7" fill="var(--accent, '#e0e0e0')" transform="rotate(15, 40, 48)" />
        <circle cx="26" cy="32" r="2.5" fill="var(--bg-primary, '#000000')" />
        <circle cx="38" cy="32" r="2.5" fill="var(--bg-primary, '#000000')" />
        <path d="M29 38 Q32 42 35 38" stroke="var(--accent, '#e0e0e0')" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M32 14 L36 4 L38 8 L44 2 L42 10 L48 10 L42 14 L46 18 L38 16 L32 22 L26 16 L18 18 L22 14 L16 10 L22 10 L20 2 L26 8 L28 4 L32 14Z" fill="#F5A623" stroke="#D4890F" strokeWidth="0.5" />
      </svg>
      {withText && (
        <span
          style={{
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: size * 0.55,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary, #f5f5f5)',
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          Pinguin BOAT
        </span>
      )}
    </div>
  );
}
