'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useConfetti } from '@/hooks/useConfetti';
import { motion } from 'motion/react';
import {
  Heart, ExternalLink, Palette, MessageCircle, Star, Rocket,
  Vote, Brush, Shield, Megaphone, Users, Trophy, Medal, Lock
} from 'lucide-react';
import { Card, Skeleton, Button } from '@pinguin/ui';
import { api } from '@/lib/api';
import KofiPopup from '@/components/KofiPopup';

interface Donor {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  amount: number;
  message: string | null;
}

const PERKS = [
  { icon: <Shield size={18} />, title: 'Rôle Donateur Discord', desc: 'Un rôle exclusif avec une couleur distinctive sur notre serveur Discord officiel.' },
  { icon: <MessageCircle size={18} />, title: 'Salon privé #donateurs', desc: 'Accès au salon privé réservé aux donateurs pour échanger directement avec l\'équipe et influencer le projet.' },
  { icon: <Star size={18} />, title: 'Badge sur votre profil', desc: 'Un badge 💙 Donateur affiché sur votre profil dans le dashboard, visible par toute la communauté.' },
  { icon: <Megaphone size={18} />, title: 'Annonce publique', desc: 'Votre soutien est célébré dans notre serveur Discord. Option de rester anonyme disponible.' },
  { icon: <Rocket size={18} />, title: 'Accès anticipé aux bêtas', desc: 'Vous testez les nouvelles fonctionnalités en avant-première, avant tout le monde.' },
  { icon: <Vote size={18} />, title: 'Vote prioritaire roadmap', desc: 'Vos votes et suggestions pour les prochaines fonctionnalités ont un poids prioritaire.' },
  { icon: <Palette size={18} />, title: 'Thèmes dashboard exclusifs', desc: 'Accès à des thèmes de couleurs supplémentaires dans le dashboard : Gold, Aurora, Crimson, et bientôt d\'autres.' },
  { icon: <Brush size={18} />, title: 'Couleur d\'embed custom', desc: 'Personnalisez la couleur des embeds du bot sur votre serveur avec la commande /embed-color.' },
];

