'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Shield, BarChart3, LayoutDashboard,
  ArrowRight, Sparkles, Users,
} from 'lucide-react';
import { Logo } from '@pinguin/ui';
import { getUser, type User } from '@/lib/auth';

interface StatsData {
  totalGuilds: number;
  totalUsers: number;
}

const STEPS = [
  { num: 1, title: 'Ajoute Pinguin', desc: 'Clique sur "Ajouter à Discord" et autorise les permissions.' },
  { num: 2, title: 'Choisis ton serveur', desc: 'Sélectionne le serveur à configurer parmi ta liste.' },
  { num: 3, title: 'C\'est prêt !', desc: 'Utilise /help pour découvrir toutes les commandes disponibles.' },
];

export default function LandingPage() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
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
        });
      })
      .catch(() => setStats({ totalGuilds: 0, totalUsers: 0 }));
  }, []);

  const guildsDisplay = stats?.totalGuilds
    ? `${stats.totalGuilds.toLocaleString('fr-FR')}+`
    : '1 000+';
  const usersDisplay = stats?.totalUsers
    ? `${stats.totalUsers.toLocaleString('fr-FR')}+`
    : '50 000+';

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)' }}>
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
            <a href="/servers"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', border: '1px solid var(--border-color)',
                color: 'var(--text-primary)', fontSize: 12, fontWeight: 500,
                textDecoration: 'none', letterSpacing: '0.03em',
                transition: 'background-color 150ms, border-color 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
            >
              Dashboard →
            </a>
          ) : (
            <a href="/auth/login"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', backgroundColor: '#5865F2',
                color: '#fff', fontSize: 13, fontWeight: 600,
                textDecoration: 'none', border: 'none', cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4752C4'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#5865F2'; }}
            >
              Se connecter
            </a>
          )}
        </div>
      </motion.header>

      {/* ─── HERO ─── */}
      <section style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '100px 24px 60px', textAlign: 'center', position: 'relative',
        background: 'radial-gradient(ellipse 80% 50% at 50% -10%, color-mix(in oklch, var(--accent) 8%, transparent), transparent)',
      }}>
        {/* Penguin SVG */}
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{ marginBottom: 32 }}
        >
          <svg width="80" height="96" viewBox="0 0 80 96" fill="none">
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
            <path d="M30 66 L24 88 Q28 86 32 88 L40 76 L48 88 Q52 86 56 88 L50 66" fill="#ff9100" />
            <ellipse cx="24" cy="26" rx="10" ry="14" fill="#1a1a1a" transform="rotate(-20 24 26)" />
            <ellipse cx="56" cy="26" rx="10" ry="14" fill="#1a1a1a" transform="rotate(20 56 26)" />
          </svg>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontSize: 'clamp(1.75rem, 5vw, 3.5rem)', fontWeight: 700,
            color: 'var(--text-primary)', margin: 0, lineHeight: 1.2,
            maxWidth: 600,
          }}
        >
          Le bot Discord qui gère tout.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontSize: 'clamp(0.9rem, 1.5vw, 1.1rem)',
            color: 'var(--text-secondary)', marginTop: 16, maxWidth: 480,
            lineHeight: 1.6,
          }}
        >
          Modération, musique, stats, logs — une seule commande suffit.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 32 }}
        >
          <motion.a
            href={user ? '/servers' : '/auth/login'}
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '16px 32px', backgroundColor: '#5865F2',
              color: '#fff', fontSize: 16, fontWeight: 600,
              textDecoration: 'none', border: 'none', cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4752C4'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#5865F2'; }}
          >
            <svg width="20" height="20" viewBox="0 0 127.14 96.36" fill="currentColor">
              <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,56.6,124.08,32.64,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
            </svg>
            Ajouter à Discord
          </motion.a>
          <a href="#features"
            style={{
              color: 'var(--text-secondary)', fontSize: 13,
              textDecoration: 'none', borderBottom: '1px solid transparent',
              transition: 'color 150ms, border-color 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderBottomColor = 'var(--accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderBottomColor = 'transparent'; }}
          >
            Voir la démo <ArrowRight size={12} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 2 }} />
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 24, fontSize: 13, color: 'var(--text-secondary)' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={14} /> {guildsDisplay} serveurs
          </span>
          <span style={{ width: 1, height: 16, backgroundColor: 'var(--border-color)' }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} /> {usersDisplay} utilisateurs
          </span>
        </motion.div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" style={{ padding: '80px 24px', maxWidth: 1000, margin: '0 auto' }}>
        {/* Feature 1: left text, right illustration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'flex', alignItems: 'center', gap: 48, marginBottom: 80, flexDirection: 'row' }}
          className="flex-col md:flex-row"
        >
          <div style={{ flex: 1 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 48, height: 48, backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)',
              marginBottom: 16,
            }}>
              <Shield size={24} style={{ color: 'var(--accent)' }} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
              Modération intelligente
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
              Bannissements, mutes et logs automatiques configurables en un clic. Anti-spam, anti-raid et protection avancée contre les menaces, le tout depuis le dashboard.
            </p>
          </div>
          <div style={{
            flex: 1, height: 200, border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={48} style={{ color: 'var(--accent)', opacity: 0.3 }} />
          </div>
        </motion.div>

        {/* Feature 2: right text, left illustration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: 'flex', alignItems: 'center', gap: 48, marginBottom: 80, flexDirection: 'row' }}
          className="flex-col md:flex-row-reverse"
        >
          <div style={{ flex: 1 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 48, height: 48, backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)',
              marginBottom: 16,
            }}>
              <BarChart3 size={24} style={{ color: 'var(--accent)' }} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
              Stats & Analytics
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
              Graphiques d'activité en temps réel, commandes les plus utilisées, croissance du serveur. Suivez l'évolution de votre communauté avec des données précises.
            </p>
          </div>
          <div style={{
            flex: 1, height: 200, border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <BarChart3 size={48} style={{ color: 'var(--accent)', opacity: 0.3 }} />
          </div>
        </motion.div>

        {/* Feature 3: full width */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ textAlign: 'center', padding: '48px 24px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 48, height: 48, backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)',
            marginBottom: 16,
          }}>
            <LayoutDashboard size={24} style={{ color: 'var(--accent)' }} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
            Dashboard web complet
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0, maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>
            Gérez tout depuis bot.pinguin.ovh sans jamais taper une commande. Configuration visuelle, logs détaillés, permissions granulaires — une interface, tout contrôler.
          </p>
        </motion.div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section style={{
        padding: '80px 24px', maxWidth: 800, margin: '0 auto',
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
              {/* Connecting line */}
              {i < STEPS.length - 1 && (
                <div style={{
                  position: 'absolute', top: 20, left: 'calc(50% + 24px)',
                  right: 'calc(-50% + 24px)', height: 0,
                  borderTop: '1px dashed var(--border-color)',
                }} className="hidden md:block" />
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

      {/* ─── FINAL CTA ─── */}
      <section style={{
        padding: '80px 24px', textAlign: 'center',
        backgroundColor: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-color)',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
            Prêt à améliorer ton serveur&nbsp;?
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 32px', maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
            Rejoins des centaines de serveurs qui font confiance à Pinguin.
          </p>
          <a href={user ? '/servers' : '/auth/login'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '14px 28px', backgroundColor: '#5865F2',
              color: '#fff', fontSize: 15, fontWeight: 600,
              textDecoration: 'none', border: 'none', cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#4752C4'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#5865F2'; }}
          >
            Ajouter maintenant
          </a>
        </motion.div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{
        padding: '32px 24px', textAlign: 'center',
        backgroundColor: 'var(--bg-primary)',
      }}>
        <Logo withText size={18} />
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 12 }}>
          &copy; {new Date().getFullYear()} Pinguin Empire
        </p>
      </footer>
    </div>
  );
}
