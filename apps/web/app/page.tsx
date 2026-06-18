'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Shield, Ticket, BarChart3, ScrollText, Terminal, LayoutDashboard,
  BookOpen, MessageCircle, Github, ChevronRight,
} from 'lucide-react';
import { Logo } from '@pinguin/ui';
import { getUser, type User } from '@/lib/auth';

// ─── Types ─────────────────────────────────────────────────────────────

interface StatsData {
  totalGuilds: number;
  totalUsers: number;
  totalCommands: number;
}

interface Feature {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
}

// ─── Constants ─────────────────────────────────────────────────────────

const FEATURES: Feature[] = [
  { icon: Shield, title: 'Modération automatique', description: 'Filtres anti-spam, anti-lien, anti-mass-mention et bien plus' },
  { icon: Ticket, title: 'Système de tickets', description: 'Support organisé avec catégories, assignation et transcripts' },
  { icon: BarChart3, title: 'Sondages & suggestions', description: 'Créez des sondages et recueillez les suggestions de votre communauté' },
  { icon: ScrollText, title: 'Logs détaillés', description: 'Historique complet des actions, sanctions et événements du serveur' },
  { icon: Terminal, title: 'Commandes personnalisées', description: 'Créez vos propres commandes sans aucune connaissance en code' },
  { icon: LayoutDashboard, title: 'Dashboard web complet', description: 'Interface intuitive pour configurer l\'intégralité de votre bot' },
];

const FOOTER_LINKS = [
  { icon: BookOpen, label: 'Documentation', href: 'https://docs.pinguin.ovh/' },
  { icon: MessageCircle, label: 'Support Discord', href: 'https://discord.gg/EJHhcYkXMQ' },
  { icon: Github, label: 'GitHub', href: 'https://github.com/pinguin-empire/pinguin-bot' },
];

// ─── Animated Counter Hook ─────────────────────────────────────────────

function useAnimatedCounter(target: number, start: boolean): number {
  const [count, setCount] = useState(0);
  const rafRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!start || doneRef.current) {
      if (!start) doneRef.current = false;
      return;
    }
    doneRef.current = true;
    const duration = 1500;
    const t0 = performance.now();

    const animate = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - (1 - p) * (1 - p);
      setCount(Math.round(eased * target));
      if (p < 1) rafRef.current = requestAnimationFrame(animate);
      else setCount(target);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, start]);

  return count;
}

