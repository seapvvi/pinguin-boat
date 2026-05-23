'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'motion/react'
import { Save, RotateCcw, Shield, Hammer } from 'lucide-react'
import { Card, Button, Input, Select, Skeleton, Toggle } from '@pinguin/ui'
import { api } from '@/lib/api'
export default function GuildSettingsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [settings, setSettings] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get<Record<string, any>>(`/guilds/${guildId}/settings`)
      .then(setSettings)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [guildId])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.put(`/guilds/${guildId}/settings`, settings)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Paramètres du serveur</h1>
        <Button onClick={handleSave} loading={saving}><Save className="w-4 h-4 mr-2" />Enregistrer</Button>
      </div>

      <Card className="space-y-5">
        <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Configuration générale</h2>

        <Select
          label="Locale"
          value={settings?.guild?.locale || 'fr'}
          onChange={(e) => setSettings(s => s ? { ...s, guild: { ...s.guild, locale: e.target.value } } : s)}
          options={[{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }]}
        />

        <Input
          label="Fuseau horaire"
          value={settings?.guild?.timezone || 'Europe/Paris'}
          onChange={(e) => setSettings(s => s ? { ...s, guild: { ...s.guild, timezone: e.target.value } } : s)}
          placeholder="Europe/Paris"
        />
      </Card>

      <Card className="space-y-5">
        <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>Rôles</h2>

        <Input
          label="ID du salon des logs de modération"
          value={settings?.modLogChannel || ''}
          onChange={(e) => setSettings(s => s ? { ...s, modLogChannel: e.target.value } : s)}
          placeholder="ID du salon"
        />

        <Input
          label="ID du rôle muet"
          value={settings?.muteRoleId || ''}
          onChange={(e) => setSettings(s => s ? { ...s, muteRoleId: e.target.value } : s)}
          placeholder="ID du rôle"
        />
      </Card>

      <Card className="space-y-5 border" style={{ borderColor: 'var(--error)' }}>
        <h2 className="text-lg font-medium" style={{ color: 'var(--error)' }}>Zone de danger</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Réinitialiser tous les paramètres du serveur. Action irréversible.</p>
        <Button variant="danger"><RotateCcw className="w-4 h-4 mr-2" />Réinitialiser les paramètres</Button>
      </Card>
    </motion.div>
  )
}
