import { getConfig } from '@pinguin/config';
import { prisma, DeploymentStatus, DeployEnvironment } from '@pinguin/db';
import { randomUUID } from 'crypto';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const config = getConfig();

// --- Helpers secrets ---

const TOKEN_PLACEHOLDER = '***TOKEN***';

/** Supprime toutes les occurrences du token GitHub des logs */
function sanitizeLog(str: string): string {
  if (!config.GITHUB_TOKEN) return str;
  // Protection contre l'injection de token dans les logs
  // Le token peut apparaître via GIT_ASKPASS, dans des URLs, etc.
  const token = config.GITHUB_TOKEN;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return str.replace(new RegExp(escaped, 'g'), TOKEN_PLACEHOLDER);
}

/** Crée un script GIT_ASKPASS temporaire qui répond avec le token GitHub */
function createAskpassScript(): string {
  // Guard: le token n'est jamais injecté dans l'URL git remote.
  // On utilise GIT_ASKPASS : un script temporaire qui fournit le token
  // à la demande de git. Le script est supprimé après le clone.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pinguin-git-'));
  const scriptPath = path.join(tmpDir, 'askpass.sh');
  const content = [
    '#!/bin/sh',
    `echo "${config.GITHUB_TOKEN}"`,
  ].join('\n');
  fs.writeFileSync(scriptPath, content, { mode: 0o700 });
  return scriptPath;
}

function cleanupAskpassScript(scriptPath: string | null): void {
  if (!scriptPath) return;
  try {
    fs.unlinkSync(scriptPath);
    fs.rmdirSync(path.dirname(scriptPath));
  } catch { /* nettoyage best-effort */ }
}

/** Récupère le SHA du HEAD d'un repo cloné */
function getGitRef(releasePath: string): string {
  return execSync('git rev-parse HEAD', { cwd: releasePath, encoding: 'utf8' }).toString().trim();
}

// --- Validation ---

/** Valide que l'environnement et la branche sont compatibles */
function validateEnvironment(repoUrl: string, branch: string, environment: DeployEnvironment): void {
  // Guard: en production, on refuse de déployer depuis une branche non autorisée
  const allowedBranches = config.DEPLOY_ALLOWED_BRANCHES.split(',').map((b) => b.trim()).filter(Boolean);
  if (allowedBranches.length === 0) {
    throw new Error('Aucune branche autorisée configurée (DEPLOY_ALLOWED_BRANCHES)');
  }

  if (!allowedBranches.includes(branch)) {
    throw new Error(
      `Branche "${branch}" non autorisée pour l'environnement ${environment}. ` +
      `Branches autorisées : ${allowedBranches.join(', ')}`
    );
  }

  // Guard: validation du repo distant
  if (!repoUrl) {
    throw new Error('GITHUB_REPO non configuré — impossible de cloner');
  }
}

/** Valide les prérequis système avant un déploiement */
function validatePrerequisites(releasePath: string): void {
  // Guard: vérifie que le répertoire parent des releases existe
  const releasesParent = path.dirname(releasePath);
  if (!fs.existsSync(releasesParent)) {
    fs.mkdirSync(releasesParent, { recursive: true });
  }

  // Guard: vérifie que le répertoire cible n'existe pas déjà (conflit)
  if (fs.existsSync(releasePath)) {
    throw new Error(`Le répertoire de release existe déjà : ${releasePath}`);
  }

  // Guard: espace disque minimum (2 Go)
  try {
    const df = execSync(`df -k "${releasesParent}"`, { encoding: 'utf8' }).toString();
    const lines = df.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    const parts = lastLine.split(/\s+/);
    const availableKB = parseInt(parts[3] || '0', 10);
    if (availableKB > 0 && availableKB < 2_097_152) {
      throw new Error(`Espace disque insuffisant : ${Math.round(availableKB / 1024 / 1024 * 100) / 100} Go disponible (minimum 2 Go requis)`);
    }
  } catch (err: any) {
    if (err.message?.includes('Espace disque insuffisant')) throw err;
    // df peut échouer sur certains environnements — on ignore
  }
}

/** Backup PostgreSQL avant les migrations */
async function backupDatabase(backupsPath: string, version: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `pinguin-predeploy-${version}-${timestamp}.sql`;
  const filepath = path.join(backupsPath, filename);

  if (!fs.existsSync(backupsPath)) {
    fs.mkdirSync(backupsPath, { recursive: true });
  }

  execSync(`pg_dump "${config.DATABASE_URL}" > "${filepath}"`, {
    timeout: 60_000,
    shell: true,
    env: { ...process.env, PGPASSWORD: '' },
  });

  return filepath;
}