// ─── Page ──────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mql.matches);
    const h = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener('change', h);
    return () => mql.removeEventListener('change', h);
  }, []);

  useEffect(() => {
    getUser().then(setUser).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    fetch('/api/stats/public')
      .then((r) => r.json())
      .then((data) => {
        const d = data.data ?? data;
        setStats({
          totalGuilds: d.totalGuilds ?? d.guilds ?? 42,
          totalUsers: d.totalUsers ?? d.members ?? 1200,
          totalCommands: d.totalCommands ?? d.commands ?? 10000,
        });
      })
      .catch(() => setStats({ totalGuilds: 42, totalUsers: 1200, totalCommands: 10000 }));
  }, []);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    if (reducedMotion) { setStatsVisible(true); return; }
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setStatsVisible(true); obs.disconnect(); } },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reducedMotion]);

  const guildsCount = useAnimatedCounter(stats?.totalGuilds ?? 0, statsVisible && stats !== null);
  const usersCount = useAnimatedCounter(stats?.totalUsers ?? 0, statsVisible && stats !== null);
  const commandsCount = useAnimatedCounter(stats?.totalCommands ?? 0, statsVisible && stats !== null);

  const fmt = (n: number) => n.toLocaleString('fr-FR');
  const noAnim = reducedMotion;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', overflow: 'hidden' }}>
      {/* ─── Navbar ─── */}
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 64,
          padding: '0 24px',
          backgroundColor: scrolled ? 'color-mix(in srgb, var(--bg-header) 80%, transparent)' : 'transparent',
          borderBottom: scrolled ? '1px solid var(--border-color)' : '1px solid transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
          transition: 'background-color 0.3s, border-color 0.3s, backdrop-filter 0.3s',
        }}
      >
        <Logo withText size={24} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {user === undefined ? (
            <div
              style={{
                width: 80,
                height: 36,
                backgroundColor: 'var(--bg-surface-alt)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--text-primary) 5%, transparent), transparent)',
                  animation: 'shimmer 1.5s infinite',
                }}
              />
            </div>
          ) : user ? (
            <a
              href="/servers"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                border: '1px solid var(--border-color)',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              Dashboard
            </a>
          ) : (
            <a
              href="/auth/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                border: 'none',
                backgroundColor: '#5865F2',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'background-color 0.15s, transform 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4752C4'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#5865F2'; }}
            >
              <svg width="16" height="16" viewBox="0 0 127.14 96.36" fill="currentColor">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,56.6,124.08,32.64,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
              </svg>
              Se connecter avec Discord
            </a>
          )}
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '120px 24px 80px',
          textAlign: 'center',
          position: 'relative',
          background: `radial-gradient(ellipse 80% 60% at 50% -20%, color-mix(in srgb, var(--accent) 6%, transparent), transparent),
                       radial-gradient(ellipse 60% 50% at 80% 80%, color-mix(in srgb, var(--accent) 3%, transparent), transparent),
                       var(--bg-primary)`,
        }}
      >
        {/* Geometric pattern overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.03,
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            pointerEvents: 'none',
          }}
        />

        <motion.div
          initial={noAnim ? undefined : { opacity: 0, y: 30 }}
          animate={noAnim ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          style={{ marginBottom: 32, position: 'relative' }}
        >
          <Logo size={80} />
        </motion.div>

        <motion.h1
          initial={noAnim ? undefined : { opacity: 0, y: 30 }}
          animate={noAnim ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          style={{
            fontSize: 'clamp(1.75rem, 5vw, 3.5rem)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            position: 'relative',
          }}
        >
          Pinguin{' '}
          <span style={{ color: 'var(--text-secondary)' }}>—</span>{' '}
          <span style={{ color: 'var(--accent)' }}>Le bot Discord tout-en-un</span>
        </motion.h1>

        <motion.p
          initial={noAnim ? undefined : { opacity: 0, y: 30 }}
          animate={noAnim ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          style={{
            fontSize: 'clamp(0.95rem, 1.5vw, 1.15rem)',
            color: 'var(--text-secondary)',
            marginTop: 16,
            marginBottom: 48,
            maxWidth: 540,
            lineHeight: 1.6,
          }}
        >
          Modération, tickets, sondages, logs, économie, musique, niveaux et bien plus.
          Gérez et personnalisez l'intégralité de votre serveur depuis un seul endroit.
        </motion.p>

        <motion.div
          initial={noAnim ? undefined : { opacity: 0, y: 30 }}
          animate={noAnim ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}
        >
          {user ? (
            <a
              href="/servers"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: 'var(--accent)',
                color: 'var(--bg-primary)',
                padding: '12px 28px',
                border: 'none',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
            >
              Dashboard
              <ChevronRight size={16} />
            </a>
          ) : (
            <a
              href="/auth/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                backgroundColor: '#5865F2',
                color: '#ffffff',
                padding: '14px 32px',
                border: 'none',
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'background-color 0.15s, transform 0.15s',
                boxShadow: '0 4px 24px color-mix(in srgb, #5865F2 30%, transparent)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#4752C4';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#5865F2';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 127.14 96.36" fill="currentColor">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,56.6,124.08,32.64,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
              </svg>
              Se connecter avec Discord
            </a>
          )}

          <a
            href="https://discord.gg/EJHhcYkXMQ"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              padding: '12px 24px',
              border: '1px solid var(--border-color)',
              fontWeight: 500,
              fontSize: 14,
              cursor: 'pointer',
              textDecoration: 'none',
              transition: 'background-color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)';
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <MessageCircle size={16} />
            Communauté
          </a>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.6 }}
          style={{
            position: 'absolute',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          <motion.div
            animate={noAnim ? undefined : { y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              width: 20,
              height: 32,
              border: '1.5px solid var(--text-secondary)',
              display: 'flex',
              justifyContent: 'center',
              paddingTop: 6,
            }}
          >
            <div
              style={{
                width: 2,
                height: 8,
                backgroundColor: 'var(--text-secondary)',
              }}
            />
          </motion.div>
        </motion.div>
      </section>

      {/* ─── FEATURES ─── */}
      <section
        style={{
          padding: '100px 24px',
          maxWidth: 1100,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <motion.div
          initial={noAnim ? undefined : { opacity: 0, y: 20 }}
          whileInView={noAnim ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ textAlign: 'center', marginBottom: 56 }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
              color: 'var(--accent)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 16,
            }}
          >
            Fonctionnalités
          </div>
          <h2
            style={{
              fontSize: 'clamp(1.35rem, 3vw, 2rem)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Tout ce dont votre serveur a besoin
          </h2>
          <p
            style={{
              fontSize: 14,
              color: 'var(--text-secondary)',
              marginTop: 12,
              maxWidth: 480,
              marginLeft: 'auto',
              marginRight: 'auto',
              lineHeight: 1.6,
            }}
          >
            Des outils complets pour modérer, engager et développer votre communauté Discord.
          </p>
        </motion.div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={noAnim ? undefined : { opacity: 0, y: 20 }}
                whileInView={noAnim ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: noAnim ? 0 : i * 0.08 }}
                whileHover={noAnim ? undefined : { y: -4 }}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  padding: 24,
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'border-color 0.2s, background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--accent) 3%, var(--bg-surface))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                    color: 'var(--accent)',
                    marginBottom: 16,
                  }}
                >
                  <Icon size={18} />
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: 8,
                  }}
                >
                  {f.title}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                  }}
                >
                  {f.description}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section
        ref={statsRef}
        style={{
          padding: '80px 24px',
          position: 'relative',
          borderTop: '1px solid var(--border-color)',
          borderBottom: '1px solid var(--border-color)',
          background: `linear-gradient(180deg, var(--bg-primary) 0%, color-mix(in srgb, var(--accent) 2%, var(--bg-primary)) 50%, var(--bg-primary) 100%)`,
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 32,
            textAlign: 'center',
          }}
        >
          <StatCard
            value={stats === null ? '—' : `${fmt(guildsCount)}`}
            label="Serveurs"
            visible={statsVisible}
            index={0}
            noAnim={noAnim}
          />
          <StatCard
            value={stats === null ? '—' : `${fmt(usersCount)}+`}
            label="Membres"
            visible={statsVisible}
            index={1}
            noAnim={noAnim}
          />
          <StatCard
            value={stats === null ? '—' : `${fmt(commandsCount)}+`}
            label="Commandes exécutées"
            visible={statsVisible}
            index={2}
            noAnim={noAnim}
          />
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section
        style={{
          padding: '100px 24px',
          textAlign: 'center',
          maxWidth: 600,
          margin: '0 auto',
        }}
      >
        <motion.div
          initial={noAnim ? undefined : { opacity: 0, y: 20 }}
          whileInView={noAnim ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2
            style={{
              fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '0 0 16px',
              letterSpacing: '-0.01em',
            }}
          >
            Prêt à simplifier la gestion de votre serveur&nbsp;?
          </h2>
          <p
            style={{
              fontSize: 14,
              color: 'var(--text-secondary)',
              marginBottom: 32,
              lineHeight: 1.6,
            }}
          >
            Rejoignez des milliers de serveurs qui font confiance à Pinguin pour la modération,
            les tickets et bien plus encore.
          </p>
          {!user && (
            <a
              href="/auth/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                backgroundColor: '#5865F2',
                color: '#ffffff',
                padding: '14px 32px',
                border: 'none',
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'background-color 0.15s, transform 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#4752C4';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#5865F2';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 127.14 96.36" fill="currentColor">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,56.6,124.08,32.64,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
              </svg>
              Commencer maintenant
            </a>
          )}
        </motion.div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer
        style={{
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-sidebar)',
          padding: '48px 24px 24px',
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 48,
            justifyContent: 'space-between',
          }}
        >
          <div style={{ maxWidth: 260 }}>
            <Logo withText size={22} />
            <p
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                marginTop: 12,
                lineHeight: 1.6,
              }}
            >
              Le bot Discord tout-en-un pour modérer, engager et développer votre communauté.
            </p>
          </div>

          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                marginBottom: 16,
              }}
            >
              Liens
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {FOOTER_LINKS.map((link) => {
                const LinkIcon = link.icon;
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                      textDecoration: 'none',
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  >
                    <LinkIcon size={14} />
                    {link.label}
                  </a>
                );
              })}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                marginBottom: 16,
              }}
            >
              Produit
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <a
                href="/auth/login"
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                Connexion
              </a>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                v1.0.0-alpha
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            maxWidth: 1100,
            margin: '40px auto 0',
            borderTop: '1px solid var(--border-color)',
            paddingTop: 20,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
            © {new Date().getFullYear()} Pinguin Empire — Tous droits réservés
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
            Propulsé par{' '}
            <span style={{ color: 'var(--accent)' }}>Pinguin Bot</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  visible,
  index,
  noAnim,
}: {
  value: string;
  label: string;
  visible: boolean;
  index: number;
  noAnim: boolean;
}) {
  return (
    <motion.div
      initial={noAnim ? undefined : { opacity: 0, y: 20 }}
      animate={visible || noAnim ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, delay: noAnim ? 0 : index * 0.15 }}
    >
      <div
        style={{
          fontSize: 'clamp(2rem, 4vw, 3rem)',
          fontWeight: 700,
          color: 'var(--accent)',
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          marginTop: 6,
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          width: 40,
          height: 2,
          backgroundColor: 'var(--accent)',
          margin: '12px auto 0',
          opacity: 0.4,
        }}
      />
    </motion.div>
  );
}
