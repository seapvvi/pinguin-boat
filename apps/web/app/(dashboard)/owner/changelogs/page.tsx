'use client';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Sparkles, Plus, Trash2, Eye, EyeOff, Edit3,
  FileText, Calendar, Hash
} from 'lucide-react';
import {
  Card, Button, Badge, Skeleton, EmptyState, ErrorMessage,
  Modal, Input
} from '@pinguin/ui';
import { fetchChangelogs, createChangelog, updateChangelog, deleteChangelog } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface ChangelogEntry {
  id: string;
  title: string;
  content: string;
  version: string;
  published?: boolean;
  authorId: string;
  createdAt: string;
}

export default function OwnerChangelogsPage() {
  const [changelogs, setChangelogs] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<ChangelogEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChangelogEntry | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formVersion, setFormVersion] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchChangelogs({ limit: '50' });
      if (res.success && res.data) setChangelogs(res.data.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setFormTitle('');
    setFormContent('');
    setFormVersion('');
  };

  const openCreate = () => {
    resetForm();
    setEditTarget(null);
    setShowCreate(true);
  };

  const openEdit = (cl: ChangelogEntry) => {
    setFormTitle(cl.title);
    setFormContent(cl.content);
    setFormVersion(cl.version);
    setEditTarget(cl);
    setShowCreate(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim() || !formVersion.trim()) return;
    setActionLoading(true);
    try {
      if (editTarget) {
        await updateChangelog(editTarget.id, { title: formTitle, content: formContent, version: formVersion });
      } else {
        await createChangelog({ title: formTitle, content: formContent, version: formVersion });
      }
      setShowCreate(false);
      resetForm();
      load();
    } catch { /* ignore */ } finally { setActionLoading(false); }
  };

  const handleTogglePublish = async (cl: ChangelogEntry) => {
    try {
      await updateChangelog(cl.id, { published: !cl.published });
      load();
    } catch { /* ignore */ }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await deleteChangelog(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch { /* ignore */ } finally { setActionLoading(false); }
  };

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Gestion des changelogs</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Créez et gérez les notes de mise à jour.</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus size={14} /> Nouveau changelog</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-[var(--radius)]" />)}
        </div>
      ) : changelogs.length === 0 ? (
        <EmptyState
          icon={<FileText size={32} />}
          title="Aucun changelog"
          description="Commencez par créer une note de mise à jour."
          action={{ label: 'Créer un changelog', onClick: openCreate }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {changelogs.map((cl) => (
            <Card key={cl.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={14} className="text-[var(--accent)]" />
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{cl.title}</span>
                    <Badge variant="info">{cl.version}</Badge>
                    <Badge variant={cl.published ? 'success' : 'default'}>{cl.published ? 'Publié' : 'Brouillon'}</Badge>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mt-2 whitespace-pre-wrap line-clamp-3">{cl.content}</p>
                  <div className="flex items-center gap-3 mt-3 text-xs text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1"><Calendar size={11} /> {formatDate(cl.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => handleTogglePublish(cl)} title={cl.published ? 'Masquer' : 'Publier'}>
                    {cl.published ? <EyeOff size={14} /> : <Eye size={14} />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(cl)} title="Modifier"><Edit3 size={14} /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(cl)} title="Supprimer"><Trash2 size={14} className="text-[var(--error)]" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={editTarget ? 'Modifier le changelog' : 'Nouveau changelog'}>
        <div className="space-y-4">
          <Input label="Titre" placeholder="Titre du changelog..." value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
          <Input label="Version" placeholder="1.0.0" value={formVersion} onChange={(e) => setFormVersion(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase">Contenu</label>
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder="Décrivez les changements..."
              rows={6}
              className="w-full px-3 py-2 text-sm text-[var(--text-primary)] bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] outline-none focus:border-[var(--accent)] transition-colors resize-none placeholder:text-[var(--text-secondary)]"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button size="sm" loading={actionLoading} disabled={!formTitle.trim() || !formContent.trim() || !formVersion.trim()} onClick={handleSave}>
              {editTarget ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirmer la suppression">
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Supprimer le changelog <strong className="text-[var(--text-primary)]">{deleteTarget?.title}</strong>&nbsp;?<br />
          Cette action est irréversible.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>Annuler</Button>
          <Button variant="danger" size="sm" loading={actionLoading} onClick={handleDelete}>Supprimer</Button>
        </div>
      </Modal>
    </motion.div>
  );
}
