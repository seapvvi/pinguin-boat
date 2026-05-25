'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import {
  FileText, Plus, Eye, Send, Edit2, Trash2,
  X, GripVertical
} from 'lucide-react';
import { Card, Input, Button, Badge, Modal, Skeleton, EmptyState } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchGuildSettings, api } from '@/lib/api';
import { generateId } from '@/lib/utils';
import type { GuildConfig, EmbedPreset, EmbedField } from '@pinguin/shared';
import { ModuleToggle } from '@/components/ModuleToggle';

export default function EmbedsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [config, setConfig] = useState<GuildConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [embeds, setEmbeds] = useState<EmbedPreset[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<EmbedPreset | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sendChannel, setSendChannel] = useState('');
  const [form, setForm] = useState<EmbedPreset>({
    id: '', name: '', title: '', description: '', color: '#5865F2',
    fields: [], footer: '', thumbnail: '', image: '', timestamp: false,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchGuildSettings(guildId);
      if (res.success && res.data) {
        setConfig(res.data.guild);
        setEmbeds(res.data.guild.embeds ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [guildId]);

  const resetForm = () => {
    setForm({ id: '', name: '', title: '', description: '', color: '#5865F2', fields: [], footer: '', thumbnail: '', image: '', timestamp: false });
    setFormErrors({});
    setEditingId(null);
  };

  const openCreate = (embed?: EmbedPreset) => {
    if (embed) {
      setForm({ ...embed });
      setEditingId(embed.id);
    } else {
      resetForm();
    }
    setCreateOpen(true);
  };

  const addField = () => {
    setForm({ ...form, fields: [...form.fields, { name: '', value: '', inline: false }] });
  };

  const removeField = (index: number) => {
    setForm({ ...form, fields: form.fields.filter((_, i) => i !== index) });
  };

  const updateField = (index: number, key: keyof EmbedField, value: unknown) => {
    const fields = [...form.fields];
    fields[index] = { ...fields[index], [key]: value };
    setForm({ ...form, fields });
  };

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Requis';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      let updated: EmbedPreset[];
      const embed = { ...form, id: editingId || generateId() };
      if (editingId) {
        updated = embeds.map((e) => e.id === editingId ? embed : e);
      } else {
        updated = [...embeds, embed];
      }
      await api.put(`/api/guilds/${guildId}/embeds`, { embeds: updated });
      setEmbeds(updated);
      setCreateOpen(false);
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const updated = embeds.filter((e) => e.id !== id);
    try {
      await api.put(`/api/guilds/${guildId}/embeds`, { embeds: updated });
      setEmbeds(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la suppression');
    }
  };

  const handleSend = async (embed: EmbedPreset) => {
    if (!sendChannel.trim()) return;
    try {
      await api.post(`/api/guilds/${guildId}/embeds/send`, { embed, channelId: sendChannel.trim() });
      setSendChannel('');
      setPreviewOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de l\'envoi');
    }
  };

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Embeds sauvegardés</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Créez et gérez vos embeds personnalisés.</p>
        </div>
        <Button size="sm" onClick={() => openCreate()}><Plus size={14} /> Nouvel embed</Button>
      </div>

      <div className="mb-4">
        <ModuleToggle guildId={guildId} moduleKey="embeds" label="Embeds" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-[var(--radius)]" />
          ))}
        </div>
      ) : embeds.length === 0 ? (
        <EmptyState title="Aucun embed" description="Créez votre premier embed." icon={<FileText size={32} />} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {embeds.map((embed) => (
            <Card key={embed.id} hover>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{embed.name}</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{embed.fields.length} champ(s)</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => { setPreviewData(embed); setPreviewOpen(true); }}><Eye size={12} /></Button>
                  <Button variant="ghost" size="sm" onClick={() => openCreate(embed)}><Edit2 size={12} /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(embed.id)}><Trash2 size={12} /></Button>
                </div>
              </div>
              {embed.title && <p className="text-xs text-[var(--text-primary)] truncate mb-2">{embed.title}</p>}
              {embed.description && <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{embed.description}</p>}
              <div className="flex items-center gap-2 mt-2">
                <div className="w-3 h-3 rounded-[0px]" style={{ backgroundColor: embed.color }} />
                {embed.timestamp && <Badge variant="info">Timestamp</Badge>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => { setCreateOpen(false); resetForm(); }} title={editingId ? 'Modifier l\'embed' : 'Nouvel embed'}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <Input label="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={formErrors.name} placeholder="Mon embed" />
          <Input label="Titre" value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value || null })} placeholder="Titre de l'embed" />
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">Description</label>
            <textarea
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value || null })}
              placeholder="Description de l'embed"
              className="w-full px-3 py-2 text-sm text-[var(--text-primary)] bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] outline-none focus:border-[var(--accent)] transition-colors resize-none h-20"
            />
          </div>
          <Input label="Couleur" type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10" />
          <Input label="Footer" value={form.footer ?? ''} onChange={(e) => setForm({ ...form, footer: e.target.value || null })} placeholder="Texte du footer" />
          <Input label="Image (URL)" value={form.image ?? ''} onChange={(e) => setForm({ ...form, image: e.target.value || null })} placeholder="https://..." />
          <Input label="Thumbnail (URL)" value={form.thumbnail ?? ''} onChange={(e) => setForm({ ...form, thumbnail: e.target.value || null })} placeholder="https://..." />
          <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)]">
            <span className="text-sm text-[var(--text-primary)]">Afficher le timestamp</span>
            <input type="checkbox" checked={form.timestamp} onChange={(e) => setForm({ ...form, timestamp: e.target.checked })} className="accent-[var(--accent)]" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Champs ({form.fields.length})</span>
              <Button variant="ghost" size="sm" onClick={addField}><Plus size={12} /> Ajouter</Button>
            </div>
            <div className="space-y-3">
              {form.fields.map((field, i) => (
                <div key={i} className="p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-alt)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--text-secondary)]">Champ {i + 1}</span>
                    <button onClick={() => removeField(i)} className="text-[var(--text-secondary)] hover:text-[var(--error)] transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                  <Input placeholder="Nom" value={field.name} onChange={(e) => updateField(i, 'name', e.target.value)} />
                  <Input placeholder="Valeur" value={field.value} onChange={(e) => updateField(i, 'value', e.target.value)} />
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={field.inline} onChange={(e) => updateField(i, 'inline', e.target.checked)} className="accent-[var(--accent)]" />
                    <span className="text-xs text-[var(--text-secondary)]">Inline</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setCreateOpen(false); resetForm(); }}>Annuler</Button>
            <Button loading={submitting} onClick={handleSave}>{editingId ? 'Mettre à jour' : 'Créer'}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Aperçu de l'embed">
        {previewData && (
          <div className="space-y-4">
            <div className="border-l-4 rounded-[var(--radius-sm)] p-4 bg-[var(--bg-surface-alt)]" style={{ borderColor: previewData.color }}>
              {previewData.title && <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">{previewData.title}</h3>}
              {previewData.description && <p className="text-xs text-[var(--text-secondary)] mb-3">{previewData.description}</p>}
              {previewData.fields.map((f, i) => (
                <div key={i} className={`mb-2 ${f.inline ? 'inline-block w-1/2 pr-2' : 'block'}`}>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{f.name}</span>
                  <p className="text-xs text-[var(--text-secondary)]">{f.value}</p>
                </div>
              ))}
              {previewData.footer && <p className="text-xs text-[var(--text-secondary)] mt-2">{previewData.footer}</p>}
            </div>
            <Input label="ID du salon" value={sendChannel} onChange={(e) => setSendChannel(e.target.value)} placeholder="Salon de destination" />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setPreviewOpen(false)}>Fermer</Button>
              <Button onClick={() => handleSend(previewData)} disabled={!sendChannel.trim()}>
                <Send size={14} /> Envoyer
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </motion.div>
  );
}
