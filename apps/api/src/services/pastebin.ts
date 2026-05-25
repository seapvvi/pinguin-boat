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
    formData.set('api_paste_format', 'html5');
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

export function generateTicketTranscriptHtml(messages: any[], ticketSubject: string): string {
  const lines = messages.reverse().map((m: any) => {
    const time = m.timestamp ? new Date(m.timestamp).toLocaleString('fr-FR') : '';
    const author = m.author?.username ?? 'Inconnu';
    const avatar = m.author?.avatar
      ? `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}.png?size=24`
      : '';
    const content = m.content ? escapeHtml(m.content) : '';
    const attachments = (m.attachments ?? []).map((a: any) =>
      `<br><img src="${escapeHtml(a.url)}" style="max-width:300px;border-radius:4px;" />`
    ).join('');
    const embeds = (m.embeds ?? []).map((e: any) =>
      `<div class="embed">${e.title ? `<b>${escapeHtml(e.title)}</b>` : ''}${e.description ? `<br>${escapeHtml(e.description)}` : ''}</div>`
    ).join('');
    return `<div class="msg">
      <img src="${avatar}" class="avatar" />
      <div><span class="author">${escapeHtml(author)}</span> <span class="time">${time}</span>
      <div class="content">${content}${attachments}${embeds}</div></div>
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Ticket: ${escapeHtml(ticketSubject)}</title>
<style>
body{font-family:sans-serif;background:#1a1a2e;color:#eee;padding:20px;max-width:800px;margin:auto}
h1{color:#14b8a6;border-bottom:1px solid #333;padding-bottom:10px}
.msg{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #222}
.avatar{width:32px;height:32px;border-radius:50%;flex-shrink:0}
.author{font-weight:bold;color:#14b8a6}
.time{color:#888;font-size:0.8em}
.content{margin-top:4px;line-height:1.5}
.embed{background:#222;border-left:3px solid #14b8a6;padding:8px;margin:4px 0;border-radius:4px;font-size:0.9em}
</style></head>
<body>
<h1>🎫 Ticket: ${escapeHtml(ticketSubject)}</h1>
<p>${lines.length} message(s)</p>
${lines}
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
