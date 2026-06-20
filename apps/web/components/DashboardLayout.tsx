'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import Sidebar from './Sidebar';
import Header from './Header';
import OwnerPopupListener from './OwnerPopupListener';
import { ParallaxBackground } from './ParallaxBackground';
import { getUser, logout as authLogout, type User } from '@/lib/auth';
import { useConfetti } from '@/hooks/useConfetti';

interface DashboardLayoutProps {
  children: ReactNode;
  guildId?: string;
}

export default function DashboardLayout({ children, guildId }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const { fire } = useConfetti();

  useEffect(() => {
    setShowProgress(true);
    setProgress(0);
    const frame1 = requestAnimationFrame(() => setProgress(30));
    const frame2 = requestAnimationFrame(() => setTimeout(() => setProgress(70), 100));
    const t1 = setTimeout(() => setProgress(95), 250);
    const t2 = setTimeout(() => setProgress(100), 400);
    const t3 = setTimeout(() => {
      setTimeout(() => setShowProgress(false), 300);
    }, 500);
    return () => {
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [pathname]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) setSidebarOpen(false);
  }, []);

  function handleSidebarClose() {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) setSidebarOpen(false);
  }

  useEffect(() => {
    async function load() {
      const u = await getUser();
      if (!u) {
        router.replace('/auth/login');
        return;
      }
      setUser(u);
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleLogout() {
    await authLogout();
    router.replace('/auth/login');
  }

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: '2px solid var(--border-color)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Chargement…
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
      <ParallaxBackground />
      <Sidebar
        user={user}
        isOpen={sidebarOpen}
        onClose={handleSidebarClose}
        onLogout={handleLogout}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          transition: 'margin-left 0.3s ease',
        }}
        className={sidebarOpen ? 'lg:ml-64' : 'lg:ml-0'}
      >
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          height: 2, zIndex: 9999,
          pointerEvents: 'none',
          opacity: showProgress ? 1 : 0,
          transition: 'opacity 300ms ease',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(to right, var(--accent), color-mix(in srgb, var(--accent) 70%, var(--info)))',
            transition: 'width 500ms ease-out',
            boxShadow: '0 0 8px color-mix(in srgb, var(--accent) 60%, transparent)',
          }} />
        </div>

        <Header
          user={user}
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
          onLogout={handleLogout}
          guildId={guildId}
        />

        <main
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            position: 'relative',
            zIndex: 1,
          }}
          className="px-6 lg:px-10 py-6"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer
          style={{
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'color-mix(in srgb, var(--bg-sidebar) 80%, transparent)',
            backdropFilter: 'blur(8px)',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            fontSize: 11,
            color: 'var(--text-secondary)',
            letterSpacing: '0.02em',
          }}
        >
          <span>
            © 2026 Pinguin Empire by{' '}
            <a
              href="https://e-z.bio/pvi"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)', textDecoration: 'none' }}
              onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
              onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
            >
              pvvi
            </a>
          </span>
          <a
            href="https://discord.gg/EJHhcYkXMQ"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => fire('discord')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              fontSize: 12,
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            Rejoindre Pinguin Empire
          </a>
        </footer>
      </div>
      <OwnerPopupListener />
    </div>
  );
}
