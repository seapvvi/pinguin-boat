'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Heart, ExternalLink } from 'lucide-react';
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

export default function SupportPage() {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ data: { donors: Donor[] } }>('/api/donors')
      .then((res) => {
        if (res.success && res.data) setDonors((res.data as any).donors ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 max-w-3xl space-y-6">
      <div className="text-center space-y-3">
        <Heart className="w-10 h-10 mx-auto text-[var(--accent)]" />
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Soutenir Pinguin Boat</h1>
        <p className="text-sm text-[var(--text-secondary)] max-w-lg mx-auto">
          Pinguin Boat est un projet communautaire gratuit. Si vous appréciez le bot, un petit don aide à
          couvrir l&apos;hébergement et le développement — sans aucune obligation.
        </p>
        <a href={DONATION_URL} target="_blank" rel="noopener noreferrer">
          <Button>
            <ExternalLink size={14} className="mr-2" /> Faire un don
          </Button>
        </a>
      </div>

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
                className="flex items-center gap-3 p-3 rounded-[var(--radius-sm)] border border-[var(--border-color)]"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--bg-surface-alt)] flex items-center justify-center text-lg">
                  {d.avatarUrl ? (
                    <img src={d.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
                  ) : (
                    '💙'
                  )}
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

      <p className="text-xs text-center text-[var(--text-secondary)]">
        Merci à tous ceux qui contribuent à faire vivre Pinguin Boat 💙
      </p>
    </motion.div>
  );
}
