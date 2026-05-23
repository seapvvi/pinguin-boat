import { getConfig } from '@pinguin/config';
import { prisma } from '@pinguin/db';
import { DeploymentStatus } from '@pinguin/db';
import simpleGit from 'simple-git';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const config = getConfig();

interface DeployStatus {
  running: boolean;
  currentVersion: string | null;
  status: DeploymentStatus | null;
  lastDeployment: Date | null;
}

async function updateDeploymentLog(deploymentId: string, logs: string[]) {
  await prisma.deployment.update({
    where: { id: deploymentId },
    data: { log: logs.join('\n') },
  });
}

async function runDeployment(
  deploymentId: string,
  triggeredById: string,
  version: string,
  releaseDir: string,
) {
  const logs: string[] = [];

  const addLog = async (msg: string) => {
    logs.push(`[${new Date().toISOString()}] ${msg}`);
    await updateDeploymentLog(deploymentId, logs);
  };

  try {
    await addLog(`Déploiement ${version} démarré`);

    await addLog('📥 Téléchargement depuis GitHub...');
    if (!config.GITHUB_REPO) {
      throw new Error('GITHUB_REPO non configuré dans .env');
    }
    const cloneUrl = config.GITHUB_TOKEN
      ? `https://x-access-token:${config.GITHUB_TOKEN}@github.com/${config.GITHUB_REPO}.git`
      : `https://github.com/${config.GITHUB_REPO}.git`;
    await simpleGit().clone(cloneUrl, releaseDir, [
      '--branch', config.GITHUB_BRANCH,
      '--single-branch',
      '--depth', '1',
    ]);
    await addLog('✅ Code source téléchargé');

    const sharedDir = config.DEPLOY_SHARED_PATH;
    const sharedPaths = ['node_modules', '.env', 'prisma'];
    for (const p of sharedPaths) {
      const src = path.join(sharedDir, p);
      const dest = path.join(releaseDir, p);
      if (fs.existsSync(src)) {
        fs.symlinkSync(src, dest, 'junction');
        await addLog(`🔗 Fichier partagé lié: ${p}`);
      } else {
        await addLog(`⚠️ Fichier partagé introuvable: ${p} (ignoré)`);
      }
    }

    await addLog('📦 Installation des dépendances...');
    execSync('pnpm install --frozen-lockfile --prod', {
      cwd: releaseDir,
      stdio: 'pipe',
    });
    await addLog('✅ Dépendances installées');

    await addLog('🔨 Build du projet...');
    execSync('pnpm build', { cwd: releaseDir, stdio: 'pipe' });
    await addLog('✅ Build terminé');

    await addLog('🗄️ Génération Prisma...');
    execSync('pnpm db:generate', {
      cwd: releaseDir,
      stdio: 'pipe',
    });
    await addLog('✅ Prisma généré');

    await addLog('🔄 Migration de la base de données...');
    execSync('pnpm db:migrate', {
      cwd: releaseDir,
      stdio: 'pipe',
    });
    await addLog('✅ Migrations appliquées');

    const healthUrl = config.API_URL.replace(/\/$/, '') + '/api/health';
    await addLog('🔍 Vérification de santé...');
    let healthy = false;
    for (let i = 0; i < 10; i++) {
      try {
        const res = await fetch(healthUrl);
        if (res.ok) {
          healthy = true;
          break;
        }
      } catch {
        // retry
      }
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (!healthy) {
      throw new Error('La vérification de santé a échoué');
    }
    await addLog('✅ Vérification de santé réussie');

    const currentLink = config.DEPLOY_CURRENT_LINK;
    if (fs.existsSync(currentLink)) {
      const oldTarget = fs.readlinkSync(currentLink);
      await prisma.deploymentRelease.create({
        data: {
          id: randomUUID(),
          version: `rollback-${version}`,
          releasePath: oldTarget,
          status: DeploymentStatus.ROLLED_BACK,
          deploymentId,
          createdAt: new Date(),
        },
      });
      await addLog(`💾 Ancienne version sauvegardée: ${oldTarget}`);
    }

    const tmpLink = currentLink + '.tmp';
    if (fs.existsSync(tmpLink)) {
      fs.unlinkSync(tmpLink);
    }
    fs.symlinkSync(releaseDir, tmpLink, 'junction');
    fs.renameSync(tmpLink, currentLink);
    await addLog('✅ Lien symbolique mis à jour');

    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: DeploymentStatus.SUCCESS,
        completedAt: new Date(),
        log: logs.join('\n'),
      },
    });
  } catch (err: any) {
    await addLog(`❌ ERREUR: ${err.message || 'Erreur inconnue'}`);

    if (fs.existsSync(releaseDir)) {
      fs.rmSync(releaseDir, { recursive: true, force: true });
      await addLog('🧹 Dossier de release nettoyé');
    }

    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: DeploymentStatus.FAILED,
        completedAt: new Date(),
        log: logs.join('\n'),
      },
    });
  }
}

