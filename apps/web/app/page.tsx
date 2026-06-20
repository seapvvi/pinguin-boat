'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform, useInView } from 'motion/react';
import {
  Shield, BarChart3,
  ArrowRight, Users,
  Music, Gamepad2, MessageSquare,
  Gift, Ticket, Hash,
  Star, ChevronRight,
  Terminal, Cpu, Zap,
  Activity, Server,
  Lock, Bell, Sliders,
  Volume2,
  Award, Heart, ExternalLink,
} from 'lucide-react';
import { Logo } from '@pinguin/ui';
import { getUser, type User } from '@/lib/auth';
import './page.css';

/* ─── Types ─── */
interface StatsData {
  totalGuilds: number;
  totalUsers: number;
  totalCommands: number;
  uptime: number;
}

interface FeatureItem {
  icon: React.ReactNode;
  title: string;
  desc: string;
  tag: string;
  color: string;
}

interface ModuleItem {
  icon: React.ReactNode;
  name: string;
  desc: string;
  tag: string;
}

/* ─── Data ─── */
const FEATURES: FeatureItem[] = [
  { icon: <Shield size={20} />, title: 'Modération intelligente', desc: 'Anti-spam, anti-raid, logs auto, bannissements et mutes configurables en un clic depuis le dashboard.', tag: 'moderation', color: '#ef4444' },
  { icon: <BarChart3 size={20} />, title: 'Stats & Analytics', desc: 'Graphiques temps réel, commandes populaires, croissance du serveur. Suivez votre communauté avec des données précises.', tag: 'analytics', color: '#3b82f6' },
  { icon: <Music size={20} />, title: 'Musique HD', desc: 'File d\'attente, playlists, filtres audio, lecture 24/7. Qualité Discord native avec support multi-sources.', tag: 'music', color: '#a855f7' },
  { icon: <Gamepad2 size={20} />, title: 'Mini-jeux & Économie', desc: 'Système économique complet, casino, classements, récompenses quotidiennes et boutique de rôles.', tag: 'economy', color: '#22c55e' },
  { icon: <MessageSquare size={20} />, title: 'Sondages & Suggestions', desc: 'Sondages personnalisés, système de suggestions avec votes, réactions automatiques et rapports.', tag: 'polls', color: '#f59e0b' },
  { icon: <Gift size={20} />, title: 'Giveaways & Tickets', desc: 'Giveaways automatiques, système de tickets personnalisable avec catégories et transcripts.', tag: 'giveaways', color: '#ec4899' },
];

const MODULES: ModuleItem[] = [
  { icon: <Shield size={16} />, name: 'Modération', desc: 'Auto-modération, logs, anti-raid', tag: 'core' },
  { icon: <Music size={16} />, name: 'Musique', desc: 'Lecture HD, playlists, filtres', tag: 'fun' },
  { icon: <Gamepad2 size={16} />, name: 'Mini-jeux', desc: 'Économie, casino, classements', tag: 'fun' },
  { icon: <MessageSquare size={16} />, name: 'Sondages', desc: 'Votes, suggestions, réactions', tag: 'utility' },
  { icon: <Gift size={16} />, name: 'Giveaways', desc: 'Tirage au sort automatique', tag: 'fun' },
  { icon: <Ticket size={16} />, name: 'Tickets', desc: 'Support, transcripts, catégories', tag: 'utility' },
  { icon: <Hash size={16} />, name: 'Auto-rôles', desc: 'Rôles réaction, temporaires', tag: 'utility' },
  { icon: <Bell size={16} />, name: 'Bienvenue', desc: 'Messages, images, règles', tag: 'utility' },
  { icon: <Activity size={16} />, name: 'Niveaux', desc: 'XP, classements, récompenses', tag: 'fun' },
  { icon: <Lock size={16} />, name: 'Protection', desc: 'Anti-raid, backups, logs', tag: 'core' },
  { icon: <Volume2 size={16} />, name: 'Soutien', desc: 'Stream alerts, notifications', tag: 'social' },
  { icon: <Sliders size={16} />, name: 'Configuration', desc: 'Dashboard complet, permissions', tag: 'core' },
];

const STEPS = [
  { num: 1, title: 'Ajoute Pinguin', desc: 'Clique sur "Ajouter à Discord" et autorise les permissions.' },
  { num: 2, title: 'Choisis ton serveur', desc: 'Sélectionne le serveur à configurer parmi ta liste.' },
  { num: 3, title: 'C\'est prêt !', desc: 'Utilise /help ou explore le dashboard pour tout configurer.' },
];

