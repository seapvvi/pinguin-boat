import { execSync } from 'child_process';
import { PrismaClient } from '@pinguin/db';

const prisma = new PrismaClient();
const deploymentId = process.argv[2];

if (!deploymentId) {
  console.error('Usage: tsx deploy-worker.ts <deploymentId>');
  process.exit(1);
}

async function main() {
  const repoDir = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).toString().trim();
  const branch = process.env.DEPLOY_BRANCH || execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoDir, encoding: 'utf8' }).toString().trim();

  const logs: string[] = [];
  const addLog = async (msg: string) => {
    logs.push(`[${new Date().toISOString()}] ${msg}`);
    await prisma.deployment.update({ where: { id: deploymentId }, data: { log: logs.join('\n') } });
  };

  const exec = (cmd: string) => {
    try {
      execSync(cmd, { cwd: repoDir, encoding: 'utf8', timeout: 600000 });
    } catch (err: any) {
      const details = (err.stderr || err.stdout || err.message || 'Erreur inconnue').toString().trim().split('\n').slice(-10).join('\n');
      throw new Error(details);
    }
  };

  const execWithOutput = (cmd: string): string => {
    try {
      return execSync(cmd, { cwd: repoDir, encoding: 'utf8', timeout: 600000 }).toString().trim();
    } catch (err: any) {
      const details = (err.stderr || err.stdout || err.message || 'Erreur inconnue').toString().trim().split('\n').slice(-10).join('\n');
      throw new Error(details);
    }
  };

  try {
    await addLog('Mise à jour démarrée');

    await addLog('Récupération du code depuis GitHub...');

    let remoteUrl = '';
    const token = process.env.GITHUB_TOKEN;
    if (token) {
      remoteUrl = execWithOutput('git remote get-url origin');
      const authedUrl = remoteUrl.replace('https://', `https://x-access-token:${token}@`);
      exec(`git remote set-url origin ${authedUrl}`);
    }

    exec(`git fetch origin ${branch}`);
    exec(`git reset --hard origin/${branch}`);

    if (token && remoteUrl) {
      exec(`git remote set-url origin ${remoteUrl}`);
    }

    await addLog('Code mis à jour');

    await addLog('Installation des dépendances...');
    exec('pnpm install --no-frozen-lockfile');
    await addLog('Dépendances installées');

    await addLog('Génération Prisma...');
    exec('pnpm db:generate');
    await addLog('Prisma généré');

    await addLog('Build du projet...');
    exec('pnpm build');
    await addLog('Build terminé');

    await addLog('Migration de la base de données...');
    exec('pnpm db:migrate:prod');
    await addLog('Migrations appliquées');

    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: 'SUCCESS', completedAt: new Date(), log: logs.join('\n') },
    });

    await addLog('Mise à jour terminée ! Redémarre le serveur (pnpm dev) pour appliquer les changements.');
  } catch (err: any) {
    await addLog(`ERREUR: ${err.message || 'Erreur inconnue'}`);

    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: 'FAILED', completedAt: new Date(), log: logs.join('\n') },
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Worker failed:', err);
  process.exit(1);
});
