'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Shield, Ticket, BarChart3, ScrollText, Terminal, LayoutDashboard,
  Check, MessageCircle, Github, BookOpen,
} from 'lucide-react';
import { Logo } from '@pinguin/ui';
import { getUser, type User } from '@/lib/auth';
import './page.css';

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

interface TerminalLine {
  text: string;
  revealed: string;
  done: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Fonctionnalités', href: '#features' },
  { label: 'Statistiques', href: '#stats' },
  { label: 'Documentation', href: '#docs' },
  { label: 'Support', href: '#support' },
];

const FEATURES: Feature[] = [
  {
    icon: Shield,
    title: 'Modération avancée',
    description:
      'Protégez votre serveur avec des filtres anti-spam, anti-lien, anti-mass-mention, détection de raids et sanctions automatiques configurables en un clic depuis le dashboard.',
  },
  {
    icon: Ticket,
    title: 'Tickets organisés',
    description:
      'Un système de support complet avec catégories personnalisées, assignation manuelle, transcripts HTML et historique complet des échanges.',
  },
  {
    icon: BarChart3,
    title: 'Sondages & votes',
    description:
      'Créez des sondages avancés, des votes récurrents et recueillez les suggestions de votre communauté en toute simplicité.',
  },
  {
    icon: LayoutDashboard,
    title: 'Dashboard web complet',
    description:
      'Interface intuitive temps réel pour configurer chaque module, visualiser les logs, gérer les permissions et tout personnaliser sans toucher une ligne de code.',
  },
  {
    icon: ScrollText,
    title: 'Logs & audit détaillés',
    description:
      'Journalisation exhaustive des actions modération, messages supprimés, sanctions et événements serveur avec recherche et filtres avancés.',
  },
  {
    icon: Terminal,
    title: 'Commandes personnalisées',
    description:
      'Créez vos propres commandes sans aucune connaissance technique via un éditeur visuel intégré au dashboard.',
  },
];

const FEATURE_NUMBERS = ['01', '02', '03', '04', '05', '06'];

const FOOTER_LINKS = [
  { icon: BookOpen, label: 'Documentation', href: 'https://docs.pinguin.ovh/' },
  { icon: MessageCircle, label: 'Support Discord', href: 'https://discord.gg/EJHhcYkXMQ' },
  { icon: Github, label: 'GitHub', href: 'https://github.com/pinguin-empire/pinguin-bot' },
];

const SOCIAL_PROOF_ITEMS = [
  'Plus de 40 serveurs font confiance à Pinguin',
  'Dashboard mis à jour en continu',
  'Support actif sur Discord',
  'Open source et transparent',
];

