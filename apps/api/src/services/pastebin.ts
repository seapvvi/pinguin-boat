import { getConfig } from '@pinguin/config';

export async function uploadToPastebin(content: string, title: string): Promise<string | null> {
  const config = getConfig();
  if (!config.PASTEBIN_API_KEY) return null;

  try {
    const formData = new URLSearchParams();
    formData.set('api_dev_key', config.PASTEBIN_API_KEY);
    formData.set('api_option', 'paste');
    formData.set('api_paste_code', content);
    formData.set('api_paste_name', title);
    formData.set('api_paste_format', 'html');
    formData.set('api_paste_private', '1');

    const res = await fetch('https://pastebin.com/api/api_post.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    if (!res.ok) return null;
    const url = await res.text();
    if (url.startsWith('https://pastebin.com/')) return url;
    return null;
  } catch {
    return null;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatContent(raw: string): string {
  return escapeHtml(raw)
    .replace(/@(\w{2,32})/g, '<span class="mention">@$1</span>')
    .replace(/\n/g, '<br>');
}

export function generateTicketTranscriptHtml(
  messages: any[],
  ticketSubject: string,
  meta?: { guildName?: string; openedAt?: string; closedAt?: string; closedBy?: string; closeReason?: string }
): string {
  const ordered = [...messages].reverse();
  const messageBlocks = ordered.map((m: any) => {
    const time = m.timestamp ? new Date(m.timestamp).toLocaleString('fr-FR') : '';
    const author = m.author?.username ?? 'Inconnu';
    const avatar = m.author?.avatar
      ? `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}.png?size=64`
      : '';
    const isBot = m.author?.bot;
    const content = m.content ? formatContent(m.content) : '<em class="empty">Aucun texte</em>';
    const attachments = (m.attachments ?? [])
      .map((a: any) => `<a href="${escapeHtml(a.url)}" target="_blank" rel="noopener">📎 Pièce jointe</a>`)
      .join(' ');
    const embeds = (m.embeds ?? [])
      .map(
        (e: any) =>
          `<div class="embed"><div class="embed-title">${escapeHtml(e.title || 'Embed')}</div><div class="embed-desc">${escapeHtml(e.description || '')}</div></div>`
      )
      .join('');

    return `<div class="msg${isBot ? ' bot-msg' : ''}">
      ${avatar ? `<img src="${avatar}" class="avatar" alt="" />` : '<div class="avatar placeholder"></div>'}
      <div class="msg-body">
        <div class="msg-header"><span class="author">${escapeHtml(author)}</span><span class="timestamp">${time}</span></div>
        <div class="content">${content}${attachments}${embeds}</div>
      </div>
    </div>`;
  }).join('\n');

  const guildName = meta?.guildName ?? 'Serveur';
  const openedAt = meta?.openedAt ?? '—';
  const closedAt = meta?.closedAt ?? '—';
  const closedBy = meta?.closedBy ?? '—';
  const closeReasonBlock = meta?.closeReason
    ? `<span>Motif : <strong>${escapeHtml(meta.closeReason)}</strong></span>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ticket: ${escapeHtml(ticketSubject)}</title>
<style>
  :root { --bg: #0e1117; --surface: #161b22; --surface2: #1c2128; --border: #30363d; --text: #e6edf3; --text-muted: #8b949e; --accent: #14b8a6; --accent-bg: rgba(20,184,166,0.1); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); }
  .header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 24px 32px; display: flex; align-items: center; gap: 16px; }
  .header-icon { width: 48px; height: 48px; background: var(--accent-bg); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; }
  .header-info h1 { font-size: 20px; font-weight: 700; }
  .header-info p { color: var(--text-muted); font-size: 14px; margin-top: 4px; }
  .meta-bar { background: var(--surface2); border-bottom: 1px solid var(--border); padding: 12px 32px; display: flex; flex-wrap: wrap; gap: 24px; font-size: 13px; color: var(--text-muted); }
  .meta-bar strong { color: var(--text); }
  .messages { max-width: 900px; margin: 0 auto; padding: 24px 32px; display: flex; flex-direction: column; gap: 4px; }
  .msg { display: flex; gap: 12px; padding: 8px; border-radius: 8px; }
  .msg:hover { background: var(--surface2); }
  .msg.bot-msg .author { color: var(--accent); }
  .avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; }
  .avatar.placeholder { background: var(--surface2); }
  .msg-body { flex: 1; min-width: 0; }
  .msg-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
  .author { font-weight: 600; font-size: 15px; }
  .timestamp { font-size: 11px; color: var(--text-muted); }
  .content { font-size: 15px; line-height: 1.6; word-break: break-word; }
  .content .empty { color: var(--text-muted); font-style: italic; }
  .mention { background: rgba(88,101,242,0.2); color: #a8b4f8; padding: 0 2px; border-radius: 3px; }
  .embed { margin-top: 8px; background: var(--surface2); border-left: 3px solid var(--accent); padding: 10px 14px; border-radius: 0 6px 6px 0; }
  .embed-title { font-weight: 700; font-size: 14px; color: var(--accent); margin-bottom: 4px; }
  .embed-desc { font-size: 14px; color: var(--text-muted); }
  .footer { text-align: center; padding: 32px; color: var(--text-muted); font-size: 13px; border-top: 1px solid var(--border); margin-top: 24px; }
</style>
</head>
<body>
<div class="header">
  <div class="header-icon">🎫</div>
  <div class="header-info">
    <h1>Ticket — ${escapeHtml(ticketSubject)}</h1>
    <p>Serveur : ${escapeHtml(guildName)} · ${ordered.length} message(s)</p>
  </div>
</div>
<div class="meta-bar">
  <span>Ouvert le <strong>${escapeHtml(openedAt)}</strong></span>
  <span>Fermé le <strong>${escapeHtml(closedAt)}</strong></span>
  <span>Fermé par <strong>${escapeHtml(closedBy)}</strong></span>
  ${closeReasonBlock}
</div>
<div class="messages">
${messageBlocks}
</div>
<div class="footer">Transcription générée par Pinguin Boat · ${new Date().toLocaleString('fr-FR')}</div>
</body>
</html>`;
}
