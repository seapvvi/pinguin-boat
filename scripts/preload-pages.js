const http = require('http');

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

// Pages principales à précharger
const pagesToPreload = [
  '/',
  '/dashboard',
  '/dashboard/servers',
  '/dashboard/owner',
  '/dashboard/owner/servers',
  '/dashboard/owner/users',
  '/dashboard/owner/metrics',
  '/dashboard/docs',
];

async function waitForServer(url, maxAttempts = 30, interval = 1000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log('✅ Serveur prêt');
        return true;
      }
    } catch (error) {
      console.log(`⏳ Attente du serveur... (${i + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  throw new Error('Le serveur n\'a pas démarré à temps');
}

async function preloadPage(url) {
  try {
    const startTime = Date.now();
    const response = await fetch(url);
    const duration = Date.now() - startTime;
    
    if (response.ok) {
      console.log(`✅ Préchargé: ${url} (${duration}ms)`);
      return true;
    } else {
      console.log(`⚠️  Erreur: ${url} (Status: ${response.status})`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Erreur: ${url} (${error.message})`);
    return false;
  }
}

async function main() {
  console.log('🚀 Démarrage du préchargement des pages...');
  
  try {
    // Attendre que le serveur soit prêt
    await waitForServer(BASE_URL);
    
    console.log('📄 Préchargement des pages...');
    
    // Précharger toutes les pages
    const results = await Promise.all(
      pagesToPreload.map(page => preloadPage(`${BASE_URL}${page}`))
    );
    
    const successCount = results.filter(r => r).length;
    console.log(`\n✨ Préchargement terminé: ${successCount}/${pagesToPreload.length} pages chargées`);
    
  } catch (error) {
    console.error('❌ Erreur lors du préchargement:', error.message);
    process.exit(1);
  }
}

main();