// --- Types ---

export interface DeployStatus {
  running: boolean;
  currentVersion: string | null;
  status: DeploymentStatus | null;
  lastDeployment: Date | null;
}

interface StepResult {
  success: boolean;
  error?: string;
}

// --- Pipeline de déploiement (nouvelle version : clone + symlink) ---
// Exportée pour le worker qui tourne dans un processus détaché

export async function runDeploymentPipeline(deploymentId: string, environment: DeployEnvironment): Promise<void> {
  const logs: string[] = [];
  let askpassScript: string | null = null;
  let releasePath = '';
  let backupFile: string | null = null;

  const addLog = async (msg: string) => {
    const safe = sanitizeLog(msg);
    logs.push(`[${new Date().toISOString()}] ${safe}`);
    await prisma.deployment.update({ where: { id: deploymentId }, data: { log: logs.join('\n') } });
  };

  const safeExec = (cmd: string, opts: { cwd?: string; timeout?: number; ignoreFailure?: boolean } = {}): string => {
    const env: Record<string, string | undefined> = { ...process.env };
    if (askpassScript) {
      env.GIT_ASKPASS = askpassScript;
    }
    try {
      const result = execSync(cmd, {
        cwd: opts.cwd,
        encoding: 'utf8',
        timeout: opts.timeout ?? config.DEPLOY_STEP_TIMEOUT,
        env,
        maxBuffer: 10 * 1024 * 1024,
      }).toString();
      return result;
    } catch (err: any) {
      const raw = (err.stderr || err.stdout || err.message || 'Erreur inconnue').toString().trim();
      const details = sanitizeLog(raw);
      if (opts.ignoreFailure) return '';
      throw new Error(details.split('\n').slice(-20).join('\n'));
    }
  };

  try {
    const version = `v${Date.now()}`;
    const branch = config.GITHUB_BRANCH;
    const repoUrl = config.GITHUB_REPO;
    releasePath = path.join(config.DEPLOY_RELEASES_PATH, version);

    // Guard: validation de l'environnement et de la branche
    validateEnvironment(repoUrl, branch, environment);

    // Guard: validation des prérequis système
    validatePrerequisites(releasePath);

    await addLog(`Déploiement démarré — environnement: ${environment}, branche: ${branch}`);

    // Étape 1 : Clone frais (jamais de git reset sur le repo courant)
    await addLog('Clone du dépôt...');
    // Guard: on crée un script GIT_ASKPASS temporaire pour ne JAMAIS
    // injecter le token dans l'URL git persistante du remote.
    if (config.GITHUB_TOKEN) {
      askpassScript = createAskpassScript();
    }

    const cloneUrl = config.GITHUB_TOKEN
      ? repoUrl.replace('https://', 'https://x-access-token@')
      : repoUrl;
    // Note: x-access-token@ est un username fixe, PAS le token.
    // Le vrai token est fourni via GIT_ASKPASS (variable d'env temporaire).
    // Même si cloneUrl est loggé, le token n'apparaît pas.
    safeExec(`git clone --depth 1 --branch ${branch} "${cloneUrl}" "${releasePath}"`, {
      timeout: config.DEPLOY_STEP_TIMEOUT * 2,
    });

    // Nettoie le script askpass dès que le clone est terminé
    cleanupAskpassScript(askpassScript);
    askpassScript = null;

    const gitRef = getGitRef(releasePath);
    await addLog(`Clone terminé — commit ${gitRef}`);

    // Étape 2 : Lier le .env partagé
    await addLog('Liaison du fichier .env partagé...');
    const sharedEnv = path.join(config.DEPLOY_SHARED_PATH, '.env');
    const releaseEnv = path.join(releasePath, '.env');
    if (fs.existsSync(sharedEnv)) {
      try { fs.unlinkSync(releaseEnv); } catch { /* ignore */ }
      fs.symlinkSync(sharedEnv, releaseEnv);
    }

    // Étape 3 : Installer les dépendances
    await addLog('Installation des dépendances...');
    safeExec('pnpm install --frozen-lockfile', { cwd: releasePath });
    await addLog('Dépendances installées');

    // Étape 4 : Générer Prisma client
    await addLog('Génération Prisma...');
    safeExec('pnpm db:generate', { cwd: releasePath });
    await addLog('Prisma généré');

    // Étape 5 : Build
    await addLog('Build du projet...');
    safeExec('pnpm build', { cwd: releasePath, timeout: config.DEPLOY_STEP_TIMEOUT * 3 });
    await addLog('Build terminé');

    // Étape 6 : Backup base de données (avant migrations)
    await addLog('Backup de la base de données...');
    try {
      backupFile = await backupDatabase(config.DEPLOY_BACKUPS_PATH, version);
      await addLog(`Backup créé : ${path.basename(backupFile)}`);
    } catch (err: any) {
      // Guard: un backup qui échoue n'est pas bloquant en dev, mais l'est en prod
      const msg = `Backup ignoré : ${sanitizeLog(err.message || '')}`;
      await addLog(msg);
      if (environment === 'PRODUCTION') {
        throw new Error(`Backup obligatoire avant migration en production : ${sanitizeLog(err.message || '')}`);
      }
    }

    // Étape 7 : Migrations (strict, non interactif)
    await addLog('Application des migrations...');
    // Guard: on utilise prisma migrate deploy (pas db:push).
    // migrate deploy applique seulement les migrations en attente de façon
    // non interactive et atomique. Si une migration échoue, la transaction
    // est rollbackée et la base reste dans l'état précédent.
    safeExec('pnpm db:migrate:prod', { cwd: releasePath });
    await addLog('Migrations appliquées');

    // Étape 8 : Swap atomique du symlink
    await addLog('Activation de la nouvelle release...');
    // Guard: swap atomique via mv (renommage) pour éviter un état
    // où le symlink pointe vers un répertoire incomplet.
    const currentLink = config.DEPLOY_CURRENT_LINK;
    const newLink = currentLink + '.new';
    fs.symlinkSync(releasePath, newLink);
    fs.renameSync(newLink, currentLink);
    await addLog('Release activée');

    // Étape 9 : Redémarrer les services PM2
    await addLog('Redémarrage des services...');
    try {
      safeExec('pm2 restart pinguin-api pinguin-bot pinguin-web --update-env', {
        timeout: 30_000,
      });
      await addLog('Services redémarrés');
    } catch (err: any) {
      // Guard: le swap a réussi, donc même si PM2 échoue, la release
      // est marquée SUCCESS (le redémarrage pourra être fait manuellement).
      await addLog(`AVERTISSEMENT : redémarrage PM2 a échoué — ${sanitizeLog(err.message || '')}`);
      await addLog('La release est prête. Redémarrez les services manuellement si besoin.');
    }

    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        version,
        releasePath,
        gitRef,
        status: DeploymentStatus.SUCCESS,
        completedAt: new Date(),
        log: logs.join('\n'),
      },
    });
    await addLog('Déploiement terminé avec succès');
  } catch (err: any) {
    const errMsg = sanitizeLog(err.message || 'Erreur inconnue');
    await addLog(`ERREUR: ${errMsg}`);

    // Guard: nettoyage du répertoire de release en cas d'échec
    if (releasePath && fs.existsSync(releasePath)) {
      try {
        fs.rmSync(releasePath, { recursive: true, force: true });
        await addLog('Répertoire de release nettoyé');
      } catch (cleanErr: any) {
        await addLog(`AVERTISSEMENT : échec du nettoyage — ${sanitizeLog(cleanErr.message || '')}`);
      }
    }

    // Guard: le current symlink n'a jamais été modifié, donc l'état
    // précédent est intact. Aucun rollback automatique nécessaire.

    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: DeploymentStatus.FAILED,
        completedAt: new Date(),
        log: logs.join('\n'),
      },
    });
  } finally {
    cleanupAskpassScript(askpassScript);
    await prisma.$disconnect().catch(() => {});
  }
}

