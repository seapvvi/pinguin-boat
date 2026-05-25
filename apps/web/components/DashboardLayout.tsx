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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
        onClose={() => setSidebarOpen(false)}
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
          onMenuToggle={() => setSidebarOpen(true)}
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
      </div>
    </div>
  );
}
