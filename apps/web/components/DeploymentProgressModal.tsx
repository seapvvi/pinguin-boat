'use client';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, XCircle, Loader, Terminal } from 'lucide-react';
import { fetchDeploymentStatus } from '@/lib/api';

interface DeploymentProgressModalProps {
  deploymentId: string | null;
  onClose: () => void;
}

const STEPS = [
  { keyword: 'Téléchargement', label: 'Téléchargement depuis GitHub' },
  { keyword: 'Fichier partagé lié', label: 'Copie des fichiers partagés' },
  { keyword: 'Installation des dépendances', label: 'Installation des dépendances' },
  { keyword: 'Build du projet', label: 'Build du projet' },
  { keyword: 'Prisma généré', label: 'Génération Prisma' },
  { keyword: 'Migrations appliquées', label: 'Migration base de données' },
  { keyword: 'Vérification de santé', label: 'Vérification de santé' },
  { keyword: 'Lien symbolique mis à jour', label: 'Mise à jour du lien' },
];

export default function DeploymentProgressModal({ deploymentId, onClose }: DeploymentProgressModalProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('RUNNING');
  const [completedSteps, setCompletedSteps] = useState<number>(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!deploymentId) return;

    const poll = setInterval(async () => {
      try {
        const res = await fetchDeploymentStatus(deploymentId);
        if (res.success && res.data) {
          const d = res.data;
          setLogs(d.log || []);
          setStatus(d.status);

          const completed = STEPS.filter(s =>
            (d.log || []).some(l => l.includes(s.keyword))
          ).length;
          setCompletedSteps(completed);

          if (d.status !== 'RUNNING' && d.status !== 'PENDING') {
            clearInterval(poll);
          }
        }
      } catch {
        // ignore
      }
    }, 1500);

    return () => clearInterval(poll);
  }, [deploymentId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const isRunning = status === 'RUNNING' || status === 'PENDING';
  const isSuccess = status === 'SUCCESS';
  const isFailed = status === 'FAILED';
  const progress = STEPS.length > 0 ? (completedSteps / STEPS.length) * 100 : 0;

  return (
    <AnimatePresence>
      {deploymentId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[0px] w-full max-w-lg mx-4 overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-3">
                {isRunning && <Loader size={18} className="text-[var(--info)] animate-spin" />}
                {isSuccess && <CheckCircle size={18} className="text-[var(--success)]" />}
                {isFailed && <XCircle size={18} className="text-[var(--error)]" />}
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  {isRunning && 'Déploiement en cours...'}
                  {isSuccess && 'Déploiement réussi'}
                  {isFailed && 'Déploiement échoué'}
                </h2>
              </div>
              {(isSuccess || isFailed) && (
                <button onClick={onClose} className="p-1 hover:bg-[var(--bg-surface-alt)] rounded-[var(--radius-sm)] transition-colors">
                  <X size={16} className="text-[var(--text-secondary)]" />
                </button>
              )}
            </div>

            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-[var(--bg-surface-alt)] rounded-[0px] overflow-hidden">
                  <motion.div
                    className={`h-full rounded-[0px] ${isFailed ? 'bg-[var(--error)]' : 'bg-[var(--accent)]'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className="text-xs text-[var(--text-secondary)] font-medium w-10 text-right">
                  {Math.round(progress)}%
                </span>
              </div>

              <div className="space-y-1.5">
                {STEPS.map((step, i) => {
                  const done = logs.some(l => l.includes(step.keyword));
                  const active = !done && (i === 0 || STEPS.slice(0, i).every((s, j) =>
                    logs.some(l => l.includes(s.keyword))
                  ));
                  return (
                    <div key={step.keyword} className="flex items-center gap-2 text-xs">
                      {done ? (
                        <CheckCircle size={12} className="text-[var(--success)] shrink-0" />
                      ) : active && isRunning ? (
                        <Loader size={12} className="text-[var(--accent)] animate-spin shrink-0" />
                      ) : (
                        <div className="w-3 h-3 rounded-[0px] border border-[var(--border-color)] shrink-0" />
                      )}
                      <span className={`${done ? 'text-[var(--text-primary)]' : active ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mx-5 mb-4 p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-[var(--radius-sm)] max-h-48 overflow-y-auto">
              <div className="flex items-center gap-1.5 mb-2">
                <Terminal size={12} className="text-[var(--text-secondary)]" />
                <span className="text-xs text-[var(--text-secondary)] font-medium">Logs</span>
              </div>
              <div className="space-y-0.5 font-mono text-[11px] leading-relaxed">
                {logs.length === 0 && isRunning && (
                  <span className="text-[var(--text-secondary)] italic">En attente des logs...</span>
                )}
                {logs.map((line, i) => {
                  const isErr = line.includes('ERREUR') || line.includes('❌');
                  const isOk = line.includes('✅') || line.includes('✅');
                  return (
                    <div key={i} className={`${isErr ? 'text-[var(--error)]' : isOk ? 'text-[var(--success)]' : 'text-[var(--text-secondary)]'}`}>
                      {line}
                    </div>
                  );
                })}
                <div ref={logEndRef} />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
