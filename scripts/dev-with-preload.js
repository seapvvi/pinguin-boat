const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Démarrage du serveur de développement avec préchargement...');

// Lancer turbo run dev
const devProcess = spawn('pnpm', ['dev'], {
  stdio: 'inherit',
  shell: true
});

// Attendre un peu que le serveur démarre
const STARTUP_DELAY = 8000; // 8 secondes pour laisser le temps au serveur de démarrer

setTimeout(() => {
  console.log('⏳ Lancement du préchargement des pages...');
  const preloadProcess = spawn('node', ['scripts/preload-pages.js'], {
    stdio: 'inherit',
    shell: true,
    cwd: path.join(__dirname, '..')
  });
  
  preloadProcess.on('close', (code) => {
    if (code === 0) {
      console.log('✨ Préchargement terminé avec succès - Les pages sont prêtes !');
    } else {
      console.log('⚠️  Le préchargement a rencontré des erreurs, mais le serveur continue de tourner');
    }
  });
}, STARTUP_DELAY);

devProcess.on('close', (code) => {
  console.log(`Serveur de développement arrêté (code: ${code})`);
  process.exit(code);
});