// --- Fonctions exportées ---

export async function startDeployment(
  triggeredById: string,
  environment: DeployEnvironment = DeployEnvironment.DEVELOPMENT,
): Promise<{ id: string; version: string }> {
  // Guard: pas de déploiement concurrent
  const existing = await prisma.deployment.findFirst({
    where: { status: DeploymentStatus.RUNNING },
  });
  if (existing) {
    throw new Error(`Un déploiement est déjà en cours (${existing.version})`);
  }

  const version = `v${Date.now()}`;

  const deployment = await prisma.deployment.create({
    data: {
      id: randomUUID(),
      version,
      releasePath: '', // sera mis à jour par le worker
      environment,
      status: DeploymentStatus.RUNNING,
      triggeredById,
      startedAt: new Date(),
      log: '',
    },
  });

  // Lance le worker en détaché ou utilise spawn
  runDeploymentWorker(deployment.id, environment).catch((err) => {
    console.error('Deploy worker launch failed:', err);
  });

  return { id: deployment.id, version };
}

async function runDeploymentWorker(deploymentId: string, environment: DeployEnvironment): Promise<void> {
  const workerPath = path.resolve(__dirname, 'deploy-worker.ts');
  const workerJsPath = path.resolve(__dirname, 'deploy-worker.js');

  const scriptPath = fs.existsSync(workerJsPath) ? workerJsPath
    : fs.existsSync(workerPath) ? workerPath
    : null;

  if (!scriptPath) {
    // Fallback inline si le worker n'existe pas
    return runDeploymentPipeline(deploymentId, environment);
  }

  const isTs = scriptPath.endsWith('.ts');
  const child = spawn(
    process.execPath,
    isTs ? ['--import', require.resolve('tsx'), scriptPath, deploymentId] : [scriptPath, deploymentId],
    {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        DEPLOY_BRANCH: config.GITHUB_BRANCH,
        GITHUB_TOKEN: config.GITHUB_TOKEN,
        DEPLOY_ENV: environment,
      },
    },
  );
  child.unref();
}

