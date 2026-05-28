'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Save, RotateCcw, LogOut, Trash2 } from 'lucide-react';
import { Card, Button, Input, Select, Skeleton, Modal } from '@pinguin/ui';
import { api } from '@/lib/api';
import { DiscordSelect } from '@/components/DiscordSelect';

export default function GuildSettingsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const router = useRouter();
  const [settings, setSettings] = useState<Record<string, any> | null>(null);
  const [guildName, setGuildName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dangerModal, setDangerModal] = useState<'reset' | 'leave' | 'delete' | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [dangerLoading, setDangerLoading] = useState(false);

  useEffect(() => {
    api.get<Record<string, any>>(`/api/guilds/${guildId}`)
      .then((res) => {
        if (res.success && res.data) {
          const d = res.data as any;
          setSettings(d.guild ?? d);
          setGuildName(d.guild?.name ?? d.name ?? '');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [guildId]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    try {
      await api.put(`/api/guilds/${guildId}`, { guild: settings });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const runDanger = async () => {
    if (confirmName !== guildName) return;
    setDangerLoading(true);
    try {
      if (dangerModal === 'reset') {
        await api.post(`/api/guilds/${guildId}/settings/reset`, { confirmName });
      } else if (dangerModal === 'leave') {
        await api.post(`/api/guilds/${guildId}/settings/leave`, {});
        router.push('/servers');
      } else if (dangerModal === 'delete') {
        await api.post(`/api/guilds/${guildId}/settings/delete-data`, { confirmName });
        router.push('/servers');
      }
      setDangerModal(null);
      setConfirmName('');
    } finally {
      setDangerLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Paramètres du serveur</h1>
        <Button onClick={handleSave} loading={saving}>
          {saved ? '✓ Enregistré' : <><Save className="w-4 h-4 mr-2" />Enregistrer</>}
        </Button>
      </div>

      <Card className="space-y-5 p-4">
        <h2 className="text-lg font-medium text-[var(--text-primary)]">Configuration générale</h2>
        <Select
          label="Locale"
          value={settings?.locale || 'fr'}
          onChange={(e) => setSettings((s) => ({ ...s, locale: e.target.value }))}
          options={[
            { value: 'fr', label: 'Français' },
            { value: 'en', label: 'English' },
          ]}
        />
        <Input
          label="Fuseau horaire"
          value={settings?.timezone || 'Europe/Paris'}
          onChange={(e) => setSettings((s) => ({ ...s, timezone: e.target.value }))}
        />
      </Card>

      <Card className="space-y-5 p-4">
        <h2 className="text-lg font-medium text-[var(--text-primary)]">Modération</h2>
        <DiscordSelect
          type="channel"
          guildId={guildId}
          label="Salon des logs de modération"
          value={settings?.modLogChannelId || ''}
          onChange={(id) => setSettings((s) => ({ ...s, modLogChannelId: id }))}
        />
        <DiscordSelect
          type="role"
          guildId={guildId}
          label="Rôle muet"
          value={settings?.muteRoleId || ''}
          onChange={(id) => setSettings((s) => ({ ...s, muteRoleId: id }))}
        />
      </Card>

      <Card className="space-y-5 p-4">
        <h2 className="text-lg font-medium text-[var(--text-primary)]">Accès au dashboard</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Configurez les rôles qui auront accès au dashboard de ce serveur. Par défaut, seul le propriétaire du serveur et les administrateurs Discord ont accès complet.
        </p>
        <DiscordSelect
          type="role"
          guildId={guildId}
          label="Rôle avec accès complet au dashboard"
          value={settings?.dashboardAccessRoles?.[0] || ''}
          onChange={(id) => setSettings((s) => ({ ...s, dashboardAccessRoles: id ? [id] : [] }))}
          placeholder="Sélectionner un rôle (optionnel)"
        />
        <p className="text-xs text-[var(--text-secondary)]">
          Les membres ayant ce rôle pourront accéder à l'intégralité du dashboard de ce serveur, même sans être administrateur Discord.
        </p>
      </Card>

      <Card className="space-y-4 p-4 border border-[var(--error)]">
        <h2 className="text-lg font-medium text-[var(--error)]">Zone de danger</h2>
        <p className="text-sm text-[var(--text-secondary)]">Actions irréversibles — confirmation par le nom du serveur requise.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="danger" onClick={() => setDangerModal('reset')}>
            <RotateCcw className="w-4 h-4 mr-2" /> Réinitialiser
          </Button>
          <Button variant="danger" onClick={() => setDangerModal('leave')}>
            <LogOut className="w-4 h-4 mr-2" /> Expulser le bot
          </Button>
          <Button variant="danger" onClick={() => setDangerModal('delete')}>
            <Trash2 className="w-4 h-4 mr-2" /> Supprimer les données
          </Button>
        </div>
      </Card>

      <Modal
        open={!!dangerModal}
        onClose={() => { setDangerModal(null); setConfirmName(''); }}
        title="Confirmer l'action"
      >
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Tapez <strong>{guildName}</strong> pour confirmer.
        </p>
        <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={guildName} />
        <div className="flex gap-2 mt-4">
          <Button variant="danger" onClick={runDanger} loading={dangerLoading} disabled={confirmName !== guildName}>
            Confirmer
          </Button>
          <Button variant="secondary" onClick={() => setDangerModal(null)}>Annuler</Button>
        </div>
      </Modal>
    </motion.div>
  );
}
