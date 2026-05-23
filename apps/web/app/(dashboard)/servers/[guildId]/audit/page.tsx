'use client'

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Card, Input, Skeleton, Badge, Table, type Column } from '@pinguin/ui'
import { api } from '@/lib/api'
import { useParams } from 'next/navigation'

interface AuditEntry {
  id: string
  action: string
  userId: string | null
  details: string | null
  createdAt: string
}

export default function AuditPage() {
  const params = useParams<{ guildId: string }>()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get<{ data: AuditEntry[] }>(`/guilds/${params.guildId}/audit`)
      .then(res => setEntries(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [params.guildId])

  const filtered = entries.filter(e =>
    e.action.toLowerCase().includes(search.toLowerCase())
  )

  const actionLabels: Record<string, string> = {
    SETTINGS_CHANGE: 'Modification des paramètres',
    MODERATION_ACTION: 'Action de modération',
    TICKET_CREATE: 'Création de ticket',
    TICKET_CLOSE: 'Fermeture de ticket',
    ROLE_UPDATE: 'Mise à jour des rôles',
    MODULE_TOGGLE: 'Activation/Désactivation de module',
  }

  const columns: Column<AuditEntry>[] = [
    { key: 'createdAt', label: 'Date', render: (item) => new Date(item.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) },
    { key: 'action', label: 'Action', render: (item) => <Badge>{actionLabels[item.action] || item.action}</Badge> },
    { key: 'details', label: 'Détails', render: (item) => item.details || '—' },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Journal d&apos;audit</h1>

      <Input
        placeholder="Rechercher par action..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Card padding={false}>
        {loading ? (
          <div className="p-4 space-y-3"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
        ) : (
          <Table columns={columns} data={filtered} keyExtractor={(e) => e.id} />
        )}
      </Card>
    </motion.div>
  )
}
