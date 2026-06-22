import { prisma } from '@pinguin/db';

export function startTicketCleanup(): void {
  const cleanup = async () => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const { count } = await prisma.ticket.deleteMany({
        where: {
          status: 'DELETED',
          updatedAt: { lt: thirtyDaysAgo },
        },
      });
      if (count > 0) {
        console.log(`[CLEANUP] ${count} ticket(s) DELETED supprimé(s) (plus de 30 jours)`);
      }
    } catch (err) {
      console.error('[CLEANUP] Erreur lors du nettoyage des tickets:', err);
    }
  };

  cleanup();
  setInterval(cleanup, 6 * 60 * 60 * 1000);
}
