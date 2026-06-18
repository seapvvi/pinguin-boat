'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Shield, ShieldAlert, Ticket, Trophy, Wallet, Gift,
  ScrollText, Radio, UserPlus, ExternalLink, X,
} from 'lucide-react';
import { Logo } from '@pinguin/ui';
import ThemeSelector from '@/components/ThemeSelector';
import { getUser, type User } from '@/lib/auth';

// ─── Types ─────────────────────────────────────────────────────────────

interface StatsData {
  guilds: number;
  members: number;
  commands: number;
}

interface Feature {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  description: string;
}

interface Cmd {
  name: string;
  args: string;
  description: string;
}

// ─── Constants ─────────────────────────────────────────────────────────

const FEATURES: Feature[] = [
  { icon: Shield, title: 'Modération', description: 'Gestion des sanctions, mutes, bans automatiques' },
  { icon: ShieldAlert, title: 'Auto-Modération', description: 'Filtres de spam, liens, mots interdits' },
  { icon: Ticket, title: 'Tickets', description: 'Système de support avec catégories et logs' },
  { icon: Trophy, title: 'Niveaux / XP', description: "Système d'expérience et classements" },
  { icon: Wallet, title: 'Économie', description: 'Monnaie virtuelle, shop, transferts' },
  { icon: Gift, title: 'Giveaways', description: 'Tirages au sort automatisés' },
  { icon: ScrollText, title: 'Logs', description: 'Historique complet des actions serveur' },
  { icon: Radio, title: 'Musique', description: 'Lecture audio depuis YouTube et plus' },
];

const COMMANDS: Cmd[] = [
  { name: 'ban', args: '[utilisateur] [raison]', description: 'Bannir un membre du serveur' },
  { name: 'mute', args: '[utilisateur] [durée]', description: 'Rendre muet temporairement' },
  { name: 'ticket create', args: '', description: 'Ouvrir un ticket de support' },
  { name: 'giveaway create', args: '[durée] [prix]', description: 'Lancer un giveaway' },
  { name: 'rank', args: '[utilisateur]', description: "Voir le niveau XP d'un membre" },
  { name: 'balance', args: '[utilisateur]', description: 'Consulter le solde économique' },
  { name: 'poll', args: '[question]', description: 'Créer un sondage rapide' },
  { name: 'embed create', args: '', description: 'Créer un message embed personnalisé' },
];

// ─── Animated Counter Hook ─────────────────────────────────────────────

function useAnimatedCounter(target: number, start: boolean): number {
  const [count, setCount] = useState(0);
  const rafRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!start || doneRef.current) {
      if (!start) { doneRef.current = false; }
      return;
    }
    doneRef.current = true;
    const duration = 1500;
    const t0 = performance.now();

    const animate = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - (1 - p) * (1 - p);
      setCount(Math.round(eased * target));
      if (p < 1) { rafRef.current = requestAnimationFrame(animate); }
      else { setCount(target); }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, start]);

  return count;
}

// ─── Skeleton ──────────────────────────────────────────────────────────

