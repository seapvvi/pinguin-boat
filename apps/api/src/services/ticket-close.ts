import { prisma } from '@pinguin/db';
import {
  getChannelMessages, sendDM, sendChannelMessage,
  sendDMWithFile, sendChannelMessageWithFile,
} from './discord';
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
    let transcriptHtml: string | null = null;
    try {
      const messages = await getChannelMessages(ticket.channelId, 100);
      transcriptHtml = generateTicketTranscriptHtml(messages, ticket.subject, {
        guildName,
        openedAt: ticket.createdAt ? new Date(ticket.createdAt).toLocaleString('fr-FR') : '—',
        closedAt: new Date().toLocaleString('fr-FR'),
        closedBy: closedById,
        closeReason: undefined,
      });
      // Pastebin is optional. If no API key is configured (or it fails) we
      // still deliver the transcript as an attached HTML file below.
      transcriptUrl = await uploadToPastebin(transcriptHtml, `Ticket: ${ticket.subject}`);
    } catch {
      transcriptUrl = null;
    }

    const fileName = `transcript-${ticket.subject}`.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 80) + '.html';
    const transcriptFile = transcriptHtml
      ? { name: fileName, content: transcriptHtml, contentType: 'text/html' }
      : null;

    const transcriptLine = transcriptUrl
      ? `\n📄 [Voir la transcription HTML](${transcriptUrl})`
      : transcriptFile
        ? '\n📄 La transcription est jointe à ce message (fichier HTML).'
        : '\n_La transcription n\'a pas pu être générée._';

    try {
      const dmPayload = {
        embeds: [{
          title: '🎫 Ticket fermé',
          description:
            `Ton ticket **${ticket.subject}** sur le serveur **${guildName}** a été fermé.${transcriptLine}`,
          color: 0x14B8A6,
          timestamp: new Date().toISOString(),
        }],
      };
      if (!transcriptUrl && transcriptFile) {
        await sendDMWithFile(ticket.creatorId, dmPayload, transcriptFile);
      } else {
        await sendDM(ticket.creatorId, dmPayload);
      }
    } catch {}

    if (transcriptUrl) {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: { transcriptId: transcriptUrl },
      }).catch(() => {});
    }

    const channelPayload = {
      embeds: [{
        title: 'Ticket fermé',
        description:
          `Ce ticket a été fermé par <@${closedById}> sur **${guildName}**.` +
          (transcriptUrl
            ? `\n📄 [Transcription](${transcriptUrl})`
            : transcriptFile
              ? '\n📄 Transcription jointe (fichier HTML).'
              : ''),
        color: 0xFF0000,
        timestamp: new Date().toISOString(),
      }],
    };
    if (!transcriptUrl && transcriptFile) {
      await sendChannelMessageWithFile(ticket.channelId, channelPayload, transcriptFile).catch(() => {});
    } else {
      await sendChannelMessage(ticket.channelId, channelPayload).catch(() => {});
    }
  }

  return { transcriptUrl };
}
