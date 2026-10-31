/**
 * Préchauffe les routes Next.js après le démarrage du dev server :
 * chaque page est compilée à la demande par Next — ce script les visite
 * toutes une première fois pour éliminer le « cold start » à la navigation.
 *
 * Détecte automatiquement le port (3000, 3001, 3002) au cas où Next
 * bascule sur un port libre. Override possible via PORT=xxxx.
 */

const candidatePorts = [...new Set([process.env.PORT, '3000', '3001', '3002'])].map(String);

// Routes réelles de l'app (le groupe (dashboard) n'apparaît pas dans l'URL)
const pagesToPreload = [
  '/',
  '/servers',
  '/dashboard',
  '/owner',
  '/stats',
  '/docs',
  '/soutien',
  '/auth/login',
];

async function probePort(port) {
  try {
    const res = await fetch(`http://localhost:${port}/`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function findBaseUrl(maxAttempts = 30, interval = 1000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    for (const port of candidatePorts) {
      if (await probePort(port)) {
        console.log(`✅ Serveur détecté sur le port ${port}`);
        return `http://localhost:${port}`;
      }
    }
    console.log(`⏳ Attente du serveur... (${attempt}/${maxAttempts})`);
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error("Le serveur n'a pas démarré à temps");
}

async function preloadPage(url) {
  try {
    const start = Date.now();
    const res = await fetch(url);
    const duration = Date.now() - start;
    console.log(`${res.ok ? '✅' : '⚠️ '} ${url} (${res.status}, ${duration}ms)`);
    return res.ok;
  } catch (error) {
    console.log(`❌ ${url} (${error.message})`);
    return false;
  }
}

async function main() {
  console.log('🚀 Préchargement des pages...');

  try {
    const baseUrl = await findBaseUrl();

    const results = await Promise.all(
      pagesToPreload.map((page) => preloadPage(`${baseUrl}${page}`))
    );

    const ok = results.filter(Boolean).length;
    console.log(`\n✨ ${ok}/${pagesToPreload.length} pages préchauffées — navigation instantanée`);
  } catch (error) {
    console.error('❌ Préchargement impossible:', error.message);
    // Ne pas faire échouer le dev server pour autant
    process.exit(0);
  }
}

main();
