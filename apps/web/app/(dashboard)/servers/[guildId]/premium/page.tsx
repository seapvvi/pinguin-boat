'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Heart, ExternalLink, Sparkles, Palette, MessageCircle, Star } from 'lucide-react';
import { Card, Skeleton, Button } from '@pinguin/ui';
import { api } from '@/lib/api';

interface Donor {
  id: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  amount: number;
  message: string | null;
}

const DONATION_URL = process.env.NEXT_PUBLIC_DONATION_URL || 'https://ko-fi.com';
const PERKS = [
  { icon: <Palette size={18} />, title: 'Thèmes exclusifs', desc: 'Accès anticipé aux thèmes dashboard réservés aux donateurs.' },
  { icon: <MessageCircle size={18} />, title: 'Ligne directe équipe', desc: 'Canal prioritaire pour vos retours et suggestions de fonctionnalités.' },
  { icon: <Star size={18} />, title: 'Badge donateur', desc: 'Reconnaissance sur la page d\'accueil et dans notre Discord.' },
  { icon: <Sparkles size={18} />, title: 'Zéro pay-to-win', desc: 'Le bot et le dashboard restent identiques pour tous — seuls des cosmétiques et l\'accès équipe.' },
];

export default function SupportPage() {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: { donors: Donor[] } }>('/api/donors')
      .then((res) => { if (res.success && res.data) setDonors((res.data as { donors: Donor[] }).donors ?? []); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 max-w-3xl space-y-6">
      <div className="text-center space-y-3">
        <Heart className="w-10 h-10 mx-auto text-[var(--accent)]" />
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Soutenir Pinguin Boat</h1>
        <p className="text-sm text-[var(--text-secondary)] max-w-lg mx-auto">
          Votre soutien aide à payer l&apos;hébergement et le développement. Aucune fonctionnalité du bot n&apos;est bloquée —
          les avantages ci-dessous sont cosmétiques ou communautaires.
        </p>
        <a href={DONATION_URL} target="_blank" rel="noopener noreferrer">
          <Button>
            <ExternalLink size={14} className="mr-2" /> Faire un don
          </Button>
        </a>
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Avantages donateurs</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PERKS.map((p) => (
            <div key={p.title} className="flex gap-3 p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)] border border-[var(--border-color)]">
              <span className="text-[var(--accent)]">{p.icon}</span>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{p.title}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-medium text-[var(--text-primary)] mb-4">Nos donateurs</h2>
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : donors.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Soyez le premier à soutenir le projet !</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {donors.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 p-3 rounded-[var(--radius-sm)] border border-[var(--border-color)] bg-[var(--bg-surface-alt)]"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--bg-surface)] flex items-center justify-center text-lg">
                  {d.avatarUrl ? <img src={d.avatarUrl} alt="" className="w-10 h-10 rounded-full" /> : '💙'}
                </div>
                <div>
                  <p className="font-medium text-[var(--text-primary)]">{d.username}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{d.amount.toFixed(2)} €</p>
                  {d.message && <p className="text-xs text-[var(--text-secondary)] mt-1 italic">&quot;{d.message}&quot;</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
