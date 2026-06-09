'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Heart, Plus, Trash2 } from 'lucide-react';
import { Card, Button, Input, Skeleton, Toggle } from '@pinguin/ui';
import { api } from '@/lib/api';

interface Donor {
  id: string;
  userId: string;
  username: string;
  amount: number;
  message: string | null;
  isPublic: boolean;
}

export default function OwnerDonorsPage() {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ userId: '', username: '', amount: 0, message: '', isPublic: true });

  const load = () => {
    api.get('/api/owner/donors')
      .then((res: unknown) => {
        const list = (res as { data?: { donors?: Donor[] } })?.data?.donors ?? [];
        setDonors(list);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.userId || !form.username) return;
    await api.post('/api/owner/donors', { ...form, amount: Number(form.amount) });
    setForm({ userId: '', username: '', amount: 0, message: '', isPublic: true });
    load();
  };

  const remove = async (id: string) => {
    await api.delete(`/api/owner/donors/${id}`);
    load();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)] flex items-center gap-2">
        <Heart size={22} /> Gestion des donateurs
      </h1>

      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-medium">Ajouter un donateur</h2>
        <Input label="ID Discord" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} />
        <Input label="Pseudo" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <Input label="Montant (€)" type="number" value={String(form.amount)} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} />
        <Input label="Message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        <div className="flex items-center justify-between">
          <span className="text-sm">Public</span>
          <Toggle checked={form.isPublic} onChange={(v) => setForm({ ...form, isPublic: v })} />
        </div>
        <Button onClick={add}><Plus size={14} className="mr-1" /> Ajouter</Button>
      </Card>

      <Card className="p-4">
        {loading ? <Skeleton className="h-32" /> : (
          <ul className="space-y-2">
            {donors.map((d) => (
              <li key={d.id} className="flex items-center justify-between p-2 rounded bg-[var(--bg-surface-alt)]">
                <span className="text-sm">{d.username} — {d.amount}€</span>
                <Button variant="ghost" size="sm" onClick={() => remove(d.id)}><Trash2 size={14} /></Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </motion.div>
  );
}
