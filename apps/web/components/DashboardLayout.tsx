'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';
import { getUser, logout as authLogout, type User } from '@/lib/auth';

interface DashboardLayoutProps {
  children: ReactNode;
  guildId?: string;
}

export default function DashboardLayout({ children, guildId }: DashboardLayoutProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
    <div style={{ display: 'flex', minHeight: '100vh' }}>
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
        className={sidebarOpen ? 'lg:ml-[260px]' : 'lg:ml-0'}
      >
        <Header
          user={user}
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
          onLogout={handleLogout}
          guildId={guildId}
        />

        <main
          style={{
            flex: 1,
            padding: 24,
            backgroundColor: 'var(--bg-primary)',
          }}
        >
          {children}
        </main>

        <footer
          style={{
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)',
            padding: '8px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            fontSize: 12,
            color: 'var(--text-secondary)',
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
    </div>
  );
}