const TERMINAL_LINES = [
  { text: 'pinguin@bot:~$ ./deploy --production', delay: 0 },
  { text: '✓ Vérification des permissions...', delay: 600 },
  { text: '✓ Connexion à l\'API Discord...', delay: 1200 },
  { text: '✓ Chargement de 12 modules...', delay: 1800 },
  { text: '✓ Synchronisation des commandes...', delay: 2400 },
  { text: '', delay: 2800 },
  { text: '╔══════════════════════════════════╗', delay: 3000 },
  { text: '║  PINGUIN BOAT v3.0 — EN LIGNE   ║', delay: 3200 },
  { text: '║  Prêt sur 1 000+ serveurs        ║', delay: 3400 },
  { text: '╚══════════════════════════════════╝', delay: 3600 },
  { text: '', delay: 3800 },
  { text: 'pinguin@bot:~$ systemctl status --all', delay: 4200 },
  { text: '  ● Moderation    ● active (running)', delay: 4600 },
  { text: '  ● Music         ● active (running)', delay: 4900 },
  { text: '  ● Economy       ● active (running)', delay: 5200 },
  { text: '  ● Levels        ● active (running)', delay: 5500 },
  { text: '  ● Tickets       ● active (running)', delay: 5800 },
  { text: '  ● Giveaways     ● active (running)', delay: 6100 },
  { text: '', delay: 6400 },
  { text: 'pinguin@bot:~$ ▊', delay: 6800 },
];

/* ─── Animated Counter ─── */
function AnimatedCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 2000;
    const step = Math.max(1, Math.floor(value / 60));
    const interval = setInterval(() => {
      start += step;
      if (start >= value) {
        setDisplay(value);
        clearInterval(interval);
      } else {
        setDisplay(start);
      }
    }, duration / 60);
    return () => clearInterval(interval);
  }, [inView, value]);

  return (
    <span ref={ref} className="stat-digit">
      {display.toLocaleString('fr-FR')}{suffix}
    </span>
  );
}

