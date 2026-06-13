'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  ClipboardList, Plus, Trash2, Edit2, X, Check,
  ChevronLeft, ChevronRight, Eye, XCircle, CheckCircle,
  Clock, FileText, ArrowUp, ArrowDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button, Badge, Skeleton, EmptyState, ErrorMessage, Input, Modal } from '@pinguin/ui';
import {
  fetchFormSettings, updateFormSettings,
  createFormTemplate, updateFormTemplate, deleteFormTemplate,
  fetchFormSubmissions, updateFormSubmission,
} from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { ModuleToggle } from '@/components/ModuleToggle';
import { DiscordSelect } from '@/components/DiscordSelect';
import { SkeletonPage } from '@/components/layout/SkeletonPage';
import { PageLayout, SectionCard, ModuleGrid } from '@/components/layout';

interface FormField {
  label: string;
  style: 'short' | 'paragraph';
  required: boolean;
}

function normalizeField(f: unknown): FormField {
  let style: 'short' | 'paragraph' = 'short';
  const field = f as { style?: string; type?: string; label?: string; required?: boolean };
  if (field?.style === 'paragraph' || field?.type === 'textarea') style = 'paragraph';
  return { label: field?.label ?? '', style, required: field?.required !== false };
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  fields: string;
  enabled: boolean;
  createdAt: string;
}

interface Submission {
  id: string;
  templateId: string;
  templateName: string;
  userId: string;
  user: { discordId: string; username: string; avatar: string | null };
  responses: unknown[];
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

const statusLabels: Record<string, string> = {
  pending: 'En attente',
  approved: 'Approuvé',
  rejected: 'Rejeté',
};

const statusVariants: Record<string, 'warning' | 'success' | 'error'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
};

