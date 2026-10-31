const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Démarrage du serveur de développement avec préchargement...');

// Lancer turbo directement — PAS « pnpm dev », sinon ce script s'appelle lui-même en boucle.
const devProcess = spawn('turbo', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true,
  cwd: path.join(__dirname, '..'),
});

// Laisser le temps à Next de compiler avant de préchauffer les routes.
const STARTUP_DELAY = 8000;

setTimeout(() => {
  console.log('⏳ Lancement du préchargement des pages...');
  const preloadProcess = spawn('node', ['scripts/preload-pages.js'], {
    stdio: 'inherit',
    shell: true,
    cwd: path.join(__dirname, '..'),
  });

  preloadProcess.on('close', (code) => {
    if (code === 0) {
      console.log('✨ Préchargement terminé — les pages sont prêtes !');
    } else {
      console.log('⚠️  Préchargement partiel, mais le serveur continue de tourner');
    }
  });
}, STARTUP_DELAY);

devProcess.on('close', (code) => {
  process.exit(code ?? 0);
});
