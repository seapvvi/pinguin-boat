'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { cn, Logo, Avatar, Toggle } from '@pinguin/ui';
import { useSnowflakes } from '@pinguin/ui';
import {
  LayoutDashboard,
  Server,
  Shield,
  Swords,
  Ticket,
  ScrollText,
  Trophy,
  Wallet,
  Gift,
  Vote,
  Lightbulb,
  DoorOpen,
  UserPlus,
  FileText,
  Settings,
  Crown,
  UserCog,
  ChevronDown,
  Menu,
  X,
  Snowflake,
  LogOut,
} from 'lucide-react';

interface SidebarProps {
  user: {
    id: string;
    username: string;
    avatar: string;
    isOwner: boolean;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

interface Category {
  label: string;
  items: Item[];
}

interface Item {
  label: string;
  icon: React.ReactNode;
  href: string;
  ownerOnly?: boolean;
}

const categories: Category[] = [
  {
    label: 'Général',
    items: [
      { label: 'Vue d\'ensemble', icon: <LayoutDashboard size={18} />, href: '/dashboard' },
      { label: 'Sélecteur de serveur', icon: <Server size={18} />, href: '/dashboard/servers' },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { label: 'Modération', icon: <Shield size={18} />, href: '/dashboard/moderation' },
      { label: 'Protection', icon: <Swords size={18} />, href: '/dashboard/protection' },
      { label: 'Tickets', icon: <Ticket size={18} />, href: '/dashboard/tickets' },
      { label: 'Logs', icon: <ScrollText size={18} />, href: '/dashboard/logs' },
    ],
  },
  {
    label: 'Communauté',
    items: [
      { label: 'Niveaux / XP', icon: <Trophy size={18} />, href: '/dashboard/levels' },
      { label: 'Économie', icon: <Wallet size={18} />, href: '/dashboard/economy' },
      { label: 'Giveaways', icon: <Gift size={18} />, href: '/dashboard/giveaways' },
      { label: 'Sondages', icon: <Vote size={18} />, href: '/dashboard/polls' },
      { label: 'Suggestions', icon: <Lightbulb size={18} />, href: '/dashboard/suggestions' },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { label: 'Bienvenue', icon: <DoorOpen size={18} />, href: '/dashboard/welcome' },
      { label: 'Auto-rôles', icon: <UserPlus size={18} />, href: '/dashboard/autoroles' },
      { label: 'Embeds', icon: <FileText size={18} />, href: '/dashboard/embeds' },
      { label: 'Paramètres', icon: <Settings size={18} />, href: '/dashboard/settings' },
    ],
  },
  {
    label: 'Premium',
    items: [
      { label: 'Premium', icon: <Crown size={18} />, href: '/dashboard/premium' },
    ],
  },
];

export default function Sidebar({ user, isOpen, onClose, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const { enabled: snowflakesEnabled, toggle: toggleSnowflakes } = useSnowflakes();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    const expanded = new Set<string>();
    for (const cat of categories) {
      for (const item of cat.items) {
        if (pathname.startsWith(item.href)) {
          expanded.add(cat.label);
        }
      }
    }
    if (expanded.size === 0) expanded.add('Général');
    return expanded;
  });

  const toggleCategory = (label: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const sidebarContent = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
      }}
    >
      <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <Link href="/dashboard" onClick={onClose}>
          <Logo withText size={28} />
        </Link>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {categories.map((category) => {
          const visibleItems = category.items.filter(
            (item) => !item.ownerOnly || user?.isOwner
          );
          if (visibleItems.length === 0) return null;

          const isExpanded = expandedCategories.has(category.label);

          return (
            <div key={category.label} style={{ marginBottom: 4 }}>
              <button
                onClick={() => toggleCategory(category.label)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '8px 16px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                <span>{category.label}</span>
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ display: 'flex' }}
                >
                  <ChevronDown size={14} />
                </motion.div>
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    {visibleItems.map((item) => {
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onClose}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 16px 8px 24px',
                            fontSize: 14,
                            fontWeight: active ? 500 : 400,
                            color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                            backgroundColor: active ? 'var(--bg-sidebar-active)' : 'transparent',
                            borderRight: active ? '2px solid var(--accent)' : '2px solid transparent',
                            textDecoration: 'none',
                            transition: 'background-color 0.15s, color 0.15s',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            if (!active) {
                              e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!active) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }
                          }}
                        >
                          <span style={{ opacity: active ? 1 : 0.6, flexShrink: 0 }}>
                            {item.icon}
                          </span>
                          {item.label}
                        </Link>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {user?.isOwner && (
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                padding: '8px 16px',
                color: 'var(--text-secondary)',
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Owner
            </div>
            <Link
              href="/owner"
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 16px 8px 24px',
                fontSize: 14,
                fontWeight: isActive('/owner') ? 500 : 400,
                color: isActive('/owner') ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: isActive('/owner') ? 'var(--bg-sidebar-active)' : 'transparent',
                borderRight: isActive('/owner') ? '2px solid var(--accent)' : '2px solid transparent',
                textDecoration: 'none',
                transition: 'background-color 0.15s, color 0.15s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!isActive('/owner')) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive('/owner')) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <UserCog size={18} style={{ opacity: isActive('/owner') ? 1 : 0.6 }} />
              Panel Owner
            </Link>
          </div>
        )}
      </nav>

      <div
        style={{
          borderTop: '1px solid var(--border-color)',
          padding: '12px 16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Snowflake size={14} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Flocons</span>
          </div>
          <Toggle checked={snowflakesEnabled} onChange={toggleSnowflakes} />
        </div>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar
              src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`}
              alt={user.username}
              size={32}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.username}
              </div>
            </div>
            <button
              onClick={onLogout}
              title="Déconnexion"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                border: 'none',
                borderRadius: 6,
                background: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'background-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)';
                e.currentTarget.style.color = 'var(--error)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: 260,
          height: '100vh',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 40,
        }}
        className="hidden lg:flex"
      >
        {sidebarContent}
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                zIndex: 50,
              }}
              className="lg:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: 280,
                height: '100vh',
                zIndex: 51,
                overflow: 'hidden',
              }}
              className="lg:hidden"
            >
              <div style={{ position: 'relative', height: '100%' }}>
                <button
                  onClick={onClose}
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    border: 'none',
                    borderRadius: 6,
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={18} />
                </button>
                {sidebarContent}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
