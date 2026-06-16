'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { DatabaseBackup, RotateCcw, Trash2, Plus, Crown } from 'lucide-react';
import { Button } from '@pinguin/ui';
import { api, fetchGuildSettings } from '@/lib/api';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionCard } from '@/components/layout/SectionCard';
import { SkeletonPage } from '@/components/layout/SkeletonPage';
import { PermissionGate } from '@/components/PermissionGate';
import { itemVariants, containerVariants } from '@/lib/motion';

type Backup = {
  id: string;
  name: string;
  createdAt: string;
  channelCount: number;
  roleCount: number;
  size: number;
};

export default function BackupPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [isDonor, setIsDonor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const MAX_BACKUPS = isDonor ? 3 : 1;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, backupsRes] = await Promise.all([
        fetchGuildSettings(guildId),
        api.get<{ data: Backup[] }>(`/api/guilds/${guildId}/backup`),
      ]);
      if (settingsRes.success && settingsRes.data) {
        setIsDonor(settingsRes.data.guild.premium !== 'FREE');
      }
      if (backupsRes?.data) setBackups(backupsRes.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);

  const handleCreate = async () => {
    if (backups.length >= MAX_BACKUPS) return;
    setCreating(true);
    try {
      const name = `Backup ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
      await api.post(`/api/guilds/${guildId}/backup`, { name });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (id: string) => {
    if (!window.confirm('Restaurer ce backup ? Les paramètres actuels seront écrasés.')) return;
    setRestoring(id);
    try {
      await api.post(`/api/guilds/${guildId}/backup/${id}/restore`, {});
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la restauration');
    } finally {
      setRestoring(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer ce backup ?')) return;
    setDeleting(id);
    try {
      await api.delete(`/api/guilds/${guildId}/backup/${id}`);
      setBackups(b => b.filter(x => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la suppression');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) return <SkeletonPage rows={2} />;

  return (
    <PermissionGate permission="manageGuild">
      <PageLayout
        title="Backups du serveur"
        description={`Sauvegardez et restaurez les salons et rôles de votre serveur. Limite : ${MAX_BACKUPS} backup${MAX_BACKUPS > 1 ? 's' : ''}.`}
        actions={
          <Button
            onClick={handleCreate}
            loading={creating}
            disabled={backups.length >= MAX_BACKUPS}
          >
            <Plus size={14} />
            {backups.length >= MAX_BACKUPS
              ? `Limite atteinte (${backups.length}/${MAX_BACKUPS})`
              : 'Créer un backup'}
          </Button>
        }
      >
        {!isDonor && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 px-4 py-3 mb-4
                       bg-[var(--color-gold-highlight)] border border-[var(--color-gold)]
                       text-sm text-[var(--text-primary)]"
          >
            <Crown size={16} className="text-[var(--color-gold)] shrink-0" />
            <span>
              Les donateurs peuvent créer jusqu&apos;à <strong>3 backups</strong> simultanément.
              <a
                href={`/servers/${guildId}/soutien`}
                className="ml-2 underline text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
              >
                Soutenir le projet →
              </a>
            </span>
          </motion.div>
        )}

        {error && (
          <div className="text-sm text-[var(--error)] bg-[var(--error)]/10 px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <SectionCard
          title="Backups existants"
          icon={<DatabaseBackup size={16} />}
          description={backups.length === 0 ? 'Aucun backup créé pour ce serveur.' : undefined}
        >
          {backups.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] py-4 text-center">
              Créez votre premier backup pour pouvoir restaurer votre serveur en cas de problème.
            </p>
          ) : (
            <motion.ul
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              <AnimatePresence>
                {backups.map((backup) => (
                  <motion.li
                    key={backup.id}
                    variants={itemVariants}
                    exit={{ opacity: 0, x: -16, transition: { duration: 0.15 } }}
                    className="flex items-center justify-between p-3
                               border border-[var(--border-color)] bg-[var(--bg-surface-alt)]"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {backup.name}
                      </span>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {new Date(backup.createdAt).toLocaleString('fr-FR')} ·{' '}
                        {backup.channelCount} salon{backup.channelCount !== 1 ? 's' : ''} ·{' '}
                        {backup.roleCount} rôle{backup.roleCount !== 1 ? 's' : ''} ·{' '}
                        {backup.size} Ko
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={restoring === backup.id}
                        onClick={() => handleRestore(backup.id)}
                      >
                        <RotateCcw size={13} />
                        Restaurer
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={deleting === backup.id}
                        onClick={() => handleDelete(backup.id)}
                        className="text-[var(--error)] hover:bg-[var(--error)]/10"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ul>
          )}
        </SectionCard>
      </PageLayout>
    </PermissionGate>
  );
}