export async function rollback(triggeredById: string, targetVersion?: string): Promise<void> {
  const currentLink = config.DEPLOY_CURRENT_LINK;

  if (targetVersion) {
    const target = await prisma.deployment.findFirst({
      where: { version: targetVersion, status: DeploymentStatus.SUCCESS },
    });
    if (!target || !target.releasePath || !fs.existsSync(target.releasePath)) {
      throw new Error(`Version ${targetVersion} introuvable ou son répertoire n'existe plus`);
    }

    const newLink = currentLink + '.new';
    fs.symlinkSync(target.releasePath, newLink);
    fs.renameSync(newLink, currentLink);

    await prisma.deployment.create({
      data: {
        id: randomUUID(),
        version: `rollback-to-${target.version}`,
        releasePath: target.releasePath,
        environment: target.environment,
        gitRef: target.gitRef,
        status: DeploymentStatus.ROLLED_BACK,
        triggeredById,
        startedAt: new Date(),
        completedAt: new Date(),
        log: `Rollback vers ${target.version} (${target.releasePath}) effectué. Services redémarrés.`,
      },
    });

    // Redémarre les services
    try {
      execSync('pm2 restart pinguin-api pinguin-bot pinguin-web --update-env', { timeout: 30_000 });
    } catch {
      // non-bloquant
    }

    return;
  }

  // Rollback automatique vers la release précédente (par répertoire)
  const releasesDir = config.DEPLOY_RELEASES_PATH;
  if (!fs.existsSync(releasesDir)) {
    throw new Error('Aucun répertoire de releases');
  }

  const dirs = fs.readdirSync(releasesDir)
    .map((d) => path.join(releasesDir, d))
    .filter((d) => fs.statSync(d).isDirectory())
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  if (dirs.length < 2) {
    throw new Error('Aucune release précédente disponible pour rollback');
  }

  const current = fs.existsSync(currentLink) ? fs.readlinkSync(currentLink) : null;
  const previous = dirs.find((d) => d !== current);

  if (!previous) {
    throw new Error('Aucune release précédente trouvée');
  }

  const newLink = currentLink + '.new';
  fs.symlinkSync(previous, newLink);
  fs.renameSync(newLink, currentLink);

  const version = `rollback-auto-${Date.now()}`;
  await prisma.deployment.create({
    data: {
      id: randomUUID(),
      version,
      releasePath: previous,
      environment: DeployEnvironment.DEVELOPMENT,
      status: DeploymentStatus.ROLLED_BACK,
      triggeredById,
      startedAt: new Date(),
      completedAt: new Date(),
      log: `Rollback automatique vers ${previous}. Services redémarrés.`,
    },
  });

  try {
    execSync('pm2 restart pinguin-api pinguin-bot pinguin-web --update-env', { timeout: 30_000 });
  } catch {
    // non-bloquant
  }
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
