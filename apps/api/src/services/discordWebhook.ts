import { getConfig } from '@pinguin/config';

const COLOR_MAP: Record<string, number> = {
  RED: 0xE74C3C,
  ORANGE: 0xF39C12,
  BLUE: 0x3498DB,
};

function getColor(action: string): number {
  const upper = action.toUpperCase();
  if (
    upper.startsWith('RESTART') ||
    upper.startsWith('ROLLBACK') ||
    upper.startsWith('BLACKLIST') ||
    upper.startsWith('SERVICE_RESTART')
  ) {
    return COLOR_MAP.RED;
  }
  if (upper.startsWith('PREMIUM_GRANT') || upper.startsWith('PREMIUM_REVOKE')) {
    return COLOR_MAP.ORANGE;
  }
  return COLOR_MAP.BLUE;
}

export async function sendOwnerAlert(
  action: string,
  details: Record<string, unknown>,
): Promise<void> {
  const config = getConfig();
  const webhookUrl = config.OWNER_WEBHOOK_URL;

  if (!webhookUrl) return;

  const embed = {
    title: `🔔 ${action}`,
    description: '```json\n' + JSON.stringify(details, null, 2) + '\n```',
    color: getColor(action),
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!res.ok) {
      console.warn(`[WEBHOOK] Échec envoi alert (${res.status}) pour ${action}`);
    }
  } catch (err) {
    console.warn(`[WEBHOOK] Erreur envoi alert pour ${action}:`, err);
  }
}
