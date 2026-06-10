'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { Logo, Avatar, Toggle, Snowflakes } from '@pinguin/ui';
import { useSnowflakes } from '@pinguin/ui';
import { getAvatarUrl } from '@/lib/utils';
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
  X,
  Snowflake,
  LogOut,
  Lock,
  Users,
  Radio,
  Star,
  ClipboardList,
  Gamepad2,
  Bell,
  Ban,
  Mail,
  Terminal,
} from 'lucide-react';

interface SidebarProps {
  user: {
    id: string;
    username: string;
    avatar: string | null;
    isOwner: boolean;
    isDonor?: boolean;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

function guildHref(guildId: string | null, base: string, isGuildPage: boolean): string {
  if (!isGuildPage) return base;
  if (!guildId) return `/servers?redirect=${encodeURIComponent(base)}`;
  return `/servers/${guildId}${base}`;
}

interface CategoryDef {
  label: string;
  items: { label: string; icon: React.ReactNode; href: string; guildPage?: boolean; ownerOnly?: boolean }[];
}

const categoryDefs: CategoryDef[] = [
  {
    label: 'Général',
    items: [
      { label: 'Vue d\'ensemble', icon: <LayoutDashboard size={18} />, href: '/' },
      { label: 'Sélecteur de serveur', icon: <Server size={18} />, href: '/servers' },
    ],
  },
  {
    label: 'Ressources',
    items: [
      { label: 'Commandes', icon: <Terminal size={18} />, href: '/commands', guildPage: true },
    ],
  },
  {
    label: 'Soutien',
    items: [
      { label: 'Soutenir', icon: <Crown size={18} />, href: '/soutien' },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { label: 'Modération', icon: <Shield size={18} />, href: '/moderation', guildPage: true },
      { label: 'Auto-Modération', icon: <Shield size={18} />, href: '/automod', guildPage: true },
      { label: 'Protection', icon: <Swords size={18} />, href: '/protection', guildPage: true },
      { label: 'Tickets', icon: <Ticket size={18} />, href: '/tickets', guildPage: true },
      { label: 'Logs', icon: <ScrollText size={18} />, href: '/logs', guildPage: true },
      { label: 'Audit', icon: <FileText size={18} />, href: '/audit', guildPage: true },
      { label: 'Blacklist', icon: <Ban size={18} />, href: '/blacklist', guildPage: true },
      { label: 'Notifications', icon: <Bell size={18} />, href: '/notifications', guildPage: true },
    ],
  },
  {
    label: 'Communauté',
    items: [
      { label: 'Niveaux / XP', icon: <Trophy size={18} />, href: '/levels', guildPage: true },
      { label: 'Économie', icon: <Wallet size={18} />, href: '/economy', guildPage: true },
      { label: 'Giveaways', icon: <Gift size={18} />, href: '/giveaways', guildPage: true },
      { label: 'Sondages', icon: <Vote size={18} />, href: '/polls', guildPage: true },
      { label: 'Suggestions', icon: <Lightbulb size={18} />, href: '/suggestions', guildPage: true },
      { label: 'Starboard', icon: <Star size={18} />, href: '/starboard', guildPage: true },
      { label: 'Formulaires', icon: <ClipboardList size={18} />, href: '/forms', guildPage: true },
      { label: 'Minijeux', icon: <Gamepad2 size={18} />, href: '/minigames', guildPage: true },
      { label: 'Clans', icon: <Users size={18} />, href: '/clans', guildPage: true },
      { label: 'Invitations', icon: <Mail size={18} />, href: '/invites', guildPage: true },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { label: 'Bienvenue', icon: <DoorOpen size={18} />, href: '/welcome', guildPage: true },
      { label: 'Auto-rôles', icon: <UserPlus size={18} />, href: '/autoroles', guildPage: true },
      { label: 'Embeds', icon: <FileText size={18} />, href: '/embeds', guildPage: true },
      { label: 'Paramètres', icon: <Settings size={18} />, href: '/settings', guildPage: true },
    ],
  },
];

export default function Sidebar({ user, isOpen, onClose, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const isOwner = (user as { isOwner?: boolean })?.isOwner ?? false;
  const isDonor = user?.isDonor || isOwner;
  const { enabled: snowflakesEnabled, toggle: toggleSnowflakes } = useSnowflakes();

  const guildId = pathname.match(/^\/servers\/([^/]+)/)?.[1] ?? null;
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    return new Set(categoryDefs.map((c) => c.label));
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

  const isActive = (href: string, isGuildPage?: boolean) => {
    if (isGuildPage && !guildId) return false;
    if (href === '/servers') return pathname === '/servers';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const sidebarContent = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
        position: 'relative',
      }}
    >
      {snowflakesEnabled && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 50, overflow: 'hidden' }}>
          <Snowflakes enabled count={20} />
        </div>
      )}
      <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <Link href="/" onClick={onClose}>
          <Logo withText size={28} />
        </Link>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '8px 0' }}>
        {categoryDefs.map((category) => {
          const visibleItems = category.items.filter(
            (item) => !item.ownerOnly || user?.isOwner
          );
          if (visibleItems.length === 0) return null;

          const isExpanded = expandedCategories.has(category.label);

          return (
            <div key={category.label} style={{ marginBottom: 4 }}>
              <button
                type="button"
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

              {isExpanded && visibleItems.map((item) => {
                const href = guildHref(guildId, item.href, !!item.guildPage);
                const active = isActive(href, !!item.guildPage);
                return (
                  <Link
                    key={item.href}
                    href={href}
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
            {[
              { href: '/owner', label: 'Panel Owner', icon: <UserCog size={18} /> },
              { href: '/owner/servers', label: 'Serveurs', icon: <Server size={18} /> },
              { href: '/owner/users', label: 'Utilisateurs', icon: <Users size={18} /> },
              { href: '/owner/connected', label: 'Connectés', icon: <Radio size={18} /> },
            ].map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 16px 8px 24px',
                  fontSize: 14,
                  fontWeight: isActive(href) ? 500 : 400,
                  color: isActive(href) ? 'var(--text-primary)' : 'var(--text-secondary)',
                  backgroundColor: isActive(href) ? 'var(--bg-sidebar-active)' : 'transparent',
                  borderRight: isActive(href) ? '2px solid var(--accent)' : '2px solid transparent',
                  textDecoration: 'none',
                  transition: 'background-color 0.15s, color 0.15s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!isActive(href)) e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive(href)) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ opacity: isActive(href) ? 1 : 0.6 }}>{icon}</span>
                {label}
              </Link>
            ))}
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
            {!isDonor && <Lock size={11} style={{ color: 'var(--text-secondary)', opacity: 0.6 }} />}
          </div>
          <div
            title={isDonor ? undefined : 'Réservé aux donateurs'}
            style={{ opacity: isDonor ? 1 : 0.4, cursor: isDonor ? 'pointer' : 'not-allowed' }}
          >
            <Toggle
              checked={snowflakesEnabled}
              onChange={isDonor ? toggleSnowflakes : () => {}}
            />
          </div>
        </div>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar
              src={getAvatarUrl(user) ?? undefined}
              name={user.username}
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
              type="button"
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
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: 260,
              height: '100vh',
              position: 'fixed',
              top: 0,
              left: 0,
              zIndex: 51,
              overflow: 'hidden',
            }}
            className="hidden lg:flex"
          >
            {sidebarContent}
          </motion.div>
        )}
      </AnimatePresence>

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
                  type="button"
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
