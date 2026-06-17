/**
 * Worker de déploiement — processus détaché.
 * Reçoit un deploymentId en argument et exécute le pipeline complet.
 *
 * Garde-fous :
 * - Ne modifie jamais le repo courant (clone frais)
 * - Le token GitHub n'est jamais dans l'URL git persistante
 * - Toute erreur stoppe le pipeline et nettoie la release partielle
 * - Les logs sont sanitizés (token masqué)
 */

import { prisma, DeployEnvironment } from '@pinguin/db';
import { runDeploymentPipeline } from './deploy';

const deploymentId = process.argv[2];

if (!deploymentId) {
  console.error('Usage: tsx deploy-worker.ts <deploymentId>');
  process.exit(1);
}

async function main() {
  const envStr = (process.env.DEPLOY_ENV || 'DEVELOPMENT').toUpperCase();
  const environment = envStr as keyof typeof DeployEnvironment;
  const deployEnv = DeployEnvironment[environment] || DeployEnvironment.DEVELOPMENT;

  const deployment = await prisma.deployment.findUnique({ where: { id: deploymentId } });
  if (!deployment) {
    console.error(`Deployment ${deploymentId} introuvable`);
    process.exit(1);
  }

  await runDeploymentPipeline(deploymentId, deployEnv);
}

main().catch((err) => {
  console.error('Worker failed:', err);
  process.exit(1);
});
