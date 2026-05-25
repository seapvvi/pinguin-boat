import { getConfig } from '@pinguin/config';
import { prisma } from '@pinguin/db';
import { DeploymentStatus } from '@pinguin/db';
import { randomUUID } from 'crypto';
import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const config = getConfig();

function maskSecrets(str: string): string {
  if (config.GITHUB_TOKEN) {
    str = str.replace(new RegExp(config.GITHUB_TOKEN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '***TOKEN***');
  }
  return str;
}

let repoDir: string;
try {
  repoDir = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).toString().trim();
} catch {
  repoDir = process.cwd();
}

interface DeployStatus {
  running: boolean;
  currentVersion: string | null;
  status: DeploymentStatus | null;
  lastDeployment: Date | null;
}

async function runDeploymentInline(deploymentId: string) {
  const logs: string[] = [];
  const addLog = async (msg: string) => {
    logs.push(`[${new Date().toISOString()}] ${msg}`);
    await prisma.deployment.update({ where: { id: deploymentId }, data: { log: logs.join('\n') } });
  };

  const exec = (cmd: string) => {
    try {
      execSync(cmd, { cwd: repoDir, encoding: 'utf8', timeout: 600000 });
    } catch (err: any) {
      const raw = (err.stderr || err.stdout || err.message || 'Erreur inconnue').toString().trim();
      const details = maskSecrets(raw).split('\n').slice(-10).join('\n');
      throw new Error(details);
    }
  };

  const execWithOutput = (cmd: string): string => {
    try {
      return execSync(cmd, { cwd: repoDir, encoding: 'utf8', timeout: 600000 }).toString().trim();
    } catch (err: any) {
      const raw = (err.stderr || err.stdout || err.message || 'Erreur inconnue').toString().trim();
      const details = maskSecrets(raw).split('\n').slice(-10).join('\n');
      throw new Error(details);
    }
  };

  try {
    await addLog('Mise à jour démarrée');
    await addLog('Récupération du code depuis GitHub...');
    const branch = config.GITHUB_BRANCH || execWithOutput('git rev-parse --abbrev-ref HEAD');

    let remoteUrl = '';
    if (config.GITHUB_TOKEN) {
      remoteUrl = execWithOutput('git remote get-url origin');
      if (remoteUrl.startsWith('https://')) {
        const authedUrl = remoteUrl.replace('https://', `https://x-access-token:${config.GITHUB_TOKEN}@`);
        exec(`git remote set-url origin ${authedUrl}`);
      } else {
        await addLog('URL GitHub non HTTPS détectée, le token ne sera pas injecté automatiquement.');
      }
    }

    exec(`git fetch origin ${branch}`);
    exec(`git reset --hard origin/${branch}`);

    if (config.GITHUB_TOKEN && remoteUrl.startsWith('https://')) {
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
      data: { status: DeploymentStatus.SUCCESS, completedAt: new Date(), log: logs.join('\n') },
    });
    await addLog('Mise à jour terminée ! Redémarre le serveur (pnpm dev) pour appliquer les changements.');
  } catch (err: any) {
    await addLog(`ERREUR: ${err.message || 'Erreur inconnue'}`);
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: DeploymentStatus.FAILED, completedAt: new Date(), log: logs.join('\n') },
    });
  }
}

async function runDeploymentWorker(deploymentId: string) {
  const workerTsPath = path.resolve(__dirname, 'deploy-worker.ts');
  const workerJsPath = path.resolve(__dirname, 'deploy-worker.js');

  if (fs.existsSync(workerJsPath)) {
    const child = spawn(process.execPath, [workerJsPath, deploymentId], {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        DEPLOY_BRANCH: config.GITHUB_BRANCH || undefined,
        GITHUB_TOKEN: config.GITHUB_TOKEN || undefined,
      },
    });
    child.unref();
    return;
  }

  if (fs.existsSync(workerTsPath)) {
    try {
      const tsxPath = require.resolve('tsx');
      const child = spawn(process.execPath, ['--import', tsxPath, workerTsPath, deploymentId], {
        detached: true,
        stdio: 'ignore',
        env: {
          ...process.env,
          DEPLOY_BRANCH: config.GITHUB_BRANCH || undefined,
          GITHUB_TOKEN: config.GITHUB_TOKEN || undefined,
        },
      });
      child.unref();
      return;
    } catch {
      // fallback to inline if tsx is not available
    }
  }

  return runDeploymentInline(deploymentId);
}

export async function startDeployment(triggeredById: string): Promise<{ id: string; version: string }> {
  const existing = await prisma.deployment.findFirst({ where: { status: DeploymentStatus.RUNNING } });
  if (existing) {
    throw new Error(`Un déploiement est déjà en cours (${existing.version})`);
  }

  const version = `v${Date.now()}`;

  const deployment = await prisma.deployment.create({
    data: {
      id: randomUUID(),
      version,
      releasePath: repoDir,
      status: DeploymentStatus.RUNNING,
      triggeredById,
      startedAt: new Date(),
      log: '',
    },
  });

  runDeploymentWorker(deployment.id).catch((err) => {
    console.error('Deploy worker launch failed:', err);
  });

  return { id: deployment.id, version };
}

export async function rollback(triggeredById: string, targetVersion?: string): Promise<void> {
  const lastSuccess = await prisma.deployment.findFirst({
    where: { status: DeploymentStatus.SUCCESS },
    orderBy: { completedAt: 'desc' },
  });

  if (!lastSuccess) {
    throw new Error('Aucune version précédente réussie pour rollback');
  }

  await prisma.deployment.create({
    data: {
      id: randomUUID(),
      version: `rollback-to-${lastSuccess.version}`,
      releasePath: lastSuccess.releasePath,
      status: DeploymentStatus.ROLLED_BACK,
      triggeredById,
      startedAt: new Date(),
      completedAt: new Date(),
      log: `Rollback vers ${lastSuccess.version} effectu\u00e9. Red\u00e9marre le serveur (pnpm dev) pour appliquer.`,
    },
  });
}

export async function getDeployStatus(): Promise<DeployStatus> {
  const activeDeployment = await prisma.deployment.findFirst({
    where: { status: DeploymentStatus.RUNNING },
    orderBy: { startedAt: 'desc' },
  });

  const lastDeployment = await prisma.deployment.findFirst({
    where: { status: { not: DeploymentStatus.PENDING } },
    orderBy: { startedAt: 'desc' },
  });

  return {
    running: !!activeDeployment,
    currentVersion: lastDeployment?.version || null,
    status: lastDeployment?.status || null,
    lastDeployment: lastDeployment?.startedAt || null,
  };
}

export async function getDeployHistory(page: number = 1, limit: number = 20) {
  const [deployments, total] = await Promise.all([
    prisma.deployment.findMany({
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.deployment.count(),
  ]);

  return { deployments, total };
}