/* ─── Terminal Demo ─── */
function TerminalDemo() {
  const [visibleLines, setVisibleLines] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  useEffect(() => {
    if (!inView) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    TERMINAL_LINES.forEach((line) => {
      const t = setTimeout(() => {
        setVisibleLines((prev) => prev + 1);
      }, line.delay);
      timers.push(t);
    });
    return () => timers.forEach(clearTimeout);
  }, [inView]);

  return (
    <div
      ref={ref}
      style={{
        width: '100%',
        maxWidth: 560,
        border: '1px solid var(--border-color)',
        backgroundColor: 'color-mix(in srgb, var(--bg-primary) 60%, #000)',
        fontFamily: 'var(--font-jetbrains), monospace',
        fontSize: 12,
        lineHeight: 1.8,
        overflow: 'hidden',
      }}
    >
      {/* Terminal header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-surface)',
      }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ef4444' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#f59e0b' }} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#22c55e' }} />
        <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
          pinguin@bot:~/deploy — bash
        </span>
      </div>
      {/* Terminal body */}
      <div style={{ padding: '14px 16px', minHeight: 320 }}>
        {TERMINAL_LINES.slice(0, visibleLines).map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            style={{
              color: line.text.includes('✓')
                ? 'var(--success)'
                : line.text.includes('║')
                  ? 'var(--accent)'
                  : line.text.includes('●')
                    ? 'var(--success)'
                    : line.text.startsWith('pinguin@')
                      ? 'var(--text-primary)'
                      : 'var(--text-secondary)',
              whiteSpace: 'pre',
              fontFamily: 'var(--font-jetbrains), monospace',
            }}
          >
            {line.text.includes('▊') ? (
              <>{line.text.replace('▊', '')}<span className="cursor-blink">▊</span></>
            ) : line.text.startsWith('pinguin@') && !line.text.includes('▊') ? (
              <><span style={{ color: 'var(--success)' }}>pinguin@bot</span><span style={{ color: 'var(--text-secondary)' }}>:</span><span style={{ color: 'var(--info)' }}>~</span>$ {line.text.replace(/^pinguin@bot:~\$ /, '')}</>
            ) : (
              line.text
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ─── Scroll Progress ─── */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const width = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
  return <motion.div className="scroll-progress" style={{ width }} />;
}

/* ─── Main Component ─── */
export default function LandingPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    getUser().then(setUser).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    fetch('/api/stats/public')
      .then((r) => r.json())
      .then((data) => {
        const d = data.data ?? data;
        setStats({
          totalGuilds: d.totalGuilds ?? d.guilds ?? 0,
          totalUsers: d.totalUsers ?? d.members ?? 0,
          totalCommands: d.totalCommands ?? 120,
          uptime: d.uptime ?? 99.9,
        });
      })
      .catch(() => setStats({
        totalGuilds: 0, totalUsers: 0,
        totalCommands: 120, uptime: 99.9,
      }));
  }, []);

  const guildsDisplay = stats?.totalGuilds || 1000;
  const usersDisplay = stats?.totalUsers || 50000;
  const commandsDisplay = stats?.totalCommands || 120;
  const uptimeDisplay = stats?.uptime || 99.9;

  if (!mounted) return null;

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', position: 'relative' }}>
      {/* ─── GLOBAL EFFECTS ─── */}
      <ScrollProgress />
      <div className="grid-bg" />
      <div className="scanline" />

      {/* ─── NAVBAR ─── */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 56, padding: '0 24px',
          backgroundColor: 'color-mix(in srgb, var(--bg-primary) 80%, transparent)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <Logo withText size={20} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user === undefined ? (
            <div style={{ width: 80, height: 36, backgroundColor: 'var(--bg-surface-alt)' }} />
          ) : user ? (
            <Link href="/servers" className="cta-outline" style={{ fontSize: 12 }}>
              Dashboard <ArrowRight size={12} />
            </Link>
          ) : (
            <a href="/auth/login" className="cta-discord" style={{ padding: '10px 20px', fontSize: 13 }}>
              <svg width="16" height="16" viewBox="0 0 127.14 96.36" fill="currentColor">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,56.6,124.08,32.64,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
              </svg>
              Se connecter
            </a>
          )}
        </div>
      </motion.header>

      {/* ─── HERO ─── */}
      <section style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '120px 24px 60px', textAlign: 'center', position: 'relative',
        background: `
          radial-gradient(ellipse 80% 50% at 50% -10%, color-mix(in oklch, var(--accent) 8%, transparent), transparent),
          radial-gradient(ellipse 60% 40% at 50% 110%, color-mix(in oklch, var(--accent) 4%, transparent), transparent)
        `,
      }}>
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', marginBottom: 28,
            border: '1px solid var(--border-color)',
            fontSize: 11, fontWeight: 500, letterSpacing: '0.05em',
            color: 'var(--text-secondary)', textTransform: 'uppercase',
          }}
        >
          <Zap size={12} style={{ color: 'var(--accent)' }} />
          v3.0 — Forgé pour la communauté
        </motion.div>

        {/* Penguin */}
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ marginBottom: 24, position: 'relative' }}
        >
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute', inset: -20,
              background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 10%, transparent) 0%, transparent 70%)',
              borderRadius: '50%',
            }}
          />
          <svg width="72" height="88" viewBox="0 0 80 96" fill="none" style={{ position: 'relative' }}>
            <ellipse cx="40" cy="52" rx="32" ry="36" fill="#1a1a1a" />
            <ellipse cx="40" cy="56" rx="22" ry="26" fill="#f5f5f5" />
            <ellipse cx="40" cy="46" rx="16" ry="18" fill="#1a1a1a" />
            <circle cx="30" cy="36" r="4" fill="#f5f5f5" />
            <circle cx="50" cy="36" r="4" fill="#f5f5f5" />
            <circle cx="30" cy="36" r="2" fill="#1a1a1a" />
            <circle cx="50" cy="36" r="2" fill="#1a1a1a" />
            <ellipse cx="28" cy="44" rx="2" ry="1.5" fill="#1a1a1a" />
            <ellipse cx="52" cy="44" rx="2" ry="1.5" fill="#1a1a1a" />
            <path d="M36 42 Q40 46 44 42" stroke="#1a1a1a" strokeWidth="1.5" fill="none" />
            <path d="M30 66 L24 88 Q28 86 32 88 L40 76 L48 88 Q52 86 56 88 L50 66" fill="var(--accent)" />
            <ellipse cx="24" cy="26" rx="10" ry="14" fill="#1a1a1a" transform="rotate(-20 24 26)" />
            <ellipse cx="56" cy="26" rx="10" ry="14" fill="#1a1a1a" transform="rotate(20 56 26)" />
          </svg>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontSize: 'clamp(1.75rem, 5vw, 3.25rem)', fontWeight: 700,
            color: 'var(--text-primary)', margin: 0, lineHeight: 1.15,
            maxWidth: 640,
          }}
        >
          Le bot Discord qui{' '}
          <span style={{
            background: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, var(--text-primary)))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            gère tout.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontSize: 'clamp(0.85rem, 1.5vw, 1.05rem)',
            color: 'var(--text-secondary)', marginTop: 14, maxWidth: 480,
            lineHeight: 1.7,
          }}
        >
          Modération, musique, économie, tickets, giveaways, niveaux —
          <br className="hide-mobile" /> une seule intégration. Tout depuis le dashboard.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 32, flexWrap: 'wrap', justifyContent: 'center' }}
        >
          <a
            href={user ? '/servers' : '/auth/login'}
            className="cta-discord"
          >
            <svg width="20" height="20" viewBox="0 0 127.14 96.36" fill="currentColor">
              <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,56.6,124.08,32.64,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
            </svg>
            Ajouter à Discord
          </a>
          <a href="#features" className="cta-outline">
            Découvrir <ChevronRight size={14} />
          </a>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          style={{
            marginTop: 40,
            display: 'flex', alignItems: 'center', gap: 0,
            fontSize: 12, color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRight: '1px solid var(--border-color)' }}>
            <Server size={14} style={{ color: 'var(--accent)' }} />
            <span><AnimatedCounter value={guildsDisplay} /> serveurs</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRight: '1px solid var(--border-color)' }}>
            <Users size={14} style={{ color: 'var(--accent)' }} />
            <span><AnimatedCounter value={usersDisplay} /> utilisateurs</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRight: '1px solid var(--border-color)' }}>
            <Terminal size={14} style={{ color: 'var(--accent)' }} />
            <span><AnimatedCounter value={commandsDisplay} /> commandes</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px' }}>
            <Activity size={14} style={{ color: 'var(--success)' }} />
            <span>Uptime {uptimeDisplay}%</span>
          </div>
        </motion.div>
      </section>

      {/* ─── TERMINAL DEMO ─── */}
      <section style={{
        padding: '60px 24px 100px', display: 'flex',
        flexDirection: 'column', alignItems: 'center',
        position: 'relative',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          style={{ marginBottom: 32, textAlign: 'center' }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', marginBottom: 12,
            border: '1px solid var(--border-color)',
            fontSize: 10, fontWeight: 500, letterSpacing: '0.08em',
            color: 'var(--text-secondary)', textTransform: 'uppercase',
          }}>
            <Cpu size={12} /> Démo
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Déploiement en direct
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, maxWidth: 400 }}>
            Ce terminal simule le déploiement de Pinguin sur votre serveur.
          </p>
        </motion.div>
        <TerminalDemo />
      </section>

      {/* ─── FEATURES GRID ─── */}
      <section id="features" style={{
        padding: '80px 24px 100px', maxWidth: 1000, margin: '0 auto',
        borderTop: '1px solid var(--border-color)',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          style={{ textAlign: 'center', marginBottom: 48 }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', marginBottom: 12,
            border: '1px solid var(--border-color)',
            fontSize: 10, fontWeight: 500, letterSpacing: '0.08em',
            color: 'var(--text-secondary)', textTransform: 'uppercase',
          }}>
            <Star size={12} /> Fonctionnalités
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Tout ce qu'il faut pour votre serveur
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
            12 modules intégrés, zéro configuration complexe.
          </p>
        </motion.div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="feature-card"
              style={{ padding: 24 }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 40, height: 40, flexShrink: 0,
                  backgroundColor: `color-mix(in srgb, ${feature.color} 12%, transparent)`,
                  color: feature.color,
                }}>
                  {feature.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                      {feature.title}
                    </h3>
                    <span className="module-tag">{feature.tag}</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                    {feature.desc}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── STATS BANNER ─── */}
      <section style={{
        padding: '80px 24px',
        borderTop: '1px solid var(--border-color)',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-surface)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 60% 60% at 50% 50%, color-mix(in srgb, var(--accent) 3%, transparent), transparent)',
          pointerEvents: 'none',
        }} />
        <div style={{
          maxWidth: 900, margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 32, textAlign: 'center', position: 'relative',
        }}>
          {[
            { icon: <Server size={24} />, value: guildsDisplay, suffix: '+', label: 'Serveurs' },
            { icon: <Users size={24} />, value: usersDisplay, suffix: '+', label: 'Utilisateurs' },
            { icon: <Terminal size={24} />, value: commandsDisplay, suffix: '+', label: 'Commandes' },
            { icon: <Award size={24} />, value: uptimeDisplay, suffix: '%', label: 'Uptime' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <div style={{ color: 'var(--accent)', marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
                {stat.icon}
              </div>
              <div style={{
                fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
                fontWeight: 700, color: 'var(--text-primary)',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}>
                <AnimatedCounter value={stat.value} suffix={stat.suffix} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── MODULES SHOWCASE ─── */}
      <section style={{
        padding: '80px 24px 100px', maxWidth: 900, margin: '0 auto',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          style={{ textAlign: 'center', marginBottom: 48 }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', marginBottom: 12,
            border: '1px solid var(--border-color)',
            fontSize: 10, fontWeight: 500, letterSpacing: '0.08em',
            color: 'var(--text-secondary)', textTransform: 'uppercase',
          }}>
            <Sliders size={12} /> Modules
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Tous les modules disponibles
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
            Activez, désactivez et configurez chaque module depuis le dashboard.
          </p>
        </motion.div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
        }}>
          {MODULES.map((mod, i) => (
            <motion.div
              key={mod.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
              className="feature-card"
              style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, flexShrink: 0,
                backgroundColor: 'color-mix(in srgb, var(--accent) 8%, transparent)',
                color: 'var(--accent)',
              }}>
                {mod.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {mod.name}
                  </span>
                  <span className="module-tag" style={{ fontSize: 9 }}>{mod.tag}</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                  {mod.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section style={{
        padding: '80px 24px 100px', maxWidth: 800, margin: '0 auto',
        borderTop: '1px solid var(--border-color)',
      }}>
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', margin: '0 0 48px' }}
        >
          Comment ça marche
        </motion.h2>

        <div style={{ display: 'flex', gap: 0, position: 'relative' }} className="flex-col md:flex-row">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              style={{ flex: 1, textAlign: 'center', padding: '0 16px', position: 'relative' }}
            >
              {i < STEPS.length - 1 && (
                <div style={{
                  position: 'absolute', top: 20, left: 'calc(50% + 24px)',
                  right: 'calc(-50% + 24px)', height: 0,
                  borderTop: '1px dashed var(--border-color)',
                }} className="hide-mobile" />
              )}
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 40, height: 40, border: '1px solid var(--accent)',
                color: 'var(--accent)', fontSize: 16, fontWeight: 700, marginBottom: 16,
              }}>
                {step.num}
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                {step.title}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                {step.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── TRUST BAR ─── */}
      <section style={{
        padding: '40px 24px', textAlign: 'center',
        borderTop: '1px solid var(--border-color)',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-surface)',
      }}>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          style={{ fontSize: 11, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}
        >
          <Heart size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4, color: 'var(--error)' }} />
          Rejoint par des centaines de serveurs — gratuit, open source, en constante évolution
        </motion.p>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section style={{
        padding: '100px 24px', textAlign: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in srgb, var(--accent) 5%, transparent), transparent)',
          pointerEvents: 'none',
        }} />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ position: 'relative' }}
        >
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
            Prêt à améliorer ton serveur&nbsp;?
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 auto 36px', maxWidth: 420, lineHeight: 1.7 }}>
            Rejoins des centaines de serveurs qui font confiance à Pinguin.
            Configuration en 2 minutes, résultats immédiats.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <a
              href={user ? '/servers' : '/auth/login'}
              className="cta-discord"
              style={{ fontSize: 16, padding: '18px 36px' }}
            >
              <svg width="22" height="22" viewBox="0 0 127.14 96.36" fill="currentColor">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,56.6,124.08,32.64,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
              </svg>
              Ajouter maintenant
            </a>
            <a href="https://discord.gg/pinguin" target="_blank" rel="noopener noreferrer" className="cta-outline">
              <ExternalLink size={14} />
              Communauté
            </a>
          </div>
        </motion.div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{
        padding: '40px 24px', textAlign: 'center',
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-primary)',
      }}>
        <Logo withText size={18} />
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 16, marginTop: 16, fontSize: 12, color: 'var(--text-secondary)',
        }}>
          <a href="/legal" style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.15s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          >Mentions légales</a>
          <span style={{ opacity: 0.3 }}>/</span>
          <a href="https://discord.gg/pinguin" target="_blank" rel="noopener noreferrer"
            style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.15s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          >Discord</a>
          <span style={{ opacity: 0.3 }}>/</span>
          <a href="https://github.com/seapvvi/pinguin-boat" target="_blank" rel="noopener noreferrer"
            style={{ color: 'inherit', textDecoration: 'none', transition: 'color 0.15s' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          >GitHub</a>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 16, letterSpacing: '0.03em' }}>
          &copy; {new Date().getFullYear()} Pinguin Empire — Forgé pour la communauté
        </p>
      </footer>
    </div>
  );
}