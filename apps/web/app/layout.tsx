import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import '../styles/globals.css';
import { Providers } from './providers';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'Pinguin BOAT — Forgé pour la communauté',
  description: 'Dashboard de gestion du bot Discord Pinguin BOAT',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={jetbrainsMono.variable}>
      <body style={{ fontFamily: 'var(--font-jetbrains), monospace' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
