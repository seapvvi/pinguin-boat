'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  FileText, Plus, Send, Edit2, Trash2, Save,
} from 'lucide-react';
import { Input, Button, Modal, Skeleton, EmptyState } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { api, fetchGuildChannels } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { EmbedData } from '@pinguin/db';
import { ModuleToggle } from '@/components/ModuleToggle';
import EmbedEditor from '@/components/embeds/EmbedEditor';
import { PageLayout, SectionCard } from '@/components/layout';

interface SavedEmbed extends EmbedData {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface Channel {
  id: string;
  name: string;
  type: number;
}

const EMPTY_EMBED: EmbedData = {
  color: '#5865F2',
  fields: [],
  timestamp: false,
};

export default function EmbedsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [embeds, setEmbeds] = useState<SavedEmbed[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [embedData, setEmbedData] = useState<EmbedData>(EMPTY_EMBED);
  const [submitting, setSubmitting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [sendOpen, setSendOpen] = useState(false);
  const [sendEmbedId, setSendEmbedId] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [sending, setSending] = useState(false);
  const [channelsLoading, setChannelsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ success: boolean; data: { embeds: SavedEmbed[] } }>(`/api/guilds/${guildId}/embeds`);
      if (res.success && res.data) {
        setEmbeds(res.data.embeds);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => { load(); }, [load]);

  const resetEditor = () => {
    setEditingId(null);
    setTemplateName('');
    setEmbedData(EMPTY_EMBED);
    setIsCreating(false);
  };

  const openNew = () => {
    resetEditor();
    setIsCreating(true);
  };

  const openEdit = (embed: SavedEmbed) => {
    setEditingId(embed.id);
    setTemplateName(embed.name);
    setEmbedData({
      title: embed.title,
      description: embed.description,
      color: embed.color,
      fields: embed.fields,
      footer: embed.footer,
      image: embed.image,
      thumbnail: embed.thumbnail,
      authorName: embed.authorName,
      authorIcon: embed.authorIcon,
      timestamp: embed.timestamp,
    });
  };

  const handleSave = async () => {
    if (!templateName.trim()) {
      setError('Le nom du template est requis');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        name: templateName.trim(),
        title: embedData.title ?? null,
        description: embedData.description ?? null,
        color: embedData.color,
        fields: embedData.fields,
        footer: embedData.footer ?? null,
        image: embedData.image ?? null,
        thumbnail: embedData.thumbnail ?? null,
        authorName: embedData.authorName ?? null,
        authorIcon: embedData.authorIcon ?? null,
        timestamp: embedData.timestamp,
      };
      if (editingId) {
        await api.put(`/api/guilds/${guildId}/embeds/${editingId}`, body);
      } else {
        await api.post(`/api/guilds/${guildId}/embeds`, body);
      }
      await load();
      resetEditor();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await api.delete(`/api/guilds/${guildId}/embeds/${id}`);
      setEmbeds((prev) => prev.filter((e) => e.id !== id));
      if (editingId === id) resetEditor();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la suppression');
    }
  };

  const openSend = async (id: string) => {
    setSendEmbedId(id);
    setSendOpen(true);
    setSelectedChannel('');
    setChannelsLoading(true);
    try {
      const res = await fetchGuildChannels(guildId);
      if (res.success && res.data) {
        setChannels(res.data.channels.filter((c) => c.type === 0).map((c) => ({
          id: String(c.id),
          name: String(c.name),
          type: Number(c.type),
        })));
      }
    } catch {
      setError('Impossible de charger les salons');
    } finally {
      setChannelsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!sendEmbedId || !selectedChannel) return;
    setSending(true);
    setError(null);
    try {
      const embed = embeds.find((e) => e.id === sendEmbedId);
      if (!embed) throw new Error('Embed introuvable');
      await api.post(`/api/guilds/${guildId}/embeds/${sendEmbedId}/send`, {
        channelId: selectedChannel,
        embed: {
          title: embed.title ?? null,
          description: embed.description ?? null,
          color: embed.color,
          fields: embed.fields,
          footer: embed.footer ?? null,
          image: embed.image ?? null,
          thumbnail: embed.thumbnail ?? null,
          authorName: embed.authorName ?? null,
          authorIcon: embed.authorIcon ?? null,
          timestamp: embed.timestamp,
        },
      });
      setSendOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };

  if (error && loading) {
    return (
      <PageLayout title="Éditeur d'embeds">
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Éditeur d'embeds"
      description="Créez, modifiez et envoyez des embeds personnalisés."
    >
      <div className="mb-4">
        <ModuleToggle guildId={guildId} moduleKey="embeds" label="Embeds" />
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-[40%] flex-shrink-0">
          <SectionCard
            title="Templates"
            headerAction={
              <Button variant="ghost" size="sm" onClick={openNew}>
                <Plus size={14} /> Nouveau
              </Button>
            }
          >
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : embeds.length === 0 ? (
              <EmptyState title="Aucun template" description="Créez votre premier embed." icon={<FileText size={24} />} />
            ) : (
              <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                {embeds.map((embed) => (
                  <div
                    key={embed.id}
                    className={`cursor-pointer transition-colors border border-[var(--border-color)] bg-[var(--bg-surface)] ${editingId === embed.id ? 'border-[var(--accent)]' : ''}`}
                    onClick={() => openEdit(embed)}
                  >
                    <div className="flex items-start gap-3 p-3">
                      <div className="w-1 self-stretch flex-shrink-0" style={{ backgroundColor: embed.color }} />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{embed.name}</h3>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                          {embed.fields.length} champ{embed.fields.length > 1 ? 's' : ''}
                        </p>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-1">{formatDate(embed.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(embed); }}>
                          <Edit2 size={12} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openSend(embed.id); }}>
                          <Send size={12} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(embed.id); }}>
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="flex-1 min-w-0">
          <SectionCard title={isCreating || editingId ? (editingId ? 'Modifier le template' : 'Nouveau template') : 'Éditeur'}>
            {(isCreating || editingId) ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Input
                      placeholder="Nom du template"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      className="text-sm font-semibold"
                    />
                  </div>
                  <Button onClick={handleSave} loading={submitting} disabled={!templateName.trim()}>
                    <Save size={14} /> {editingId ? 'Mettre à jour' : 'Créer'}
                  </Button>
                  <Button variant="secondary" onClick={resetEditor}>Annuler</Button>
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 text-sm text-red-400">
                    {error}
                  </div>
                )}

                <EmbedEditor value={embedData} onChange={setEmbedData} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 border border-dashed border-[var(--border-color)]">
                <div className="text-center">
                  <FileText size={40} className="mx-auto mb-3 text-[var(--text-secondary)]" />
                  <p className="text-sm text-[var(--text-secondary)]">
                    Sélectionnez un template ou créez-en un nouveau
                  </p>
                  <Button className="mt-4" onClick={openNew}>
                    <Plus size={14} /> Nouveau template
                  </Button>
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <Modal open={sendOpen} onClose={() => setSendOpen(false)} title="Envoyer l'embed">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">Salon de destination</label>
            {channelsLoading ? (
              <Skeleton className="h-10" />
            ) : channels.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">Aucun salon texte disponible</p>
            ) : (
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="w-full px-3 py-2 text-sm text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border-color)] outline-none focus:border-[var(--accent)] transition-colors"
              >
                <option value="">-- Choisir un salon --</option>
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    #{ch.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setSendOpen(false)}>Annuler</Button>
            <Button onClick={handleSend} loading={sending} disabled={!selectedChannel}>
              <Send size={14} /> Envoyer
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  );
}
