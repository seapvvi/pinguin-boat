'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform, useInView, useSpring, AnimatePresence } from 'motion/react';
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

interface ChangelogItem {
  id: string;
  version: string;
  title: string;
  createdAt: string;
  pinned?: boolean;
}

/* ─── Pinguin Logo ─── */
function PinguinLogo({ size = 20 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <img
        src="/favicon.svg"
        alt="Pinguin"
        width={size + 4}
        height={size + 4}
        style={{ borderRadius: 4, objectFit: 'contain' }}
      />
      <span style={{
        fontSize: size * 0.75,
        fontWeight: 700,
        color: 'var(--text-primary)',
        letterSpacing: '-0.02em',
        fontFamily: 'var(--font-jetbrains), monospace',
      }}>
        Pinguin
      </span>
    </div>
  );
}

/* ─── Data ─── */
const FEATURES: FeatureItem[] = [
  { icon: <Shield size={20} />, title: 'Modération intelligente', desc: 'Anti-spam, anti-raid, logs auto, bannissements et mutes configurables en un clic depuis le dashboard.', tag: 'moderation', color: '#ef4444' },
  { icon: <BarChart3 size={20} />, title: 'Stats & Analytics', desc: 'Graphiques temps réel, commandes populaires, croissance du serveur. Suivez votre communauté avec des données précises.', tag: 'analytics', color: '#3b82f6' },
  { icon: <Music size={20} />, title: 'Musique HD', desc: 'File d\'attente, playlists, filtres audio, lecture 24/7. Qualité Discord native avec support multi-sources.', tag: 'music', color: '#a855f7' },
  { icon: <Gamepad2 size={20} />, title: 'Mini-jeux & Économie', desc: 'Système économique complet, casino, classements, récompenses quotidiennes et boutique de rôles.', tag: 'economy', color: '#22c55e' },
  { icon: <MessageSquare size={20} />, title: 'Sondages & Suggestions', desc: 'Sondages personnalisés, système de suggestions avec votes, réactions automatiques et rapports.', tag: 'polls', color: '#f59e0b' },
  { icon: <Gift size={20} />, title: 'Giveaways & Tickets', desc: 'Giveaways automatiques, système de tickets personnalisable avec catégories et transcripts.', tag: 'giveaways', color: '#ec4899' },
  { icon: <Bell size={20} />, title: 'Bienvenue & Départs', desc: 'Messages de bienvenue personnalisés avec images, rôles automatiques à l\'arrivée, et messages de départ configurables.', tag: 'utility', color: '#06b6d4' },
  { icon: <Activity size={20} />, title: 'Système de Niveaux XP', desc: 'Classement XP, récompenses de palier, cartes de profil personnalisées et notifications de montée de niveau.', tag: 'levels', color: '#f97316' },
  { icon: <Lock size={20} />, title: 'Sécurité & Backups', desc: 'Anti-raid avancé, backups automatiques de la configuration du serveur, alertes en temps réel et journaux d\'audit.', tag: 'security', color: '#10b981' },
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
  { num: 1, icon: <ExternalLink size={18} />, title: 'Ajoute Pinguin', desc: 'Clique sur "Ajouter à Discord" et autorise les permissions nécessaires.', detail: 'Prend moins de 30 secondes' },
  { num: 2, icon: <Server size={18} />, title: 'Choisis ton serveur', desc: 'Sélectionne le serveur à configurer parmi ta liste Discord.', detail: 'Accès immédiat au dashboard' },
  { num: 3, icon: <Zap size={18} />, title: "C'est prêt !", desc: 'Utilise /help ou explore le dashboard pour tout configurer.', detail: '12 modules disponibles dès le lancement' },
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

const STATIC_CHANGELOGS: ChangelogItem[] = [
  { id: '1', version: '3.1', title: 'Nouveau système de niveaux et récompenses XP', pinned: true, createdAt: '2026-06-01' },
  { id: '2', version: '3.0', title: 'Refonte complète du dashboard — thèmes, modules, KPIs', pinned: false, createdAt: '2026-05-15' },
  { id: '3', version: '2.9', title: 'Ajout des giveaways automatiques et tickets avancés', pinned: false, createdAt: '2026-04-28' },
];

/* ─── Mouse Parallax Hook ─── */
function useMouseParallax(strength = 20) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setPos({
        x: (e.clientX / window.innerWidth - 0.5) * strength,
        y: (e.clientY / window.innerHeight - 0.5) * strength,
      });
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, [strength]);
  return pos;
}

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
  const [scrolled, setScrolled] = useState(false);
  const [activeTag, setActiveTag] = useState<string>('all');
  const [changelogs, setChangelogs] = useState<ChangelogItem[]>([]);

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

  useEffect(() => {
    fetch('/api/changelogs?limit=3&public=true')
      .then((r) => r.json())
      .then((data) => {
        const d = data.data ?? data ?? [];
        setChangelogs(Array.isArray(d) ? d : []);
      })
      .catch(() => {
        setChangelogs(STATIC_CHANGELOGS);
      });
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const guildsDisplay = stats?.totalGuilds || 1000;
  const usersDisplay = stats?.totalUsers || 50000;
  const commandsDisplay = stats?.totalCommands || 120;
  const uptimeDisplay = stats?.uptime || 99.9;

  const mouse = useMouseParallax(12);
  const springX = useSpring(mouse.x, { stiffness: 80, damping: 20 });
  const springY = useSpring(mouse.y, { stiffness: 80, damping: 20 });

  // Springs pour les floating cards — déclarés ici dans le corps du composant (Rules of Hooks)
  const floatCardLeftX = useSpring(0, { stiffness: 80, damping: 20 });
  const floatCardLeftY = useSpring(0, { stiffness: 80, damping: 20 });
  const floatCardRightX = useSpring(0, { stiffness: 80, damping: 20 });
  const floatCardRightY = useSpring(0, { stiffness: 80, damping: 20 });
  const floatCardBottomX = useSpring(0, { stiffness: 80, damping: 20 });

  // Mise à jour des springs flottantes quand la souris bouge
  useEffect(() => {
    floatCardLeftX.set(-mouse.x * 0.5);
    floatCardLeftY.set(-mouse.y * 0.5);
    floatCardRightX.set(-mouse.x * 0.5);
    floatCardRightY.set(-mouse.y * 0.5);
    floatCardBottomX.set(-mouse.x * 0.3);
  }, [mouse.x, mouse.y,
    floatCardLeftX, floatCardLeftY,
    floatCardRightX, floatCardRightY,
    floatCardBottomX]);

  const tags = ['all', 'core', 'fun', 'utility', 'social'] as const;
  const filteredModules = activeTag === 'all'
    ? MODULES
    : MODULES.filter((m) => m.tag === activeTag);

  const displayChangelogs = changelogs.length > 0 ? changelogs : STATIC_CHANGELOGS;

  if (!mounted) return null;

  const navLinkStyle: React.CSSProperties = {
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: 13,
    transition: 'color 0.15s',
  };

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
          backgroundColor: scrolled
            ? 'color-mix(in srgb, var(--bg-primary) 90%, transparent)'
            : 'transparent',
          backdropFilter: 'blur(12px)',
          borderBottom: scrolled ? '1px solid var(--border-color)' : '1px solid transparent',
          transition: 'background-color 0.3s, border-color 0.3s',
        }}
      >
        <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.15 }}>
          <PinguinLogo size={20} />
        </motion.div>

        {/* Desktop nav links */}
        <nav className="hide-mobile" style={{ display: 'flex', gap: 24, fontSize: 13, color: 'var(--text-secondary)' }}>
          <a href="#features" style={navLinkStyle}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          >Fonctionnalités</a>
          <a href="#modules" style={navLinkStyle}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          >Modules</a>
          <a href="#terminal" style={navLinkStyle}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          >Démo</a>
          <a href="#stats" style={navLinkStyle}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
          >Stats</a>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user === undefined ? (
            <div style={{ width: 80, height: 36, backgroundColor: 'var(--bg-surface-alt)' }} />
          ) : user ? (
            <Link href="/servers" className="cta-outline" style={{ fontSize: 12 }}>
              Dashboard <ArrowRight size={12} />
            </Link>
          ) : (
            <a href="/auth/login" className="cta-discord">
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
        overflow: 'hidden',
        background: `
          radial-gradient(ellipse 80% 50% at 50% -10%, color-mix(in oklch, var(--accent) 8%, transparent), transparent),
          radial-gradient(ellipse 60% 40% at 50% 110%, color-mix(in oklch, var(--accent) 4%, transparent), transparent)
        `,
      }}>
        {/* Floating dots */}
        <div className="floating-dots" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {[
            { size: 4, left: '10%', top: '20%', duration: 8, delay: 0 },
            { size: 6, left: '25%', top: '60%', duration: 12, delay: 1 },
            { size: 8, left: '70%', top: '15%', duration: 10, delay: 2 },
            { size: 5, left: '85%', top: '40%', duration: 14, delay: 0.5 },
            { size: 10, left: '45%', top: '70%', duration: 16, delay: 3 },
            { size: 4, left: '60%', top: '80%', duration: 9, delay: 1.5 },
          ].map((dot, i) => (
            <span key={i} style={{
              width: dot.size, height: dot.size,
              left: dot.left, top: dot.top,
              animationDuration: `${dot.duration}s`,
              animationDelay: `${dot.delay}s`,
            }} />
          ))}
        </div>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          style={{ marginBottom: 28 }}
        >
          <div className="badge-animated">
            <div className="badge-animated-inner">
              <Zap size={12} style={{ color: 'var(--accent)' }} />
              v3.0 — Forgé pour la communauté
            </div>
          </div>
        </motion.div>

        {/* Penguin with parallax */}
        <motion.div
          style={{ marginBottom: 24, position: 'relative', x: springX, y: springY }}
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
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

          {/* Floating cards */}
          <motion.div
            style={{
              position: 'absolute', left: -130, top: 20,
              x: floatCardLeftX, y: floatCardLeftY,
            }}
            className="floating-card"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Terminal size={12} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 11, fontFamily: 'var(--font-jetbrains)', color: 'var(--text-primary)' }}>/ban @user</span>
            </div>
            <span style={{ fontSize: 10, color: 'var(--success)' }}>✓ Exécuté</span>
          </motion.div>

          <motion.div
            style={{
              position: 'absolute', right: -130, top: 40,
              x: floatCardRightX, y: floatCardRightY,
            }}
            className="floating-card"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={12} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 11 }}>+42 membres</span>
            </div>
            <span style={{ fontSize: 10, color: 'var(--success)' }}>cette semaine</span>
          </motion.div>

          <motion.div
            style={{
              position: 'absolute', bottom: -20, left: '50%',
              x: floatCardBottomX,
            }}
            className="floating-card"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={12} style={{ color: 'var(--success)' }} />
              <span style={{ fontSize: 11 }}>99.9% uptime</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontSize: 'clamp(1.75rem, 5vw, 3.25rem)', fontWeight: 700,
            color: 'var(--text-primary)', margin: 0, lineHeight: 1.15,
            maxWidth: 640, position: 'relative', zIndex: 1,
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
            lineHeight: 1.7, position: 'relative', zIndex: 1,
          }}
        >
          Modération, musique, économie, tickets, giveaways, niveaux —
          <br className="hide-mobile" /> une seule intégration. Tout depuis le dashboard.
        </motion.p>

        {/* CTA Buttons — pas de style inline, classes uniformes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 32, flexWrap: 'wrap', justifyContent: 'center', position: 'relative', zIndex: 1 }}
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
          className="stat-cell"
          style={{
            marginTop: 40,
            display: 'flex', alignItems: 'center', gap: 0,
            fontSize: 12, color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)',
            position: 'relative', zIndex: 1,
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
      <section id="terminal" style={{
        padding: '60px 24px 100px', position: 'relative',
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 48,
            alignItems: 'center',
          }} className="flex-col md:flex-row">
            {/* Left: Terminal */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <TerminalDemo />
            </motion.div>

            {/* Right: Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="section-badge"><Cpu size={12} /> Démo live</div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Déploiement instantané
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.7 }}>
                Pinguin se déploie en quelques secondes sur votre serveur.
                Regardez le processus en temps réel.
              </p>
              <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { icon: <Zap size={14} />, text: 'Démarrage en < 3 secondes' },
                  { icon: <Shield size={14} />, text: '12 modules chargés automatiquement' },
                  { icon: <Activity size={14} />, text: 'Reconnexion automatique si coupure' },
                ].map((item) => (
                  <div key={item.text} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--success)' }}>{item.icon}</span>
                    {item.text}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
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
          <div className="section-badge"><Star size={12} /> Fonctionnalités</div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Tout ce qu'il faut pour votre serveur
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
            12 modules intégrés, zéro configuration complexe.
          </p>
        </motion.div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 16,
        }} className="flex-col md:flex-row">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              whileHover={{ rotateX: 2, rotateY: -2, scale: 1.02 }}
              style={{
                transformStyle: 'preserve-3d', perspective: 800,
                gridColumn: i === 0 ? 'span 2' : 'span 1',
                position: 'relative', overflow: 'hidden',
              }}
              className="feature-card"
            >
              <div style={{ padding: 24 }}>
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
              </div>
              {/* Active dot */}
              <div style={{
                position: 'absolute', top: 12, right: 12,
                width: 6, height: 6, borderRadius: '50%',
                backgroundColor: 'var(--success)',
                boxShadow: '0 0 8px var(--success)',
                animation: 'pulse-dot 2s infinite',
              }} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── STATS BANNER ─── */}
      <section id="stats" style={{
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
              className="stat-block"
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
              {/* Uptime progress bar */}
              {i === 3 && (
                <div style={{ marginTop: 8, height: 2, width: 80, margin: '8px auto 0', background: 'var(--bg-surface-alt)', borderRadius: 2 }}>
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${uptimeDisplay}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    style={{ height: '100%', background: 'var(--success)', borderRadius: 2 }}
                  />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── MODULES SHOWCASE ─── */}
      <section id="modules" style={{
        padding: '80px 24px 100px', maxWidth: 900, margin: '0 auto',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          style={{ textAlign: 'center', marginBottom: 32 }}
        >
          <div className="section-badge"><Sliders size={12} /> Modules</div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Tous les modules disponibles
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
            Activez, désactivez et configurez chaque module depuis le dashboard.
          </p>
        </motion.div>

        {/* Filter buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24, justifyContent: 'center' }}>
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              style={{
                padding: '4px 12px', fontSize: 11, fontWeight: 500,
                letterSpacing: '0.05em', textTransform: 'uppercase',
                border: '1px solid var(--border-color)',
                background: activeTag === tag
                  ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                  : 'transparent',
                color: activeTag === tag ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer', transition: 'all 0.15s',
                borderColor: activeTag === tag ? 'var(--accent)' : 'var(--border-color)',
                borderRadius: 'var(--radius-sm)',
              }}
            >{tag === 'all' ? 'Tous' : tag}</button>
          ))}
        </div>

        {/* Module grid with AnimatePresence */}
        <AnimatePresence mode="popLayout">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}>
            {filteredModules.map((mod, i) => (
              <motion.div
                key={mod.name}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2, delay: i * 0.02 }}
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
        </AnimatePresence>
      </section>

      {/* ─── DASHBOARD PREVIEW ─── */}
      <section style={{
        padding: '80px 24px',
        borderTop: '1px solid var(--border-color)',
        overflow: 'hidden', position: 'relative',
      }}>
        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 48 }}>
          <div className="section-badge"><Sliders size={12} /> Dashboard</div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Tout configurez depuis le web
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>
            Pas de commandes compliquées. Un dashboard moderne pour tout piloter.
          </p>
        </motion.div>

        {/* Mock dashboard UI */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{
            maxWidth: 860, margin: '0 auto',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px var(--border-color), 0 0 60px color-mix(in srgb, var(--accent) 6%, transparent)',
            position: 'relative',
          }}
        >
          {/* Barre du haut (faux browser) */}
          <div style={{
            height: 40, backgroundColor: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px',
          }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
            <div style={{
              flex: 1, textAlign: 'center',
              fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-jetbrains)',
            }}>
              bot.pinguin.ovh/servers/xxx/overview
            </div>
          </div>

          {/* Corps du dashboard simulé */}
          <div style={{ display: 'flex', height: 360, backgroundColor: 'var(--bg-primary)' }} className="flex-col md:flex-row">
            {/* Sidebar simulée avec icônes */}
            <div style={{
              width: 180, borderRight: '1px solid var(--border-color)',
              padding: 12, display: 'flex', flexDirection: 'column', gap: 6,
            }} className="dashboard-sidebar">
              <PinguinLogo size={14} />
              {[
                { label: 'Vue d\'ensemble', icon: <Activity size={10} /> },
                { label: 'Modération', icon: <Shield size={10} /> },
                { label: 'Musique', icon: <Music size={10} /> },
                { label: 'Niveaux', icon: <Award size={10} /> },
                { label: 'Logs', icon: <Terminal size={10} /> },
              ].map((item, i) => (
                <div key={item.label} style={{
                  padding: '6px 10px', fontSize: 11,
                  color: i === 0 ? 'var(--accent)' : 'var(--text-secondary)',
                  background: i === 0 ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                  borderRadius: 'var(--radius-sm)', cursor: 'default',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ color: i === 0 ? 'var(--accent)' : 'var(--border-color)', opacity: 0.8 }}>
                    {item.icon}
                  </span>
                  {item.label}
                </div>
              ))}
            </div>

            {/* Contenu principal simulé */}
            <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* KPI row avec hover animation */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {[
                  { label: 'Membres', value: usersDisplay.toLocaleString('fr-FR'), icon: <Users size={12} /> },
                  { label: 'Commandes/j', value: '1 248', icon: <Terminal size={12} /> },
                  { label: 'Uptime', value: `${uptimeDisplay}%`, icon: <Activity size={12} /> },
                ].map((kpi) => (
                  <motion.div
                    key={kpi.label}
                    whileHover={{ scale: 1.03 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      padding: '10px 12px',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'default',
                    }}
                  >
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      color: 'var(--text-secondary)', marginBottom: 4,
                    }}>
                      <span style={{ fontSize: 10 }}>{kpi.label}</span>
                      <span style={{ color: 'var(--accent)' }}>{kpi.icon}</span>
                    </div>
                    <div style={{
                      fontSize: 16, fontWeight: 700, color: 'var(--text-primary)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>{kpi.value}</div>
                  </motion.div>
                ))}
              </div>

              {/* Fake chart bars */}
              <div style={{
                flex: 1, background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)', padding: 12,
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  Activité des 7 derniers jours
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
                  {[35, 52, 48, 63, 71, 88, 65].map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${h}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                      style={{
                        flex: 1, background: i === 5
                          ? 'var(--accent)'
                          : 'color-mix(in srgb, var(--accent) 30%, transparent)',
                        borderRadius: '2px 2px 0 0',
                      }}
                    />
                  ))}
                </div>
                {/* Module status row */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                  {['Modération', 'Musique', 'Niveaux', 'Tickets'].map((mod) => (
                    <span key={mod} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 9, padding: '2px 7px',
                      background: 'color-mix(in srgb, var(--success) 10%, transparent)',
                      color: 'var(--success)', borderRadius: 99,
                      border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)',
                    }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--success)' }} />
                      {mod}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Overlay gradient bas pour effet "fade out" */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 120,
          background: 'linear-gradient(to top, var(--bg-primary), transparent)',
          pointerEvents: 'none',
        }} />
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
                {step.icon ? (
                  <span style={{ color: 'var(--accent)' }}>{step.icon}</span>
                ) : (
                  step.num
                )}
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                {step.title}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                {step.desc}
              </p>
              <p style={{ fontSize: 11, color: 'var(--success)', marginTop: 6, fontWeight: 500 }}>
                {step.detail}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── CHANGELOGS / SOCIAL PROOF ─── */}
      <section style={{
        padding: '60px 24px',
        borderTop: '1px solid var(--border-color)',
      }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <div className="section-badge"><Star size={12} /> Mises à jour</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: 32, color: 'var(--text-primary)' }}>
            Toujours en évolution
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'left' }}>
            {displayChangelogs.map((cl, i) => (
              <motion.div
                key={cl.id}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.08 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <span style={{
                  fontSize: 11, fontFamily: 'var(--font-jetbrains)',
                  color: 'var(--accent)', flexShrink: 0,
                }}>v{cl.version}</span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>
                  {cl.title}
                </span>
                {cl.pinned && (
                  <span style={{
                    fontSize: 9, padding: '2px 6px',
                    background: 'color-mix(in srgb, var(--warning) 15%, transparent)',
                    color: 'var(--warning)', borderRadius: 'var(--radius-sm)',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>épinglé</span>
                )}
                {cl.createdAt && (
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>
                    {new Date(cl.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
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
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-surface)',
        padding: '48px 24px 24px',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          {/* Grille 4 colonnes */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr',
            gap: 32, marginBottom: 40,
          }} className="footer-grid">

            {/* Colonne 1 : Brand */}
            <div>
              <PinguinLogo size={20} />
              <p style={{
                fontSize: 12, color: 'var(--text-secondary)',
                marginTop: 12, lineHeight: 1.7, maxWidth: 220,
              }}>
                Le bot Discord open source qui gère modération, musique,
                économie et bien plus. Gratuit pour toujours.
              </p>
              {/* Liens réseaux sociaux */}
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                {/* GitHub */}
                <a href="https://github.com/seapvvi/pinguin-boat"
                  target="_blank" rel="noopener noreferrer"
                  className="footer-social-link" aria-label="GitHub">
                  <svg width="16" height="16" viewBox="0 0 24 24"
                    fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                </a>
                {/* Discord */}
                <a href="https://discord.gg/pinguin"
                  target="_blank" rel="noopener noreferrer"
                  className="footer-social-link" aria-label="Discord">
                  <svg width="16" height="16" viewBox="0 0 127.14 96.36"
                    fill="currentColor">
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,56.6,124.08,32.64,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Colonne 2 : Bot */}
            <div>
              <h4 style={{
                fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'var(--text-primary)',
                marginBottom: 14,
              }}>Le Bot</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Ajouter à Discord', href: '/auth/login' },
                  { label: 'Fonctionnalités', href: '#features' },
                  { label: 'Modules', href: '#modules' },
                  { label: 'Commandes', href: '#terminal' },
                ].map((link) => (
                  <a key={link.label} href={link.href}
                    className="footer-link">{link.label}</a>
                ))}
              </div>
            </div>

            {/* Colonne 3 : Ressources */}
            <div>
              <h4 style={{
                fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'var(--text-primary)',
                marginBottom: 14,
              }}>Ressources</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Documentation', href: 'https://docs.pinguin.ovh', external: true },
                  { label: 'Serveur Support', href: 'https://discord.gg/pinguin', external: true },
                  { label: 'GitHub', href: 'https://github.com/seapvvi/pinguin-boat', external: true },
                  { label: 'Soutenir le projet', href: '/soutien' },
                ].map((link) => (
                  <a key={link.label} href={link.href}
                    target={link.external ? '_blank' : undefined}
                    rel={link.external ? 'noopener noreferrer' : undefined}
                    className="footer-link">
                    {link.label}
                    {link.external &&
                      <ExternalLink size={10} style={{
                        marginLeft: 4,
                        display: 'inline', verticalAlign: 'middle',
                      }} />}
                  </a>
                ))}
              </div>
            </div>

            {/* Colonne 4 : Légal */}
            <div>
              <h4 style={{
                fontSize: 12, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'var(--text-primary)',
                marginBottom: 14,
              }}>Légal</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Mentions légales', href: '/legal' },
                  { label: 'Politique de confidentialité', href: '/privacy' },
                  { label: 'CGU', href: '/terms' },
                ].map((link) => (
                  <a key={link.label} href={link.href}
                    className="footer-link">{link.label}</a>
                ))}
              </div>

              {/* Version badge */}
              <div style={{ marginTop: 20 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 10, fontFamily: 'var(--font-jetbrains)',
                  padding: '3px 8px',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--success)',
                    boxShadow: '0 0 6px var(--success)',
                  }} />
                  v3.1 — En ligne
                </span>
              </div>
            </div>
          </div>

          {/* Séparateur */}
          <div style={{ height: 1, background: 'var(--border-color)', margin: '0 0 20px' }} />

          {/* Bottom bar */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
          }}>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
              © {new Date().getFullYear()} Pinguin Empire — Forgé pour la communauté
            </p>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11, color: 'var(--text-secondary)',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--success)', display: 'inline-block',
                boxShadow: '0 0 6px var(--success)',
                animation: 'pulse-dot 2s infinite',
              }} />
              Tous les systèmes opérationnels
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}