const TERMINAL_LINES: TerminalLine[] = [
  { text: '$ pinguin status .............. ✓ Online', revealed: '', done: false },
  { text: '$ guilds connected ............ 42', revealed: '', done: false },
  { text: '$ commands registered ......... 156', revealed: '', done: false },
  { text: '$ uptime ...................... 99.9%', revealed: '', done: false },
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

// ─── Terminal Typewriter Hook ──────────────────────────────────────────

function useTerminalTypewriter(
  enabled: boolean,
  reducedMotion: boolean,
): TerminalLine[] {
  const [lines, setLines] = useState<TerminalLine[]>(
    TERMINAL_LINES.map((l) => ({ ...l, revealed: reducedMotion ? l.text : '' })),
  );

  useEffect(() => {
    if (reducedMotion) {
      setLines(TERMINAL_LINES.map((l) => ({ ...l, revealed: l.text, done: true })));
      return;
    }
    if (!enabled) return;

    setLines(TERMINAL_LINES.map((l) => ({ ...l, revealed: '', done: false })));

    let currentLine = 0;
    let currentChar = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const typeNext = () => {
      if (currentLine >= TERMINAL_LINES.length) return;
      const line = TERMINAL_LINES[currentLine];
      if (currentChar < line.text.length) {
        currentChar++;
        setLines((prev) => {
          const next = [...prev];
          next[currentLine] = {
            ...next[currentLine],
            revealed: line.text.slice(0, currentChar),
          };
          return next;
        });
        timers.push(setTimeout(typeNext, 25));
      } else {
        setLines((prev) => {
          const next = [...prev];
          next[currentLine] = { ...next[currentLine], done: true };
          return next;
        });
        currentLine++;
        currentChar = 0;
        if (currentLine < TERMINAL_LINES.length) {
          timers.push(setTimeout(typeNext, 300));
        }
      }
    };

    timers.push(setTimeout(typeNext, 500));

    return () => timers.forEach(clearTimeout);
  }, [enabled, reducedMotion]);

  return lines;
}

// ─── Motion Easing ──────────────────────────────────────────────────────

const SPRING_EASE = [0.16, 1, 0.3, 1] as const;

// ─── Page ──────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [terminalReady, setTerminalReady] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

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
    const onScroll = () => setScrolled(window.scrollY > 20);
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
    if (reducedMotion) {
      setStatsVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setStatsVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) {
      setTerminalReady(true);
      return;
    }
    const el = heroRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setTimeout(() => setTerminalReady(true), 800);
          obs.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reducedMotion]);

  const guildsCount = useAnimatedCounter(stats?.totalGuilds ?? 0, statsVisible && stats !== null);
  const usersCount = useAnimatedCounter(stats?.totalUsers ?? 0, statsVisible && stats !== null);
  const commandsCount = useAnimatedCounter(stats?.totalCommands ?? 0, statsVisible && stats !== null);

  const terminalLines = useTerminalTypewriter(terminalReady, reducedMotion);

  const fmt = (n: number) => n.toLocaleString('fr-FR');
  const noAnim = reducedMotion;

  const scrollToFeatures = useCallback(() => {
    const el = document.getElementById('features');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', overflow: 'hidden' }}>
      {/* ─── NAVBAR ─── */}
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
          height: 56,
          padding: '0 24px',
          backgroundColor: scrolled ? 'var(--bg-sidebar)' : 'transparent',
          borderBottom: scrolled ? '1px solid var(--border-color)' : '1px solid transparent',
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(16px)' : 'none',
          transition: 'background-color 200ms, border-color 200ms, backdrop-filter 200ms',
        }}
      >
        <Logo withText size={20} />

        {/* Desktop nav links */}
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 32,
          }}
          className="hidden md:flex"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              style={{
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '0.06em',
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                textTransform: 'uppercase',
                transition: 'color 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              {link.label}
            </a>
          ))}
        </nav>

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
                  background:
                    'linear-gradient(90deg, transparent, color-mix(in srgb, var(--text-primary) 5%, transparent), transparent)',
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
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                textDecoration: 'none',
                letterSpacing: '0.03em',
                transition: 'background-color 150ms, border-color 150ms',
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
              Dashboard →
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
                transition: 'background-color 150ms, transform 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#4752C4';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#5865F2';
              }}
            >
              Se connecter
            </a>
          )}
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section
        ref={heroRef}
        id="hero"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '120px 24px 80px',
          textAlign: 'center',
          position: 'relative',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        {/* Scanline overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.4,
            pointerEvents: 'none',
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 2px, color-mix(in srgb, var(--text-primary) 1.5%, transparent) 2px, color-mix(in srgb, var(--text-primary) 1.5%, transparent) 4px)',
          }}
        />

        {/* Radial halo */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(ellipse 70% 50% at 50% 0%, color-mix(in srgb, var(--accent) 4%, transparent), transparent 70%)',
          }}
        />

        {/* Badge */}
        <motion.div
          initial={noAnim ? undefined : { opacity: 0, y: -12 }}
          animate={noAnim ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: SPRING_EASE }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            fontSize: 10,
            letterSpacing: '0.12em',
            padding: '4px 12px',
            fontFamily: 'JetBrains Mono, monospace',
            textTransform: 'uppercase',
            marginBottom: 24,
          }}
        >
          [ BOT DISCORD • v1.0 ALPHA ]
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={noAnim ? undefined : { opacity: 0, y: 24 }}
          animate={noAnim ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: SPRING_EASE }}
          style={{
            fontSize: 'clamp(4rem, 10vw, 9rem)',
            fontWeight: 900,
            color: 'var(--text-primary)',
            letterSpacing: '-0.04em',
            lineHeight: 0.9,
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          PINGUIN
        </motion.h1>

        <motion.div
          initial={noAnim ? undefined : { opacity: 0, y: 16 }}
          animate={noAnim ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: SPRING_EASE }}
          style={{
            fontSize: 'clamp(0.75rem, 1.5vw, 1rem)',
            color: 'var(--text-secondary)',
            letterSpacing: '0.2em',
            fontFamily: 'JetBrains Mono, monospace',
            marginTop: 8,
          }}
        >
          ——— Le bot Discord tout-en-un ———
        </motion.div>

        {/* Description */}
        <motion.p
          initial={noAnim ? undefined : { opacity: 0, y: 24 }}
          animate={noAnim ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: SPRING_EASE }}
          style={{
            maxWidth: 520,
            fontSize: 'clamp(0.9rem, 1.5vw, 1.05rem)',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            marginTop: 24,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          Modération avancée, tickets, sondages, logs, économie et commandes
          personnalisées — tout configurer depuis un seul dashboard web.
        </motion.p>

        {/* Button group */}
        <motion.div
          initial={noAnim ? undefined : { opacity: 0, y: 24 }}
          animate={noAnim ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: SPRING_EASE }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            marginTop: 40,
            flexWrap: 'wrap',
          }}
        >
          {user ? (
            <a
              href="/servers"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: '#5865F2',
                color: '#ffffff',
                padding: '13px 28px',
                border: 'none',
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: '0.03em',
                cursor: 'pointer',
                textDecoration: 'none',
                boxShadow: '0 0 40px color-mix(in srgb, #5865F2 20%, transparent)',
                transition: 'background-color 150ms, transform 150ms, box-shadow 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#4752C4';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 40px color-mix(in srgb, #5865F2 40%, transparent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#5865F2';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 0 40px color-mix(in srgb, #5865F2 20%, transparent)';
              }}
            >
              Accéder au Dashboard →
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
                padding: '13px 28px',
                border: 'none',
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: '0.03em',
                cursor: 'pointer',
                textDecoration: 'none',
                boxShadow: '0 0 40px color-mix(in srgb, #5865F2 20%, transparent)',
                transition: 'background-color 150ms, transform 150ms, box-shadow 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#4752C4';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 40px color-mix(in srgb, #5865F2 40%, transparent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#5865F2';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 0 40px color-mix(in srgb, #5865F2 20%, transparent)';
              }}
            >
              <svg width="18" height="18" viewBox="0 0 127.14 96.36" fill="currentColor">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,56.6,124.08,32.64,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
              </svg>
              Se connecter avec Discord
            </a>
          )}

          <button
            onClick={scrollToFeatures}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: 'transparent',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              padding: '13px 24px',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'border-color 150ms, color 150ms, background-color 150ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Voir les fonctionnalités
          </button>
        </motion.div>

        {/* Terminal mock */}
        <motion.div
          initial={noAnim ? undefined : { opacity: 0, y: 24 }}
          animate={noAnim ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6, ease: SPRING_EASE }}
          style={{
            maxWidth: 600,
            width: '100%',
            marginTop: 48,
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)',
            overflow: 'hidden',
          }}
          className="hidden sm:block"
        >
          {/* Terminal header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-sidebar)',
            }}
          >
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  backgroundColor: '#ef4444',
                }}
              />
              <div
                style={{
                  width: 10,
                  height: 10,
                  backgroundColor: '#f59e0b',
                }}
              />
              <div
                style={{
                  width: 10,
                  height: 10,
                  backgroundColor: '#22c55e',
                }}
              />
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                fontFamily: 'JetBrains Mono, monospace',
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              pinguin@bot ~ %
            </div>
            <div style={{ width: 46 }} />
          </div>

          {/* Terminal body */}
          <div style={{ padding: '12px 16px' }}>
            {terminalLines.map((line, i) => (
              <div
                key={i}
                style={{
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono, monospace',
                  color: 'var(--text-primary)',
                  lineHeight: 1.8,
                  minHeight: 20,
                  whiteSpace: 'pre',
                }}
              >
                {line.revealed}
                {line.done && i === terminalLines.length - 1 && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 2,
                      height: 14,
                      backgroundColor: 'var(--accent)',
                      marginLeft: 2,
                      verticalAlign: 'middle',
                      animation: 'blink 1s step-end infinite',
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ─── STATS ─── */}
      <section
        ref={statsRef}
        id="stats"
        style={{
          padding: '80px 24px',
          borderTop: '1px solid var(--border-color)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        {/* Section label */}
        <motion.div
          initial={noAnim ? undefined : { opacity: 0, y: 12 }}
          whileInView={noAnim ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, ease: SPRING_EASE }}
          style={{
            fontSize: 10,
            letterSpacing: '0.15em',
            color: 'var(--text-secondary)',
            textAlign: 'center',
            marginBottom: 48,
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          ——————— EN TEMPS RÉEL ———————
        </motion.div>

        <div
          style={{
            maxWidth: 1000,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            textAlign: 'center',
          }}
        >
          <StatCard
            value={stats === null ? '—' : `${fmt(guildsCount)}`}
            label="Serveurs"
            visible={statsVisible}
            index={0}
            noAnim={noAnim}
            hasBorder
          />
          <StatCard
            value={stats === null ? '—' : `${fmt(usersCount)}+`}
            label="Membres"
            visible={statsVisible}
            index={1}
            noAnim={noAnim}
            hasBorder
          />
          <StatCard
            value={stats === null ? '—' : `${fmt(commandsCount)}+`}
            label="Commandes exécutées"
            visible={statsVisible}
            index={2}
            noAnim={noAnim}
            hasBorder={false}
          />
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section
        id="features"
        style={{
          padding: '100px 24px',
          maxWidth: 1200,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <motion.div
          initial={noAnim ? undefined : { opacity: 0, y: 20 }}
          whileInView={noAnim ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5, ease: SPRING_EASE }}
        >
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-secondary)',
              letterSpacing: '0.1em',
              fontFamily: 'JetBrains Mono, monospace',
              marginBottom: 8,
            }}
          >
            01
          </div>
          <h2
            style={{
              fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            FONCTIONNALITÉS
          </h2>
          <div
            style={{
              borderBottom: '1px solid var(--border-color)',
              width: 60,
              marginTop: 12,
              marginBottom: 48,
            }}
          />
        </motion.div>

        {/* Asymmetric grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
          }}
          className="features-grid"
        >
          {/* Large card 1: Modération (span 2) */}
          <div className="feature-large">
            <FeatureCard
              feature={FEATURES[0]}
              number={FEATURE_NUMBERS[0]}
              index={0}
              large
              noAnim={noAnim}
            />
          </div>

          {/* Small card 1: Tickets */}
          <FeatureCard
            feature={FEATURES[1]}
            number={FEATURE_NUMBERS[1]}
            index={1}
            noAnim={noAnim}
          />

          {/* Small card 2: Sondages */}
          <FeatureCard
            feature={FEATURES[2]}
            number={FEATURE_NUMBERS[2]}
            index={2}
            noAnim={noAnim}
          />

          {/* Large card 2: Dashboard (span 2) */}
          <div className="feature-large">
            <FeatureCard
              feature={FEATURES[3]}
              number={FEATURE_NUMBERS[3]}
              index={3}
              large
              noAnim={noAnim}
            />
          </div>

          {/* Small card 3: Logs */}
          <FeatureCard
            feature={FEATURES[4]}
            number={FEATURE_NUMBERS[4]}
            index={4}
            noAnim={noAnim}
          />

          {/* Small card 4: Commandes */}
          <FeatureCard
            feature={FEATURES[5]}
            number={FEATURE_NUMBERS[5]}
            index={5}
            noAnim={noAnim}
          />
        </div>
      </section>

      {/* ─── SOCIAL PROOF / TESTIMONIAL ─── */}
      <section
        id="support"
        style={{
          padding: '80px 24px',
          borderTop: '1px solid var(--border-color)',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <div
          style={{
            maxWidth: 1000,
            margin: '0 auto',
            display: 'flex',
            gap: 48,
            alignItems: 'flex-start',
          }}
          className="testimonial-layout"
        >
          {/* Left: quote */}
          <motion.div
            initial={noAnim ? undefined : { opacity: 0, x: -20 }}
            whileInView={noAnim ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: SPRING_EASE }}
            style={{ flex: '1 1 50%' }}
          >
            <div
              style={{
                fontSize: 120,
                color: 'var(--border-color)',
                lineHeight: 1,
                fontFamily: 'JetBrains Mono, monospace',
                marginBottom: -20,
                userSelect: 'none',
              }}
            >
              &ldquo;
            </div>
            <blockquote
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: 'var(--text-primary)',
                lineHeight: 1.5,
                maxWidth: 380,
                margin: 0,
              }}
            >
              La gestion de notre serveur n'a jamais été aussi simple.
              Le système de tickets seul vaut le détour.
            </blockquote>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                marginTop: 16,
                letterSpacing: '0.05em',
              }}
            >
              — Un administrateur de serveur
            </div>
          </motion.div>

          {/* Right: proof items */}
          <motion.div
            initial={noAnim ? undefined : { opacity: 0, x: 20 }}
            whileInView={noAnim ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.15, ease: SPRING_EASE }}
            style={{
              flex: '1 1 50%',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              paddingTop: 12,
            }}
          >
            {SOCIAL_PROOF_ITEMS.map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Check size={14} color="var(--success)" />
                <span
                  style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.4,
                  }}
                >
                  {item}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section
        id="docs"
        style={{
          padding: '120px 24px',
          textAlign: 'center',
          position: 'relative',
          backgroundColor: 'var(--bg-primary)',
          backgroundImage:
            'linear-gradient(var(--border-color) 1px, transparent 1px), linear-gradient(90deg, var(--border-color) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      >
        {/* Dim the grid pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'color-mix(in srgb, var(--bg-primary) 97%, transparent)',
            pointerEvents: 'none',
          }}
        />

        <motion.div
          initial={noAnim ? undefined : { opacity: 0, y: 20 }}
          whileInView={noAnim ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: SPRING_EASE }}
          style={{ position: 'relative', zIndex: 1 }}
        >
          {/* Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              fontSize: 10,
              letterSpacing: '0.12em',
              padding: '4px 12px',
              fontFamily: 'JetBrains Mono, monospace',
              textTransform: 'uppercase',
              marginBottom: 24,
            }}
          >
            [ REJOINDRE MAINTENANT ]
          </div>

          <h2
            style={{
              fontSize: 'clamp(1.5rem, 4vw, 3rem)',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              margin: '0 auto 16px',
              maxWidth: 600,
              lineHeight: 1.15,
            }}
          >
            Prêt à passer à la vitesse supérieure&nbsp;?
          </h2>

          <p
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              maxWidth: 440,
              margin: '0 auto 32px',
              lineHeight: 1.7,
            }}
          >
            Rejoignez des serveurs qui font confiance à Pinguin pour la modération,
            les tickets et bien plus encore — le tout depuis un dashboard unifié.
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
                padding: '13px 28px',
                border: 'none',
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: '0.03em',
                cursor: 'pointer',
                textDecoration: 'none',
                boxShadow: '0 0 40px color-mix(in srgb, #5865F2 20%, transparent)',
                transition: 'background-color 150ms, transform 150ms, box-shadow 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#4752C4';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 40px color-mix(in srgb, #5865F2 40%, transparent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#5865F2';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 0 40px color-mix(in srgb, #5865F2 20%, transparent)';
              }}
            >
              <svg width="18" height="18" viewBox="0 0 127.14 96.36" fill="currentColor">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,56.6,124.08,32.64,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
              </svg>
              Se connecter avec Discord
            </a>
          )}

          <div
            style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              letterSpacing: '0.06em',
              marginTop: 16,
            }}
          >
            Gratuit · Aucune carte requise · Configurable en 2 minutes
          </div>
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
          }}
        >
          {/* Empire line */}
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.1em',
              color: 'var(--text-secondary)',
              fontFamily: 'JetBrains Mono, monospace',
              textAlign: 'center',
              marginBottom: 48,
            }}
          >
            ——————————— PINGUIN EMPIRE ———————————
          </div>

          <div
            style={{
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
                        transition: 'color 150ms',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--accent)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
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
                    transition: 'color 150ms',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--accent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  Connexion
                </a>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    border: '1px solid var(--border-color)',
                    padding: '2px 8px',
                    fontSize: 10,
                    fontFamily: 'JetBrains Mono, monospace',
                    color: 'var(--text-secondary)',
                    width: 'fit-content',
                  }}
                >
                  v1.0.0-alpha
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 40,
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  backgroundColor: 'var(--success)',
                  display: 'inline-block',
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Tous les services opérationnels
              </span>
            </div>
          </div>
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
  hasBorder,
}: {
  value: string;
  label: string;
  visible: boolean;
  index: number;
  noAnim: boolean;
  hasBorder: boolean;
}) {
  return (
    <motion.div
      initial={noAnim ? undefined : { opacity: 0, y: 20 }}
      animate={visible || noAnim ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, delay: noAnim ? 0 : index * 0.15, ease: SPRING_EASE }}
      style={{
        padding: '0 24px',
        borderRight: hasBorder ? '1px solid var(--border-color)' : 'none',
        position: 'relative',
      }}
      className="stat-cell"
    >
      <div
        style={{
          fontSize: 'clamp(3rem, 6vw, 5rem)',
          fontWeight: 900,
          color: 'var(--text-primary)',
          lineHeight: 1,
          letterSpacing: '-0.04em',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
          marginTop: 8,
        }}
      >
        {label}
      </div>
    </motion.div>
  );
}

