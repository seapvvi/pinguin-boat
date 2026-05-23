'use client'

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Crown, Check, X as XIcon } from 'lucide-react'
import { Card, Badge, Skeleton, Button, Toggle } from '@pinguin/ui'
import { api } from '@/lib/api'
import { useParams } from 'next/navigation'

interface PremiumInfo {
  plan: string
  status: string
  features: { key: string; name: string; enabled: boolean }[]
  alphaAllFree: boolean
}

const plans = [
  { name: 'FREE', price: '0 €', servers: 1, features: ['Modération', 'Protection basique', 'Niveaux/XP', 'Logs'] },
  { name: 'BASIC', price: '2 €/mois', servers: 3, features: ['Tout du FREE', 'Tickets', 'Économie', 'Musique', 'Giveaways', 'Sondages', 'Suggestions'] },
  { name: 'PRO', price: '5 €/mois', servers: 10, features: ['Tout du BASIC', 'Priorité support', 'Auto-rôles avancés', 'Embeds personnalisés', 'Protection avancée'] },
  { name: 'ENTERPRISE', price: 'Sur devis', servers: 'Illimité', features: ['Tout du PRO', 'Support prioritaire', 'Fonctionnalités sur mesure', 'SLA garanti'] },
]

export default function PremiumPage() {
  const params = useParams<{ guildId: string }>()
  const [premium, setPremium] = useState<PremiumInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<PremiumInfo>(`/guilds/${params.guildId}/premium`)
      .then(setPremium)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [params.guildId])

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64" /></div>

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Crown className="w-6 h-6" style={{ color: 'var(--warning)' }} />
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Premium</h1>
      </div>

      {premium?.alphaAllFree && (
        <Card className="border-2" style={{ borderColor: 'var(--success)' }}>
          <p className="font-medium" style={{ color: 'var(--success)' }}>Mode Alpha — Tout est gratuit</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Pendant la phase alpha, toutes les fonctionnalités sont débloquées gratuitement.
            Aucune limite de serveur n&apos;est appliquée pour le moment.
          </p>
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-medium mb-4" style={{ color: 'var(--text-primary)' }}>Plan actuel</h2>
        <div className="flex items-center gap-3">
          <Badge>{premium?.plan || 'FREE'}</Badge>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Statut : {premium?.status || 'Actif'}</span>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map(plan => (
          <Card key={plan.name} hover className={`relative ${plan.name === (premium?.plan || 'FREE') ? 'ring-2 ring-[var(--accent)]' : ''}`}>
            {plan.name === (premium?.plan || 'FREE') && (
              <div className="absolute -top-2 -right-2">
                <Badge>Actuel</Badge>
              </div>
            )}
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{plan.name}</h3>
            <p className="text-2xl font-bold mt-2" style={{ color: 'var(--accent)' }}>{plan.price}</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Jusqu&apos;à {plan.servers} serveur{plan.servers !== 1 ? 's' : ''}</p>
            <ul className="mt-4 space-y-2">
              {plan.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4" style={{ color: 'var(--success)' }} />
                  <span style={{ color: 'var(--text-primary)' }}>{f}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </motion.div>
  )
}
