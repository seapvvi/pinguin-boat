'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Heart, ExternalLink, Palette, MessageCircle, Star, Rocket,
  Vote, Brush, Shield, Megaphone, Users
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

  useEffect(() => {
    api.get<{ data?: { donors?: Donor[] }; donors?: Donor[] }>('/api/donors')
      .then((res) => {
        const list = res?.data?.donors ?? res?.donors ?? [];
        setDonors(list);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="text-center space-y-3">
        <Heart className="w-10 h-10 mx-auto text-[var(--accent)]" />
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Soutenir Pinguin Boat</h1>
        <p className="text-sm text-[var(--text-secondary)] max-w-lg mx-auto">
          Pinguin Boat est un projet 100% open source. Vos dons couvrent directement l&apos;hébergement du serveur
          et me permettent de consacrer plus de temps au développement de nouvelles fonctionnalités.
          Chaque contribution compte, même la plus petite. Merci du fond du cœur.
        </p>
        <button type="button" onClick={() => setShowPopup(true)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          <Button>
            <ExternalLink size={14} className="mr-2" /> Faire un don
          </Button>
        </button>
        {showPopup && <KofiPopup onClose={() => setShowPopup(false)} />}
        <p className="text-xs text-[var(--text-secondary)]">
          Tout don de 5€ ou plus débloque immédiatement tous les avantages ci-dessous.
        </p>
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Ce que vous obtenez dès 5€</h2>
        <p className="text-xs text-[var(--text-secondary)] mb-4">
          Aucune fonctionnalité du bot n&apos;est verrouillée. Ces avantages sont uniquement cosmétiques et communautaires.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PERKS.map((p) => (
            <div key={p.title} className="flex gap-3 p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)] border border-[var(--border-color)]">
              <span className="text-[var(--accent)] shrink-0 mt-0.5">{p.icon}</span>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{p.title}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

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
          <p className="text-sm text-[var(--text-secondary)]">Soyez le premier à soutenir le projet et apparaître ici !</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {donors.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 p-3 rounded-[var(--radius-sm)] border border-[var(--border-color)] bg-[var(--bg-surface-alt)]"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-lg shrink-0">
                  {d.avatarUrl ? <img src={d.avatarUrl} alt="" className="w-10 h-10 rounded-full" /> : <Heart size={18} className="text-[var(--accent)]" />}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-[var(--text-primary)] truncate">{d.username}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{d.amount.toFixed(2)} €</p>
                  {d.message && <p className="text-xs text-[var(--text-secondary)] mt-1 italic truncate">&quot;{d.message}&quot;</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