function FeatureCard({
  feature,
  number,
  index,
  _large,
  noAnim,
}: {
  feature: Feature;
  number: string;
  index: number;
  large?: boolean;
  noAnim: boolean;
}) {
  const Icon = feature.icon;
  return (
    <motion.div
      initial={noAnim ? undefined : { opacity: 0, y: 24 }}
      whileInView={noAnim ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay: noAnim ? 0 : index * 0.07, ease: SPRING_EASE }}
      whileHover={noAnim ? undefined : { y: -3 }}
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-color)',
        padding: 28,
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 200ms',
        height: '100%',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-color)';
      }}
    >
      {/* Feature number top-right */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          fontSize: 10,
          color: 'var(--border-color)',
          fontFamily: 'JetBrains Mono, monospace',
          userSelect: 'none',
        }}
      >
        {number}
      </div>

            {/* Icon */}
            <div style={{ color: 'var(--accent)', display: 'inline-flex' }}>
              <Icon size={20} />
            </div>

      {/* Title */}
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginTop: 16,
        }}
      >
        {feature.title}
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
          marginTop: 8,
        }}
      >
        {feature.description}
      </div>

      {/* Hover line */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: 1,
          width: 0,
          backgroundColor: 'var(--accent)',
          transition: 'width 300ms ease',
        }}
        className="feature-hover-line"
      />
    </motion.div>
  );
}