export default function SupportPage() {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPopup, setShowPopup] = useState(false);
  const reduced = useReducedMotion();
  const { fire } = useConfetti();

  useEffect(() => {
    api.get<{ data?: { donors?: Donor[] }; donors?: Donor[] }>('/api/donors')
      .then((res) => {
        const list = res?.data?.donors ?? res?.donors ?? [];
        setDonors(list);
      })
      .finally(() => setLoading(false));
  }, []);

  const sortedDonors = [...donors].sort((a, b) => b.amount - a.amount);
  const topDonors = sortedDonors.slice(0, 3);
  const restDonors = sortedDonors.slice(3);

  const stats = [
    { label: 'Donateurs', value: donors.length > 0 ? donors.length : '—', icon: <Users size={16} /> },
    { label: 'Total récolté', value: donors.length > 0
        ? `${donors.reduce((s, d) => s + d.amount, 0).toFixed(0)} €`
        : '—', icon: <Heart size={16} /> },
    { label: 'Avantages inclus', value: PERKS.length.toString(), icon: <Star size={16} /> },
  ];

  const sectionAnimation = (index: number) => reduced
    ? { initial: {}, animate: {} }
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { delay: index * 0.1, duration: 0.4 },
      };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Section 0: Hero */}
      <motion.div {...sectionAnimation(0)}>
        <div className="relative text-center space-y-4 py-10">
          <div
            className="absolute inset-0 -z-10 rounded-2xl"
            style={{
              background: 'radial-gradient(ellipse at center, color-mix(in srgb, var(--accent) 8%, transparent) 0%, transparent 70%)',
            }}
          />
          <motion.div
            animate={reduced ? {} : { scale: [1, 1.06, 1] }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 5, ease: 'easeInOut' }}
          >
            <Heart className="w-12 h-12 mx-auto text-[var(--accent)]" />
          </motion.div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Soutenir Pinguin Boat</h1>
          <p className="text-base text-[var(--text-secondary)] max-w-lg mx-auto">
            Pinguin Boat est un projet 100% open source. Vos dons couvrent directement l&apos;hébergement du serveur
            et me permettent de consacrer plus de temps au développement de nouvelles fonctionnalités.
            Chaque contribution compte, même la plus petite. Merci du fond du cœur.
          </p>
          <motion.div
            animate={reduced ? {} : { scale: [1, 1.03, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
          >
            <Button onClick={() => { fire('donate'); setShowPopup(true); }} size="lg">
              <ExternalLink size={16} /> Faire un don
            </Button>
          </motion.div>
          <div className="flex items-center justify-center gap-1 text-xs text-[var(--text-secondary)]">
            <Lock size={12} />
            <span>100% open source · Aucune fonctionnalité verrouillée</span>
          </div>
          {showPopup && <KofiPopup onClose={() => setShowPopup(false)} />}
        </div>
      </motion.div>

      {/* Section 1: Stats */}
      <motion.div {...sectionAnimation(1)}>
        <Card className="px-4 py-3">
          <div className="flex items-center justify-center divide-x divide-[var(--border-color)]">
            {stats.map((s) => (
              <div key={s.label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[var(--accent)]">{s.icon}</span>
                <span className="text-xs text-[var(--text-secondary)]">{s.label}</span>
                {loading ? (
                  <Skeleton className="h-4 w-12" />
                ) : (
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{s.value}</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Section 2: Perks */}
      <motion.div {...sectionAnimation(2)}>
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Ce que vous obtenez dès 5€</h2>
          <p className="text-xs text-[var(--text-secondary)] mb-4">
            Aucune fonctionnalité du bot n&apos;est verrouillée. Ces avantages sont uniquement cosmétiques et communautaires.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PERKS.map((p) => (
              <motion.div
                key={p.title}
                whileHover={reduced ? {} : { y: -2 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="flex gap-3 p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)] border border-[var(--border-color)]"
              >
                <span
                  className="shrink-0 rounded-full p-2 flex items-center justify-center text-[var(--accent)]"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                    width: '2.25rem',
                    height: '2.25rem',
                  }}
                >
                  {p.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{p.title}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{p.desc}</p>
                  <span className="block mt-1.5 text-[10px] text-[var(--accent)] uppercase tracking-wide">
                    Inclus dès 5€
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Section 3: Donors */}
      <motion.div {...sectionAnimation(3)}>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Heart size={16} className="text-[var(--accent)]" />
            <h2 className="text-lg font-medium text-[var(--text-primary)]">Ils soutiennent le projet</h2>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-4">
            Merci à toutes ces personnes qui rendent Pinguin Boat possible.
          </p>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : donors.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="32" cy="32" r="28" stroke="var(--border-color)" strokeWidth="2" strokeDasharray="4 4" fill="none" />
                <path d="M32 46C28 42 20 36 20 30C20 26 23 23 27 23C29.5 23 31.5 24.5 32 26C32.5 24.5 34.5 23 37 23C41 23 44 26 44 30C44 36 36 42 32 46Z" fill="var(--accent)" opacity="0.5" />
              </svg>
              <p className="text-sm text-[var(--text-secondary)]">Soyez le premier à soutenir le projet et apparaître ici !</p>
              <Button onClick={() => { fire('donate'); setShowPopup(true); }} size="sm">
                Être le premier
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {topDonors.map((d, i) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 p-3 rounded-[var(--radius-sm)] border border-[var(--border-color)] bg-[var(--bg-surface-alt)]"
                >
                  {i === 0 ? (
                    <Trophy size={20} className="text-yellow-400 shrink-0" />
                  ) : (
                    <Medal size={18} className="text-[var(--text-secondary)] shrink-0" />
                  )}
                  <div className="w-10 h-10 rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-lg shrink-0">
                    {d.avatarUrl ? (
                      <img src={d.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                    ) : (
                      <Heart size={18} className="text-[var(--accent)]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={i === 0 ? 'text-base font-bold text-[var(--text-primary)] truncate' : 'text-sm text-[var(--text-primary)] truncate'}>
                      {d.username}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">{d.amount.toFixed(2)} €</p>
                  </div>
                </div>
              ))}
              {restDonors.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {restDonors.map((d) => (
                    <span
                      key={d.id}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-[var(--bg-surface-alt)] border border-[var(--border-color)] text-xs text-[var(--text-primary)]"
                    >
                      <span className="w-5 h-5 rounded-full bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                        {d.avatarUrl ? (
                          <img src={d.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
                        ) : (
                          <Heart size={10} className="text-[var(--accent)]" />
                        )}
                      </span>
                      {d.username}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