export default function FormsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [subPage, setSubPage] = useState(1);
  const [subTotalPages, setSubTotalPages] = useState(1);
  const [tab, setTab] = useState<'templates' | 'submissions'>('templates');

  const [channelId, setChannelId] = useState('');
  const [logChannel, setLogChannel] = useState('');
  const [saving, setSaving] = useState(false);

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: '', description: '', fields: [{ label: '', style: 'short' as const, required: true }] as FormField[] });
  const [templateSaving, setTemplateSaving] = useState(false);

  const [viewSubmission, setViewSubmission] = useState<Submission | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFormSettings(guildId);
      const data = (res as any)?.data;
      if (data?.settings) {
        setSettings(data.settings);
        setTemplates(data.settings.templates ?? []);
        setChannelId(data.settings.channelId ?? '');
        setLogChannel(data.settings.logChannel ?? '');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  const loadSubmissions = useCallback(async (p: number) => {
    try {
      const res = await fetchFormSubmissions(guildId, { page: String(p), limit: '15' });
      const data = (res as any)?.data;
      if (data) {
        setSubmissions(data.submissions ?? []);
        setSubTotalPages(data.pagination?.totalPages ?? 1);
      }
    } catch { }
  }, [guildId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadSubmissions(subPage); }, [loadSubmissions, subPage]);

  useEffect(() => {
    const interval = setInterval(() => {
      load();
      loadSubmissions(subPage);
    }, 10000);
    return () => clearInterval(interval);
  }, [load, loadSubmissions, subPage]);

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await updateFormSettings(guildId, {
        channelId: channelId || null,
        logChannel: logChannel || null,
      });
      toast.success('Configuration enregistrée');
      await load();
    } catch (e: any) {
      const msg = e?.message || 'Erreur';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const openCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({ name: '', description: '', fields: [{ label: '', style: 'short', required: true }] });
    setShowTemplateModal(true);
  };

  const openEditTemplate = (t: Template) => {
    setEditingTemplate(t);
    let fields: FormField[];
    try {
      fields = (JSON.parse(t.fields) as unknown[]).map(normalizeField);
    } catch {
      fields = [];
    }
    if (fields.length === 0) fields = [{ label: '', style: 'short', required: true }];
    setTemplateForm({ name: t.name, description: t.description ?? '', fields });
    setShowTemplateModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim()) return;
    setTemplateSaving(true);
    try {
      const fields = templateForm.fields.filter(f => f.label.trim());
      if (editingTemplate) {
        await updateFormTemplate(guildId, editingTemplate.id, {
          name: templateForm.name,
          description: templateForm.description || null,
          fields,
        });
        toast.success('Formulaire modifié');
      } else {
        await createFormTemplate(guildId, {
          name: templateForm.name,
          description: templateForm.description || undefined,
          fields: fields as unknown as Record<string, unknown>[],
        });
        toast.success('Formulaire créé');
      }
      setShowTemplateModal(false);
      await load();
    } catch (e: any) {
      const msg = e?.message || 'Erreur';
      setError(msg);
      toast.error(msg);
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Supprimer ce formulaire ?')) return;
    try {
      await deleteFormTemplate(guildId, id);
      toast.success('Formulaire supprimé');
      await load();
    } catch (e: any) {
      const msg = e?.message || 'Erreur';
      setError(msg);
      toast.error(msg);
    }
  };

  const handleToggleTemplate = async (t: Template) => {
    try {
      await updateFormTemplate(guildId, t.id, { enabled: !t.enabled });
      toast.success(t.enabled ? 'Formulaire désactivé' : 'Formulaire activé');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Erreur');
    }
  };

  const handleSubmissionAction = async (submissionId: string, status: 'approved' | 'rejected') => {
    setActionLoading(submissionId);
    try {
      await updateFormSubmission(guildId, submissionId, { status });
      await loadSubmissions(subPage);
    } catch { } finally {
      setActionLoading(null);
    }
  };

  const addField = () => {
    setTemplateForm(prev => ({
      ...prev,
      fields: [...prev.fields, { label: '', style: 'short', required: true }],
    }));
  };

  const removeField = (index: number) => {
    setTemplateForm(prev => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index),
    }));
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    setTemplateForm(prev => {
      const newFields = [...prev.fields];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= newFields.length) return prev;
      [newFields[index], newFields[target]] = [newFields[target], newFields[index]];
      return { ...prev, fields: newFields };
    });
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    setTemplateForm(prev => ({
      ...prev,
      fields: prev.fields.map((f, i) => i === index ? { ...f, ...updates } : f),
    }));
  };

  if (error && !settings) {
    return (
      <PageLayout title="Formulaires">
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Formulaires"
      description="Créez des formulaires personnalisés et recevez les réponses en direct."
    >
      <div className="mb-4">
        <ModuleToggle guildId={guildId} moduleKey="forms" label="Formulaires" />
      </div>

      {error && (
        <div className="border border-[var(--error)] bg-[var(--error)]/10 p-3 text-sm text-[var(--error)] mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <SkeletonPage rows={2} />
      ) : (
        <>
          <SectionCard title="Configuration">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DiscordSelect guildId={guildId} type="channel" value={channelId} onChange={setChannelId} placeholder="Sélectionner un salon" label="Salon des formulaires" />
              <DiscordSelect guildId={guildId} type="channel" value={logChannel} onChange={setLogChannel} placeholder="Sélectionner un salon" label="Salon de logs" />
            </div>
            <div className="mt-4">
              <Button variant="primary" size="sm" loading={saving} onClick={handleSaveSettings}>
                Sauvegarder
              </Button>
            </div>
          </SectionCard>

          <SectionCard
            title="Créer un formulaire"
            expandable
            defaultExpanded={false}
            headerAction={
              <Button variant="primary" size="sm" onClick={openCreateTemplate}>
                <Plus size={14} /> Nouveau
              </Button>
            }
          >
            <p className="text-sm text-[var(--text-secondary)] mb-3">
              Créez un nouveau formulaire personnalisé avec des champs texte.
              Les formulaires sont envoyés via un modal Discord.
            </p>
          </SectionCard>

          <div className="mt-8">
            <div className="flex gap-2 border-b border-[var(--border-color)] mb-4">
              <button
                onClick={() => setTab('templates')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === 'templates'
                    ? 'border-[var(--accent)] text-[var(--text-primary)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <FileText size={14} className="inline mr-1.5" />
                Modèles ({templates.length})
              </button>
              <button
                onClick={() => setTab('submissions')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === 'submissions'
                    ? 'border-[var(--accent)] text-[var(--text-primary)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <ClipboardList size={14} className="inline mr-1.5" />
                Réponses ({submissions.length})
              </button>
            </div>

          {tab === 'templates' && (
            <div>
              {templates.length === 0 ? (
                <EmptyState
                  icon={<FileText size={32} />}
                  title="Aucun formulaire"
                  description="Créez votre premier formulaire pour commencer."
                  action={{ label: 'Créer un formulaire', onClick: openCreateTemplate }}
                />
              ) : (
                <ModuleGrid>
                  {templates.map((t) => {
                    let fieldCount = 0;
                    try { fieldCount = JSON.parse(t.fields).length; } catch { }
                    return (
                      <SectionCard key={t.id} title={t.name} description={t.description ?? undefined}>
                        <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)] mb-3">
                          <span>{fieldCount} question{fieldCount > 1 ? 's' : ''}</span>
                          <span>{/* nb réponses - pas disponible directement */}— réponse(s)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditTemplate(t)}>
                            <Edit2 size={12} /> Modifier
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleToggleTemplate(t)}>
                            {t.enabled ? 'Désactiver' : 'Activer'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setTab('submissions'); }}>
                            <Eye size={12} /> Réponses
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteTemplate(t.id)}>
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </SectionCard>
                    );
                  })}
                </ModuleGrid>
              )}
            </div>
          )}

          {tab === 'submissions' && (
            <div className="space-y-4">
              {submissions.length === 0 ? (
                <EmptyState
                  icon={<ClipboardList size={32} />}
                  title="Aucune réponse"
                  description="Les réponses aux formulaires apparaîtront ici en temps réel."
                />
              ) : (
                <>
                  <div className="space-y-3">
                    {submissions.map((sub) => (
                      <div key={sub.id} className="border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-[var(--bg-surface-alt)] flex items-center justify-center text-xs font-semibold text-[var(--text-secondary)]">
                              {sub.user.username?.charAt(0)?.toUpperCase() ?? '?'}
                            </div>
                            <div>
                              <span className="text-sm font-medium text-[var(--text-primary)]">{sub.user.username}</span>
                              <span className="text-xs text-[var(--text-secondary)] ml-2">{sub.templateName}</span>
                              <div className="flex items-center gap-1 mt-0.5">
                                <Clock size={10} className="text-[var(--text-secondary)]" />
                                <span className="text-xs text-[var(--text-secondary)]">{formatDate(sub.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={statusVariants[sub.status] ?? 'warning'}>
                              {statusLabels[sub.status] ?? sub.status}
                            </Badge>
                            <Button variant="ghost" size="sm" onClick={() => setViewSubmission(sub)}>
                              <Eye size={14} />
                            </Button>
                            {sub.status === 'pending' && (
                              <>
                                <Button variant="success" size="sm" loading={actionLoading === sub.id}
                                  onClick={() => handleSubmissionAction(sub.id, 'approved')}>
                                  <CheckCircle size={14} />
                                </Button>
                                <Button variant="danger" size="sm" loading={actionLoading === sub.id}
                                  onClick={() => handleSubmissionAction(sub.id, 'rejected')}>
                                  <XCircle size={14} />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {subTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 pt-2">
                      <Button variant="ghost" size="sm" disabled={subPage <= 1} onClick={() => setSubPage(subPage - 1)}>
                        <ChevronLeft size={14} />
                      </Button>
                      <span className="text-sm text-[var(--text-secondary)]">{subPage} / {subTotalPages}</span>
                      <Button variant="ghost" size="sm" disabled={subPage >= subTotalPages} onClick={() => setSubPage(subPage + 1)}>
                        <ChevronRight size={14} />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          </div>

          {showTemplateModal && (
            <Modal
              open={showTemplateModal}
              onClose={() => setShowTemplateModal(false)}
              title={editingTemplate ? 'Modifier le formulaire' : 'Créer un formulaire'}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">Nom</label>
                  <Input value={templateForm.name} onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Nom du formulaire" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">Description</label>
                  <Input value={templateForm.description} onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Description (optionnel)" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-[var(--text-secondary)]">Champs</label>
                    <Button variant="ghost" size="sm" onClick={addField}>
                      <Plus size={12} /> Ajouter
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {templateForm.fields.map((field, index) => (
                      <div key={index} className="flex items-start gap-2 p-3 bg-[var(--bg-surface-alt)]">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => moveField(index, 'up')}
                            disabled={index === 0}
                            className="p-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            onClick={() => moveField(index, 'down')}
                            disabled={index === templateForm.fields.length - 1}
                            className="p-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ArrowDown size={12} />
                          </button>
                        </div>
                        <div className="flex-1 space-y-2">
                          <Input
                            value={field.label}
                            onChange={(e) => updateField(index, { label: e.target.value })}
                            placeholder="Nom du champ"
                          />
                          <div className="flex items-center gap-2">
                            <select
                              value={field.style}
                              onChange={(e) => updateField(index, { style: e.target.value as FormField['style'] })}
                              className="text-xs bg-[var(--bg-primary)] border border-[var(--border-color)] px-2 py-1 text-[var(--text-primary)]"
                            >
                              <option value="short">Texte court</option>
                              <option value="paragraph">Texte long</option>
                            </select>
                            <label className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) => updateField(index, { required: e.target.checked })}
                              />
                              Requis
                            </label>
                          </div>
                        </div>
                        {templateForm.fields.length > 1 && (
                          <button onClick={() => removeField(index)} className="text-[var(--error)] p-1 hover:opacity-70">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" size="sm" onClick={() => setShowTemplateModal(false)}>Annuler</Button>
                  <Button variant="primary" size="sm" loading={templateSaving} onClick={handleSaveTemplate}>
                    {editingTemplate ? 'Enregistrer' : 'Créer'}
                  </Button>
                </div>
              </div>
            </Modal>
          )}

          {viewSubmission && (
            <Modal
              open={!!viewSubmission}
              onClose={() => setViewSubmission(null)}
              title={`Réponse - ${viewSubmission.templateName}`}
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[var(--bg-surface-alt)] flex items-center justify-center text-xs font-semibold">
                    {viewSubmission.user.username?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">{viewSubmission.user.username}</span>
                    <div className="text-xs text-[var(--text-secondary)]">{formatDate(viewSubmission.createdAt)}</div>
                  </div>
                  <Badge variant={statusVariants[viewSubmission.status] ?? 'warning'}>
                    {statusLabels[viewSubmission.status] ?? viewSubmission.status}
                  </Badge>
                </div>

                <div className="space-y-3">
                  {Array.isArray(viewSubmission.responses) && viewSubmission.responses.map((r: unknown, i: number) => {
                    const response = r as { label?: string; value?: string };
                    return (
                      <div key={i} className="p-3 bg-[var(--bg-surface-alt)]">
                        <div className="text-xs font-semibold text-[var(--text-secondary)] mb-1">{response.label ?? `Champ ${i + 1}`}</div>
                        <div className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{response.value ?? '-'}</div>
                      </div>
                    );
                  })}
                </div>

                {viewSubmission.status === 'pending' && (
                  <div className="flex gap-2 pt-2">
                    <Button variant="success" size="sm" loading={actionLoading === viewSubmission.id}
                      onClick={() => { handleSubmissionAction(viewSubmission.id, 'approved'); setViewSubmission(null); }}>
                      <Check size={14} /> Approuver
                    </Button>
                    <Button variant="danger" size="sm" loading={actionLoading === viewSubmission.id}
                      onClick={() => { handleSubmissionAction(viewSubmission.id, 'rejected'); setViewSubmission(null); }}>
                      <X size={14} /> Rejeter
                    </Button>
                  </div>
                )}
              </div>
            </Modal>
          )}
        </>
      )}
    </PageLayout>
  );
}
