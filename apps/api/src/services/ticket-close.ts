import { prisma } from '@pinguin/db';
import { getChannelMessages, sendDM, sendChannelMessage } from './discord';
import { uploadToPastebin, generateTicketTranscriptHtml } from './pastebin';

export async function closeTicketWithTranscript(
  ticketId: string,
  closedById: string,
  options?: { guildName?: string }
): Promise<{ transcriptUrl: string | null }> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new Error('Ticket introuvable');

  const guild = await prisma.guild.findUnique({ where: { id: ticket.guildId } });
  const guildName = options?.guildName ?? guild?.name ?? 'Serveur';

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: 'CLOSED', closedAt: new Date(), closedById },
  });

  let transcriptUrl: string | null = null;
  if (ticket.channelId && !ticket.channelId.startsWith('pending-')) {
    try {
      const messages = await getChannelMessages(ticket.channelId, 100);
      const html = generateTicketTranscriptHtml(messages, ticket.subject);
      transcriptUrl = await uploadToPastebin(html, `Ticket: ${ticket.subject}`);
    } catch {
      transcriptUrl = null;
    }

    try {
      const transcriptLine = transcriptUrl
        ? `\n📄 [Voir la transcription HTML](${transcriptUrl})`
        : '\n_La transcription n\'a pas pu être générée (vérifiez PASTEBIN_API_KEY)._';
      await sendDM(ticket.creatorId, {
        embeds: [{
          title: '🎫 Ticket fermé',
          description:
            `Ton ticket **${ticket.subject}** sur le serveur **${guildName}** a été fermé.${transcriptLine}`,
          color: 0x14B8A6,
          timestamp: new Date().toISOString(),
        }],
      });
    } catch {}

    if (transcriptUrl) {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { transcriptId: transcriptUrl },
      }).catch(() => {});
    }

    await sendChannelMessage(ticket.channelId, {
      embeds: [{
        title: 'Ticket fermé',
        description:
          `Ce ticket a été fermé par <@${closedById}> sur **${guildName}**.` +
          (transcriptUrl ? `\n📄 [Transcription](${transcriptUrl})` : ''),
        color: 0xFF0000,
        timestamp: new Date().toISOString(),
      }],
    }).catch(() => {});
  }

  return { transcriptUrl };
}
