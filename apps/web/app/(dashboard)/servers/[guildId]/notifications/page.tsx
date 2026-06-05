'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import { Trash2, Plus, Video, Radio, Palette, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, Button, Badge, Skeleton, Select, Input, Toggle } from '@pinguin/ui';
import { ErrorMessage } from '@pinguin/ui';
import { fetchStreamNotifications, createStreamNotification, updateStreamNotification, deleteStreamNotification } from '@/lib/api';
import type { StreamNotification } from '@pinguin/shared';
import { ModuleToggle } from '@/components/ModuleToggle';
import { PermissionGate } from '@/components/PermissionGate';
import { DiscordSelect } from '@/components/DiscordSelect';

export default function NotificationsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<StreamNotification[]>([]);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, Partial<StreamNotification>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const [newPlatform, setNewPlatform] = useState<'TWITCH' | 'YOUTUBE'>('TWITCH');
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelId, setNewChannelId] = useState('');
  const [newDiscordChannelId, setNewDiscordChannelId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchStreamNotifications(guildId);
      if (res.success && res.data) {
        setNotifications(res.data.notifications || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newChannelName || !newDiscordChannelId) {
      setAddError('Veuillez remplir tous les champs requis');
      return;
    }
    setSaving(true);
    setAddError(null);
    try {
      await createStreamNotification(guildId, {
        platform: newPlatform,
        channelName: newChannelName,
        channelId: newChannelId || undefined,
        discordChannelId: newDiscordChannelId,
      });
      setNewChannelName('');
      setNewChannelId('');
      setNewDiscordChannelId('');
      setShowAddForm(false);
      await load();
    } catch (e: any) {
      setAddError(e?.message || 'Erreur lors de l\'ajout');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette notification ?')) return;
    try {
      await deleteStreamNotification(guildId, id);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la suppression');
    }
  };

  const handleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      const notif = notifications.find(n => n.id === id);
      if (notif) {
        setEditValues(prev => ({
          ...prev,
          [id]: {
            customTitle: notif.customTitle ?? '',
            customDescription: notif.customDescription ?? '',
            customColor: notif.customColor ?? '#9146ff',
            customFooter: notif.customFooter ?? '',
            mentionRoleId: notif.mentionRoleId ?? '',
            pingEveryoneOnLive: notif.pingEveryoneOnLive,
          },
        }));
      }
    }
  };

  const handleEditChange = (id: string, field: string, value: any) => {
    setEditValues(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleSaveCustomization = async (id: string) => {
    setSavingId(id);
    try {
      const vals = editValues[id];
      await updateStreamNotification(guildId, id, {
        customTitle: vals.customTitle || null,
        customDescription: vals.customDescription || null,
        customColor: vals.customColor || null,
        customFooter: vals.customFooter || null,
        mentionRoleId: vals.mentionRoleId || null,
        pingEveryoneOnLive: vals.pingEveryoneOnLive ?? false,
      });
      setExpandedId(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSavingId(null);
    }
  };

  const getPlatformIcon = (platform: string) => {
    return platform === 'TWITCH' ? <Radio size={16} className="text-purple-500" /> : <Video size={16} className="text-red-500" />;
  };

  const getPlatformLabel = (platform: string) => {
    return platform === 'TWITCH' ? 'Twitch' : 'YouTube';
  };

  if (error) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <ErrorMessage title="Erreur" message={error} onRetry={load} />
      </motion.div>
    );
  }

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-[var(--radius)]" />
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Notifications de stream</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Gérez les notifications de live Twitch et YouTube.</p>
        </div>
      </div>

      <PermissionGate permission="manageGuild">
        <div className="mb-4">
          <ModuleToggle guildId={guildId} moduleKey="notifications" label="Notifications" />
        </div>

        <Card className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Ajouter un streamer</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus size={16} className={showAddForm ? 'rotate-45' : ''} />
              {showAddForm ? 'Fermer' : 'Ajouter'}
            </Button>
          </div>

          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">Plateforme</label>
                <Select
                  value={newPlatform}
                  onChange={(e) => setNewPlatform(e.target.value as 'TWITCH' | 'YOUTUBE')}
                  options={[
                    { value: 'TWITCH', label: 'Twitch' },
                    { value: 'YOUTUBE', label: 'YouTube' },
                  ]}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">Nom du streamer</label>
                <Input
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder={newPlatform === 'TWITCH' ? 'ex: xQc' : 'ex: MrBeast'}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] tracking-wide uppercase block mb-1.5">ID du canal (optionnel)</label>
                <Input
                  value={newChannelId}
                  onChange={(e) => setNewChannelId(e.target.value)}
                  placeholder={newPlatform === 'TWITCH' ? 'ex: 123456789' : 'ex: UCxxxxxxxxxxxxxxxxxxxxxxx'}
                />
              </div>

              <DiscordSelect
                type="channel"
                guildId={guildId}
                label="Salon Discord"
                value={newDiscordChannelId}
                onChange={(id) => setNewDiscordChannelId(id)}
                channelTypes={[0]}
              />

              {addError && <div className="text-sm text-[var(--error)] bg-[var(--error-bg)] p-2 rounded">{addError}</div>}

              <Button onClick={handleAdd} loading={saving} className="w-full">
                Ajouter la notification
              </Button>
            </motion.div>
          )}
        </Card>

        {notifications.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <Video size={48} className="mx-auto text-[var(--text-secondary)] mb-4" />
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">Aucune notification configurée</h3>
              <p className="text-sm text-[var(--text-secondary)] mb-4">Ajoutez votre premier streamer pour recevoir des notifications de live.</p>
              <Button onClick={() => setShowAddForm(true)}>
                <Plus size={16} className="mr-2" />
                Ajouter un streamer
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const isExpanded = expandedId === notification.id;
              const vals = editValues[notification.id];
              return (
                <Card key={notification.id}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-[var(--bg-surface-alt)]">
                        {getPlatformIcon(notification.platform)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--text-primary)]">{notification.channelName}</span>
                          <Badge variant="info">{getPlatformLabel(notification.platform)}</Badge>
                          {notification.isLive && (
                            <Badge variant="success">En live</Badge>
                          )}
                        </div>
                        <div className="text-sm text-[var(--text-secondary)]">
                          Notifications vers #{notification.discordChannelId}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExpand(notification.id)}
                      >
                        <Palette size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(notification.id)}
                      >
                        <Trash2 size={16} className="text-[var(--error)]" />
                      </Button>
                    </div>
                  </div>

                  {isExpanded && vals && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 pt-4 border-t border-[var(--border-color)] space-y-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Palette size={14} className="text-[var(--text-secondary)]" />
                        <span className="text-sm font-medium text-[var(--text-primary)]">Personnaliser l'embed</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="Titre personnalisé"
                          value={vals.customTitle ?? ''}
                          onChange={(e) => handleEditChange(notification.id, 'customTitle', e.target.value)}
                          placeholder="{streamer} est en live !"
                          helperText="Disponible : {streamer}, {game}, {title}"
                        />

                        <Input
                          label="Couleur"
                          type="color"
                          value={vals.customColor ?? '#9146ff'}
                          onChange={(e) => handleEditChange(notification.id, 'customColor', e.target.value)}
                          className="h-10 p-1"
                        />
                      </div>

                      <div>
                        <Input
                          label="Description personnalisée"
                          value={vals.customDescription ?? ''}
                          onChange={(e) => handleEditChange(notification.id, 'customDescription', e.target.value)}
                          placeholder="{streamer} joue à {game} — {title}"
                          helperText="Disponible : {streamer}, {game}, {title}"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="Footer personnalisé"
                          value={vals.customFooter ?? ''}
                          onChange={(e) => handleEditChange(notification.id, 'customFooter', e.target.value)}
                          placeholder="Propulsé par Pinguin"
                        />

                        <DiscordSelect
                          type="role"
                          guildId={guildId}
                          label="Rôle à mentionner"
                          value={vals.mentionRoleId ?? ''}
                          onChange={(id) => handleEditChange(notification.id, 'mentionRoleId', id)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Toggle
                          checked={vals.pingEveryoneOnLive ?? false}
                          onChange={(checked) => handleEditChange(notification.id, 'pingEveryoneOnLive', checked)}
                          label="Ping @everyone en live"
                        />
                      </div>

                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedId(null)}
                        >
                          Annuler
                        </Button>
                        <Button
                          size="sm"
                          loading={savingId === notification.id}
                          onClick={() => handleSaveCustomization(notification.id)}
                        >
                          Sauvegarder
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </PermissionGate>
    </motion.div>
  );
}
