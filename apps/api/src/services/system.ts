import { spawn, spawnSync } from 'child_process';

export type AppServiceKey = 'bot' | 'api' | 'web';
export type ServiceStatus = 'RUNNING' | 'STOPPED' | 'ERROR' | 'RESTARTING' | 'UNKNOWN';

const SERVICE_NAME_BY_KEY: Record<AppServiceKey, string> = {
  bot: 'pinguin-bot',
  api: 'pinguin-api',
  web: 'pinguin-web',
};

const SERVICE_DISPLAY_NAME: Record<AppServiceKey, string> = {
  bot: 'Bot Discord',
  api: 'API REST',
  web: 'Interface Web',
};

interface Pm2ProcessInfo {
  name: string;
  pm2_env: {
    status: string;
    pid: number;
    pm_uptime: number;
    restart_time: number;
  };
  monit: {
    memory: number;
    cpu: number;
  };
}

export interface ServiceInfo {
  name: AppServiceKey;
  displayName: string;
  status: ServiceStatus;
  pid?: number;
  uptime?: number;
  memory?: number;
  cpu?: number;
}

function mapPm2Status(status: string | undefined): ServiceStatus {
  switch (status) {
    case 'online':
      return 'RUNNING';
    case 'stopping':
    case 'launching':
      return 'RESTARTING';
    case 'errored':
    case 'fatal':
      return 'ERROR';
    case 'stopped':
      return 'STOPPED';
    default:
      return 'UNKNOWN';
  }
}

function getPm2ServiceName(service: AppServiceKey): string {
  return SERVICE_NAME_BY_KEY[service];
}

function executePm2Command(cmd: string, args: string[]): string {
  const result = spawnSync(cmd, args, { encoding: 'utf8' });
  if (result.error && (result.error as any).code === 'ENOENT') {
    const fallback = spawnSync('npx', ['pm2', ...args], { encoding: 'utf8' });
    if (fallback.error) {
      throw fallback.error;
    }
    if (fallback.status !== 0) {
      throw new Error(fallback.stderr || fallback.stdout || 'Erreur PM2 inconnue');
    }
    return fallback.stdout || '';
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Erreur PM2 inconnue');
  }

  return result.stdout || '';
}

function executePm2Detached(cmd: string, args: string[]): void {
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
  child.unref();
}

export function listServices(): ServiceInfo[] {
  let output = '';
  try {
    output = executePm2Command('pm2', ['jlist']);
  } catch (err) {
    if (typeof err === 'string') {
      throw new Error(err);
    }
    throw err;
  }

  const processes = JSON.parse(output) as Pm2ProcessInfo[];

  return (Object.keys(SERVICE_NAME_BY_KEY) as AppServiceKey[]).map((service) => {
    const processName = getPm2ServiceName(service);
    const proc = processes.find((item) => item.name === processName);
    if (!proc) {
      return {
        name: service,
        displayName: SERVICE_DISPLAY_NAME[service],
        status: 'STOPPED' as ServiceStatus,
      };
    }

    return {
      name: service,
      displayName: SERVICE_DISPLAY_NAME[service],
      status: mapPm2Status(proc.pm2_env.status),
      pid: proc.pm2_env.pid || undefined,
      uptime: proc.pm2_env.pm_uptime ? Math.max(0, Math.floor((Date.now() - proc.pm2_env.pm_uptime) / 1000)) : undefined,
      memory: proc.monit?.memory,
      cpu: proc.monit?.cpu,
    };
  });
}

export function restartService(service: AppServiceKey, detached = false): void {
  const name = getPm2ServiceName(service);
  if (detached) {
    executePm2Detached('pm2', ['restart', name]);
    return;
  }
  executePm2Command('pm2', ['restart', name]);
}

export function stopService(service: AppServiceKey): void {
  executePm2Command('pm2', ['stop', getPm2ServiceName(service)]);
}

export function startService(service: AppServiceKey): void {
  executePm2Command('pm2', ['restart', getPm2ServiceName(service)]);
}

export function restartAllServices(detached = false): void {
  const serviceNames = Object.values(SERVICE_NAME_BY_KEY);
  if (detached) {
    executePm2Detached('pm2', ['restart', ...serviceNames]);
    return;
  }
  executePm2Command('pm2', ['restart', ...serviceNames]);
}
