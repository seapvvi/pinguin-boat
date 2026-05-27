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
    const time = m.timestamp ? new Date(m.timestamp).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    const author = m.author?.username ?? 'Inconnu';
    const authorId = m.author?.id ?? '';
    const avatar = m.author?.avatar
      ? `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}.png?size=64`
      : '';
    const isBot = m.author?.bot;
    const content = m.content ? formatContent(m.content) : '';
    const attachments = (m.attachments ?? [])
      .map((a: any) => `<a href="${escapeHtml(a.url)}" target="_blank" rel="noopener" class="attachment">📎 ${escapeHtml(a.name || 'Pièce jointe')}</a>`)
      .join('<br>');
    const embeds = (m.embeds ?? [])
      .map(
        (e: any) => {
          const title = e.title ? `<div class="embed-title">${escapeHtml(e.title)}</div>` : '';
          const desc = e.description ? `<div class="embed-desc">${escapeHtml(e.description)}</div>` : '';
          const fields = (e.fields ?? []).map((f: any) => `<div class="embed-field"><strong>${escapeHtml(f.name)}</strong>: ${escapeHtml(f.value)}</div>`).join('');
          return title || desc || fields ? `<div class="embed">${title}${desc}${fields}</div>` : '';
        }
      )
      .join('');

    if (!content && !attachments && !embeds) return '';

    return `<div class="msg${isBot ? ' bot-msg' : ''}">
      ${avatar ? `<img src="${avatar}" class="avatar" alt="" />` : '<div class="avatar placeholder"></div>'}
      <div class="msg-body">
        <div class="msg-header">
          <span class="author">${escapeHtml(author)}</span>
          <span class="author-id">ID: ${escapeHtml(authorId)}</span>
          <span class="timestamp">${time}</span>
        </div>
        ${content ? `<div class="content">${content}</div>` : ''}
        ${attachments ? `<div class="attachments">${attachments}</div>` : ''}
        ${embeds}
      </div>
    </div>`;
  }).filter(Boolean).join('\n');

  const guildName = meta?.guildName ?? 'Serveur';
  const openedAt = meta?.openedAt ?? '—';
  const closedAt = meta?.closedAt ?? '—';
  const closedBy = meta?.closedBy ?? '—';
  const closeReasonBlock = meta?.closeReason
    ? `<span class="meta-item">Motif : <strong>${escapeHtml(meta.closeReason)}</strong></span>`
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
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; }
  .header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 20px 24px; display: flex; align-items: center; gap: 16px; }
  .header-icon { width: 48px; height: 48px; background: var(--accent-bg); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; }
  .header-info h1 { font-size: 18px; font-weight: 700; margin: 0; }
  .header-info p { color: var(--text-muted); font-size: 13px; margin: 4px 0 0 0; }
  .meta-bar { background: var(--surface2); border-bottom: 1px solid var(--border); padding: 10px 24px; display: flex; flex-wrap: wrap; gap: 20px; font-size: 12px; color: var(--text-muted); }
  .meta-item { display: flex; align-items: center; gap: 4px; }
  .meta-bar strong { color: var(--text); }
  .messages { max-width: 900px; margin: 0 auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 8px; }
  .msg { display: flex; gap: 12px; padding: 12px; border-radius: 8px; background: var(--surface); }
  .msg:hover { background: var(--surface2); }
  .msg.bot-msg .author { color: var(--accent); }
  .avatar { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; }
  .avatar.placeholder { background: var(--surface2); }
  .msg-body { flex: 1; min-width: 0; }
  .msg-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap; }
  .author { font-weight: 600; font-size: 14px; }
  .author-id { font-size: 11px; color: var(--text-muted); font-family: monospace; }
  .timestamp { font-size: 11px; color: var(--text-muted); margin-left: auto; }
  .content { font-size: 14px; line-height: 1.5; word-break: break-word; white-space: pre-wrap; }
  .mention { background: rgba(88,101,242,0.2); color: #a8b4f8; padding: 0 4px; border-radius: 3px; }
  .attachments { margin-top: 8px; }
  .attachment { display: inline-block; font-size: 13px; color: var(--accent); text-decoration: none; margin-right: 12px; }
  .attachment:hover { text-decoration: underline; }
  .embed { margin-top: 8px; background: var(--surface2); border-left: 3px solid var(--accent); padding: 10px 14px; border-radius: 0 6px 6px 0; }
  .embed-title { font-weight: 700; font-size: 13px; color: var(--accent); margin-bottom: 4px; }
  .embed-desc { font-size: 13px; color: var(--text-muted); margin-bottom: 6px; }
  .embed-field { font-size: 13px; margin-bottom: 4px; }
  .footer { text-align: center; padding: 24px; color: var(--text-muted); font-size: 12px; border-top: 1px solid var(--border); margin-top: 24px; }
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
  <span class="meta-item">Ouvert le <strong>${escapeHtml(openedAt)}</strong></span>
  <span class="meta-item">Fermé le <strong>${escapeHtml(closedAt)}</strong></span>
  <span class="meta-item">Fermé par <strong>${escapeHtml(closedBy)}</strong></span>
  ${closeReasonBlock}
</div>
<div class="messages">
${messageBlocks}
</div>
<div class="footer">Transcription générée par Pinguin Boat · ${new Date().toLocaleString('fr-FR')}</div>
</body>
</html>`;
}
