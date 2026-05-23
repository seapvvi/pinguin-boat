import { getConfig } from '@pinguin/config';

const config = getConfig();

interface WebhookPayload {
  embeds: Array<{
    title: string;
    description: string;
    color: number;
    timestamp?: string;
    fields?: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
  }>;
}

const WEBHOOK_COLORS = {
  success: 0x57f287,
  error: 0xed4245,
  warning: 0xfee75c,
  info: 0x5865f2,
  deploy: 0x9b59b6,
} as const;

export async function sendWebhook(
  webhookUrl: string,
  payload: WebhookPayload
): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    console.error('[Webhook] Échec d\'envoi du webhook');
  }
}

export function sendDeployNotification(
  webhookUrl: string,
  status: 'running' | 'success' | 'failed' | 'rollback',
  version: string,
  details: string
): void {
  const colors = {
    running: WEBHOOK_COLORS.warning,
    success: WEBHOOK_COLORS.success,
    failed: WEBHOOK_COLORS.error,
    rollback: WEBHOOK_COLORS.warning,
  };

  const titles: Record<string, string> = {
    running: '🚀 Déploiement en cours',
    success: '✅ Déploiement réussi',
    failed: '❌ Déploiement échoué',
    rollback: '⏪ Rollback effectué',
  };

  sendWebhook(webhookUrl, {
    embeds: [
      {
        title: titles[status] || 'Déploiement',
        description: details,
        color: colors[status] || WEBHOOK_COLORS.info,
        timestamp: new Date().toISOString(),
        fields: [
          { name: 'Version', value: version, inline: true },
          { name: 'Statut', value: status, inline: true },
        ],
      },
    ],
  });
}

export function sendErrorNotification(
  webhookUrl: string,
  errorMessage: string,
  context?: Record<string, unknown>
): void {
  sendWebhook(webhookUrl, {
    embeds: [
      {
        title: '⚠️ Erreur détectée',
        description: `\`\`\`${errorMessage.slice(0, 1900)}\`\`\``,
        color: WEBHOOK_COLORS.error,
        timestamp: new Date().toISOString(),
        fields: context
          ? Object.entries(context).map(([k, v]) => ({
              name: k,
              value: String(v).slice(0, 1000),
              inline: true,
            }))
          : [],
      },
    ],
  });
}

export function sendOwnerNotification(
  webhookUrl: string,
  title: string,
  description: string,
  color: keyof typeof WEBHOOK_COLORS = 'info'
): void {
  sendWebhook(webhookUrl, {
    embeds: [
      {
        title,
        description,
        color: WEBHOOK_COLORS[color],
        timestamp: new Date().toISOString(),
      },
    ],
  });
}