function StatSkeleton() {
  return (
    <div
      style={{
        display: 'inline-block',
        width: 80,
        height: 32,
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
  );
}

// ─── Page ──────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [alphaDismissed, setAlphaDismissed] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [botOnline, setBotOnline] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
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
    fetch('/api/stats')
      .then((r) => r.json())
      .then((data) => {
        const d = data.data ?? data;
        setStats({
          guilds: d.totalGuilds ?? d.guilds ?? 42,
          members: d.totalUsers ?? d.members ?? 1200,
          commands: d.totalCommands ?? d.commands ?? 10000,
        });
      })
      .catch(() => setStats({ guilds: 42, members: 1200, commands: 10000 }));
  }, []);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => setBotOnline(data.status === 'ok' || data.status === 'online'))
      .catch(() => setBotOnline(true));
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

  const guildsCount = useAnimatedCounter(stats?.guilds ?? 0, statsVisible && stats !== null);
  const membersCount = useAnimatedCounter(stats?.members ?? 0, statsVisible && stats !== null);
  const commandsCount = useAnimatedCounter(stats?.commands ?? 0, statsVisible && stats !== null);

  const fmt = (n: number) => n.toLocaleString('fr-FR');
  const noAnim = reducedMotion;
  const sectionPadded: React.CSSProperties = { padding: '80px 24px' };

  const mInit = noAnim ? undefined : { opacity: 0, y: 30 };
  const mNoY = noAnim ? undefined : { opacity: 0, y: 0 };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* ──────────── NAVBAR ──────────── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 60,
          padding: '0 24px',
          backgroundColor: scrolled
            ? 'color-mix(in srgb, var(--bg-header) 85%, transparent)'
            : 'var(--bg-header)',
          borderBottom: '1px solid var(--border-color)',
          backdropFilter: scrolled ? 'blur(8px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(8px)' : 'none',
          transition: 'backdrop-filter 0.2s, background-color 0.2s',
        }}
      >
        <motion.div
          initial={mNoY}
          animate={noAnim ? undefined : { opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Logo withText size={28} />
        </motion.div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThemeSelector />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              border: '1px solid var(--border-color)',
              fontSize: 12,
              color: 'var(--text-secondary)',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                backgroundColor: botOnline ? 'var(--success)' : 'var(--error)',
                display: 'inline-block',
              }}
            />
            <span style={{ whiteSpace: 'nowrap' }}>{botOnline ? 'En ligne' : 'Hors ligne'}</span>
          </div>

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
            <motion.a
              whileHover={noAnim ? undefined : { scale: 1.02 }}
              whileTap={noAnim ? undefined : { scale: 0.98 }}
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
            </motion.a>
          ) : (
            <motion.a
              whileHover={noAnim ? undefined : { scale: 1.02 }}
              whileTap={noAnim ? undefined : { scale: 0.98 }}
              href="/auth/login"
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
              Login
            </motion.a>
          )}
        </div>
      </header>

      {/* ──────────── ALPHA BANNER ──────────── */}
      {!alphaDismissed && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 40,
            backgroundColor: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-color)',
            padding: '0 16px',
            fontSize: 12,
            color: 'var(--text-secondary)',
            gap: 6,
          }}
        >
          <span>🚧 Pinguin Boat est en Early Alpha — des bugs peuvent survenir.</span>
          <a
            href="https://discord.gg/EJHhcYkXMQ"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            Rejoindre le Discord →
          </a>
          <button
            type="button"
            onClick={() => setAlphaDismissed(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 4,
              marginLeft: 8,
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
            aria-label="Fermer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ──────────── HERO ──────────── */}
      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: alphaDismissed ? 'calc(100vh - 60px)' : 'calc(100vh - 100px)',
          ...sectionPadded,
          textAlign: 'center',
        }}
      >
        <motion.div
          initial={mInit}
          animate={noAnim ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0 }}
          style={{ marginBottom: 24 }}
        >
          <Logo size={64} />
        </motion.div>

        <motion.h1
          initial={mInit}
          animate={noAnim ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0 }}
          style={{
            fontSize: 'clamp(2.5rem, 6vw, 5rem)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          PINGUIN BOAT
        </motion.h1>

        <motion.p
          initial={mInit}
          animate={noAnim ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          style={{
            fontSize: '1.1rem',
            color: 'var(--text-secondary)',
            marginTop: 16,
            marginBottom: 48,
            maxWidth: 480,
          }}
        >
          Le bot Discord forgé pour la communauté Pinguin Empire
        </motion.p>

        {/* Stats */}
        <motion.div
          ref={statsRef}
          initial={mInit}
          animate={noAnim ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0,
            marginBottom: 48,
            flexWrap: 'wrap',
          }}
        >
          <StatItem
            value={stats === null ? <StatSkeleton /> : `${fmt(guildsCount)}${stats.guilds >= 10000 ? '+' : ''}`}
            label="serveurs"
          />
          <Divider />
          <StatItem
            value={stats === null ? <StatSkeleton /> : `${fmt(membersCount)}${stats.members >= 10000 ? '+' : ''}`}
            label="membres"
          />
          <Divider />
          <StatItem
            value={stats === null ? <StatSkeleton /> : `${fmt(commandsCount)}+`}
            label="commandes utilisées"
          />
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={mInit}
          animate={noAnim ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}
        >
          <motion.a
            href="#invite-bot"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: 'var(--accent)',
              color: 'var(--bg-primary)',
              padding: '10px 24px',
              border: 'none',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              textDecoration: 'none',
              transition: 'background-color 0.15s',
            }}
            whileHover={noAnim ? undefined : { scale: 1.02 }}
            whileTap={noAnim ? undefined : { scale: 0.98 }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
          >
            <UserPlus size={16} />
            Inviter le bot
          </motion.a>
          <motion.a
            href="https://pinguin.ovh/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              padding: '10px 24px',
              border: '1px solid var(--border-color)',
              fontWeight: 500,
              fontSize: 14,
              cursor: 'pointer',
              textDecoration: 'none',
              transition: 'background-color 0.15s, border-color 0.15s',
            }}
            whileHover={noAnim ? undefined : { scale: 1.02 }}
            whileTap={noAnim ? undefined : { scale: 0.98 }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)';
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <ExternalLink size={16} />
            Pinguin Empire
          </motion.a>
        </motion.div>
      </section>

      {/* ──────────── FEATURES ──────────── */}
      <section style={{ ...sectionPadded, maxWidth: 1040, margin: '0 auto' }}>
        <motion.div
          initial={mInit}
          whileInView={noAnim ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: 48 }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
              marginBottom: 8,
            }}
          >
            Fonctionnalités
          </div>
          <h2
            style={{
              fontSize: '1.5rem',
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Tout ce dont votre serveur a besoin
          </h2>
        </motion.div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
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
                transition={{ duration: 0.5, delay: noAnim ? 0 : i * 0.1 }}
                whileHover={noAnim ? undefined : { y: -2 }}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  padding: 20,
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
              >
                <div style={{ color: 'var(--accent)', marginBottom: 12 }}>
                  <Icon size={20} />
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: 6,
                  }}
                >
                  {f.title}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                  }}
                >
                  {f.description}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ──────────── COMMANDS ──────────── */}
      <section style={{ ...sectionPadded, maxWidth: 720, margin: '0 auto' }}>
        <motion.div
          initial={mInit}
          whileInView={noAnim ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: 48 }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
              marginBottom: 8,
            }}
          >
            Commandes
          </div>
          <h2
            style={{
              fontSize: '1.5rem',
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Les commandes les plus utilisées
          </h2>
        </motion.div>

        <motion.div
          initial={noAnim ? undefined : { opacity: 0, x: -30 }}
          whileInView={noAnim ? undefined : { opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
          }}
        >
          {/* Terminal header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 20px',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            <span style={{ width: 8, height: 8, backgroundColor: 'var(--error)', display: 'inline-block' }} />
            <span style={{ width: 8, height: 8, backgroundColor: 'var(--warning)', display: 'inline-block' }} />
            <span style={{ width: 8, height: 8, backgroundColor: 'var(--success)', display: 'inline-block' }} />
            <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
              pinguin-boat ~ /commands
            </span>
          </div>

          <div style={{ padding: '4px 0' }}>
            {COMMANDS.map((cmd, i) => (
              <motion.div
                key={cmd.name}
                initial={noAnim ? undefined : { opacity: 0, x: -20 }}
                whileInView={noAnim ? undefined : { opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: noAnim ? 0 : i * 0.08 }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 20px',
                    borderBottom: i < COMMANDS.length - 1 ? '1px solid var(--border-color)' : 'none',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 13 }}>/</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 }}>{cmd.name}</span>
                  {cmd.args && (
                    <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{cmd.args}</span>
                  )}
                  <span
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: 12,
                      marginLeft: 'auto',
                    }}
                  >
                    {cmd.description}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ──────────── FOOTER ──────────── */}
      <footer
        style={{
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-sidebar)',
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 1040,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 32,
          }}
        >
          <div>
            <Logo withText size={24} />
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 12, marginBottom: 8 }}>
              Forgé pour la communauté
            </p>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
              v1.0.0-alpha
            </span>
          </div>

          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                marginBottom: 12,
              }}
            >
              Liens
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <FooterLink href="https://pinguin.ovh/" label="Pinguin Empire" />
              <FooterLink href="https://discord.gg/EJHhcYkXMQ" label="Discord Support" />
              <FooterLink href="#invite-bot" label="Inviter le bot" />
              <FooterLink href="/servers" label="Dashboard" />
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
                marginBottom: 12,
              }}
            >
              Statut
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  backgroundColor: botOnline ? 'var(--success)' : 'var(--error)',
                  display: 'inline-block',
                }}
              />
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                {botOnline ? 'Tous les systèmes opérationnels' : 'Dégradé'}
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            maxWidth: 1040,
            margin: '24px auto 0',
            borderTop: '1px solid var(--border-color)',
            paddingTop: 16,
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
            © 2026 Pinguin Empire — Tous droits réservés
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function StatItem({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 16px',
      }}
    >
      <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
        {value}
      </span>
      <span
        style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-secondary)',
          marginTop: 4,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function Divider() {
  return (
    <span
      style={{
        width: 1,
        height: 48,
        backgroundColor: 'var(--border-color)',
        flexShrink: 0,
      }}
    />
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  const isExternal = href.startsWith('http');
  return (
    <a
      href={href}
      {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      style={{
        fontSize: 13,
        color: 'var(--text-secondary)',
        textDecoration: 'none',
        transition: 'color 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
    >
      {label}
    </a>
  );
}