export async function startDeployment(
  triggeredById: string
): Promise<{ id: string; version: string }> {
  const version = `v${Date.now()}`;
  const releaseDir = path.join(config.DEPLOY_RELEASES_PATH, version);

  const deployment = await prisma.deployment.create({
    data: {
      id: randomUUID(),
      version,
      releasePath: releaseDir,
      status: DeploymentStatus.RUNNING,
      triggeredById,
      startedAt: new Date(),
      log: '',
    },
  });

  runDeployment(deployment.id, triggeredById, version, releaseDir);

  return { id: deployment.id, version };
}

export async function rollback(
  triggeredById: string,
  targetVersion?: string
): Promise<void> {
  const releasesDir = config.DEPLOY_RELEASES_PATH;
  const currentLink = config.DEPLOY_CURRENT_LINK;

  if (!fs.existsSync(releasesDir)) {
    throw new Error('Aucune release disponible');
  }

  const releases = fs
    .readdirSync(releasesDir)
    .filter((d) => d.startsWith('v'))
    .sort()
    .reverse();

  if (releases.length < 2) {
    throw new Error('Pas assez de versions pour effectuer un rollback');
  }

  const target = targetVersion || releases[1];
  const targetPath = path.join(releasesDir, target);

  if (!fs.existsSync(targetPath)) {
    throw new Error(`Version ${target} introuvable`);
  }

  const tmpLink = currentLink + '.tmp';
  if (fs.existsSync(tmpLink)) {
    fs.unlinkSync(tmpLink);
  }
  fs.symlinkSync(targetPath, tmpLink, 'junction');
  fs.renameSync(tmpLink, currentLink);

  await prisma.deployment.create({
    data: {
      id: randomUUID(),
      version: `rollback-to-${target}`,
      releasePath: targetPath,
      status: DeploymentStatus.ROLLED_BACK,
      triggeredById,
      startedAt: new Date(),
      completedAt: new Date(),
      log: `Rollback vers ${target} effectué`,
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

export async function getDeployHistory(
  page: number = 1,
  limit: number = 20
) {
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

export async function getReleases() {
  const releasesDir = config.DEPLOY_RELEASES_PATH;

  if (!fs.existsSync(releasesDir)) {
    return [];
  }

  const dirs = fs.readdirSync(releasesDir).filter((d) => d.startsWith('v'));
  const currentLink = config.DEPLOY_CURRENT_LINK;
  let currentTarget: string | null = null;

  try {
    currentTarget = fs.readlinkSync(currentLink);
  } catch {
    // no current link
  }

  return dirs
    .map((dir) => {
      const fullPath = path.join(releasesDir, dir);
      const stat = fs.statSync(fullPath);
      return {
        version: dir,
        path: fullPath,
        createdAt: stat.birthtime,
        isCurrent: currentTarget === fullPath,
      };
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
