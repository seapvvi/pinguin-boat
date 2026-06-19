import { prisma } from '@pinguin/db';

export function startSessionCleanup(): void {
  const cleanup = async () => {
    try {
      const { count } = await prisma.session.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      if (count > 0) {
        console.log(`[CLEANUP] ${count} session(s) expirée(s) supprimée(s)`);
      }
    } catch (err) {
      console.error('[CLEANUP] Erreur lors du nettoyage des sessions:', err);
    }
  };

  cleanup();
  setInterval(cleanup, 60 * 60 * 1000);
}
