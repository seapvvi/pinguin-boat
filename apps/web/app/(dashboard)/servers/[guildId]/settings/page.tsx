'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Save, RotateCcw, LogOut, Trash2, RefreshCw, Download, Upload,
  AlertTriangle,
} from 'lucide-react';
import { Button, Input, Select, Skeleton, Modal } from '@pinguin/ui';
import { api } from '@/lib/api';
import { DiscordSelect } from '@/components/DiscordSelect';
import { ModulePermissions } from '@/components/settings/ModulePermissions';
import { useOnboarding } from '@/hooks/useOnboarding';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { PageLayout, SectionCard, ModuleGrid } from '@/components/layout';
import type { APIResponse } from '@pinguin/shared';

interface GuildPayload {
  name?: string;
  locale?: string;
  settings?: { locale?: string; timezone?: string; modLogChannel?: string; muteRoleId?: string };
  timezone?: string;
  modLogChannelId?: string;
  muteRoleId?: string;
  dashboardAccessRoles?: string[];
  dashboardModerationAccess?: string[];
  dashboardTicketsAccess?: string[];
  dashboardPollsAccess?: string[];
  dashboardSuggestionsAccess?: string[];
  dashboardGiveawaysAccess?: string[];
  dashboardEconomyAccess?: string[];
  dashboardMusicAccess?: string[];
  dashboardLevelsAccess?: string[];
  dashboardWelcomeAccess?: string[];
  dashboardAutorolesAccess?: string[];
  dashboardLogsAccess?: string[];
  dashboardProtectionAccess?: string[];
  dashboardAuditAccess?: string[];
  guild?: {
    name?: string;
    locale?: string;
    settings?: { locale?: string; timezone?: string; modLogChannel?: string; muteRoleId?: string };
    timezone?: string;
    modLogChannelId?: string;
    muteRoleId?: string;
    dashboardAccessRoles?: string[];
    dashboardModerationAccess?: string[];
    dashboardTicketsAccess?: string[];
    dashboardPollsAccess?: string[];
    dashboardSuggestionsAccess?: string[];
    dashboardGiveawaysAccess?: string[];
    dashboardEconomyAccess?: string[];
    dashboardMusicAccess?: string[];
    dashboardLevelsAccess?: string[];
    dashboardWelcomeAccess?: string[];
    dashboardAutorolesAccess?: string[];
    dashboardLogsAccess?: string[];
    dashboardProtectionAccess?: string[];
    dashboardAuditAccess?: string[];
  };
}

interface DashboardSettings {
  locale?: string;
  timezone?: string;
  modLogChannelId?: string;
  muteRoleId?: string;
  dashboardAccessRoles?: string[];
  dashboardModerationAccess?: string[];
  dashboardTicketsAccess?: string[];
  dashboardPollsAccess?: string[];
  dashboardSuggestionsAccess?: string[];
  dashboardGiveawaysAccess?: string[];
  dashboardEconomyAccess?: string[];
  dashboardMusicAccess?: string[];
  dashboardLevelsAccess?: string[];
  dashboardWelcomeAccess?: string[];
  dashboardAutorolesAccess?: string[];
  dashboardLogsAccess?: string[];
  dashboardProtectionAccess?: string[];
  dashboardAuditAccess?: string[];
}

const LANGUAGES = [
  { value: 'fr', label: 'Français', native: 'Français', ready: true },
  { value: 'en', label: 'English', native: 'English', ready: true },
  { value: 'es', label: 'Español', native: 'Español', ready: false },
  { value: 'de', label: 'Deutsch', native: 'Deutsch', ready: false },
  { value: 'pt', label: 'Português', native: 'Português', ready: false },
  { value: 'it', label: 'Italiano', native: 'Italiano', ready: false },
  { value: 'nl', label: 'Nederlands', native: 'Nederlands', ready: false },
  { value: 'pl', label: 'Polski', native: 'Polski', ready: false },
  { value: 'ru', label: 'Русский', native: 'Русский', ready: false },
  { value: 'ja', label: '日本語', native: '日本語', ready: false },
  { value: 'ko', label: '한국어', native: '한국어', ready: false },
  { value: 'zh', label: '中文', native: '中文', ready: false },
];

const IMPORT_MODULES = [
  { key: 'settings', label: 'Paramètres généraux' },
  { key: 'modulesEnabled', label: 'Modules activés' },
  { key: 'logSettings', label: 'Logs' },
  { key: 'xpSettings', label: 'Niveaux / XP' },
  { key: 'welcomeSettings', label: 'Bienvenue' },
  { key: 'economySettings', label: 'Économie' },
  { key: 'protectionSettings', label: 'Protection' },
  { key: 'autoroleSettings', label: 'Auto-rôles' },
  { key: 'autoModSettings', label: 'Auto-modération' },
  { key: 'ticketSettings', label: 'Tickets' },
];

export default function GuildSettingsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const router = useRouter();
  const [settings, setSettings] = useState<DashboardSettings | null>(null);
  const [guildName, setGuildName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dangerModal, setDangerModal] = useState<'reset' | 'leave' | 'delete' | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [dangerLoading, setDangerLoading] = useState(false);

  const [exporting, setExporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importData, setImportData] = useState<{ version: string; guildId: string; settings: Record<string, unknown> } | null>(null);
  const [importModules, setImportModules] = useState<string[]>([]);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importError, setImportError] = useState('');
  const [importWarning, setImportWarning] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    api.get<APIResponse<GuildPayload>>(`/api/guilds/${guildId}`)
      .then((res) => {
        if (res.success && res.data) {
          const d = res.data;
          const guild = (d.guild ?? d) as GuildPayload;
          const s: DashboardSettings = {
            locale: guild.locale ?? guild.settings?.locale ?? 'fr',
            timezone: guild.timezone ?? guild.settings?.timezone ?? 'Europe/Paris',
            modLogChannelId: guild.modLogChannelId ?? guild.settings?.modLogChannel ?? '',
            muteRoleId: guild.muteRoleId ?? guild.settings?.muteRoleId ?? '',
            dashboardAccessRoles: guild.dashboardAccessRoles ?? [],
            dashboardModerationAccess: guild.dashboardModerationAccess ?? [],
            dashboardTicketsAccess: guild.dashboardTicketsAccess ?? [],
            dashboardPollsAccess: guild.dashboardPollsAccess ?? [],
            dashboardSuggestionsAccess: guild.dashboardSuggestionsAccess ?? [],
            dashboardGiveawaysAccess: guild.dashboardGiveawaysAccess ?? [],
            dashboardEconomyAccess: guild.dashboardEconomyAccess ?? [],
            dashboardMusicAccess: guild.dashboardMusicAccess ?? [],
            dashboardLevelsAccess: guild.dashboardLevelsAccess ?? [],
            dashboardWelcomeAccess: guild.dashboardWelcomeAccess ?? [],
            dashboardAutorolesAccess: guild.dashboardAutorolesAccess ?? [],
            dashboardLogsAccess: guild.dashboardLogsAccess ?? [],
            dashboardProtectionAccess: guild.dashboardProtectionAccess ?? [],
            dashboardAuditAccess: guild.dashboardAuditAccess ?? [],
          };
          setSettings(s);
          setGuildName(guild.name ?? '');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [guildId]);

  const onboarding = useOnboarding(guildId);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    try {
      await api.put(`/api/guilds/${guildId}`, { guild: settings });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const updateModulePermission = (module: string, roleIds: string[]) => {
    setSettings((s) => {
      if (!s) return s;
      const field = `dashboard${module.charAt(0).toUpperCase() + module.slice(1)}Access` as keyof DashboardSettings;
      return { ...s, [field]: roleIds };
    });
  };

  const runDanger = async () => {
    if (confirmName !== guildName) return;
    setDangerLoading(true);
    try {
      if (dangerModal === 'reset') {
        await api.post(`/api/guilds/${guildId}/settings/reset`, { confirmName });
      } else if (dangerModal === 'leave') {
        await api.post(`/api/guilds/${guildId}/settings/leave`, {});
        router.push('/servers');
      } else if (dangerModal === 'delete') {
        await api.post(`/api/guilds/${guildId}/settings/delete-data`, { confirmName });
        router.push('/servers');
      }
      setDangerModal(null);
      setConfirmName('');
    } finally {
      setDangerLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get<APIResponse<Record<string, unknown>>>(`/api/guilds/${guildId}/settings/export`);
      if (res.success && res.data) {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `guild-config-${guildName.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Erreur lors de l\'export');
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512_000) {
      setImportError('Fichier trop volumineux. Maximum: 500 KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.version || !data.guildId || !data.settings) {
          setImportError('Format de fichier invalide. Utilisez un fichier exporté depuis ce dashboard.');
          return;
        }
        setImportData(data);
        setImportModules(IMPORT_MODULES.map((m) => m.key));
        setImportWarning(
          'Les IDs de rôles et salons dans la config exportée appartiennent au serveur d\'origine. ' +
          'Ils seront importés tels quels. Vérifiez chaque paramètre après l\'import. ' +
          'Les données dynamiques (portefeuilles, XP, tickets ouverts) ne sont pas importées.'
        );
        setImportError('');
        setImportModalOpen(true);
      } catch {
        setImportError('Fichier JSON invalide');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!importData || importModules.length === 0) return;
    setImporting(true);
    setImportError('');
    try {
      const res = await api.post(`/api/guilds/${guildId}/settings/import`, {
        exportData: importData,
        modules: importModules,
      });
      if (res.success) {
        setImportModalOpen(false);
        setImportData(null);
        setImportModules([]);
        window.location.reload();
      }
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Erreur lors de l\'import');
    } finally {
      setImporting(false);
    }
  };

  const toggleImportModule = (key: string) => {
    setImportModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const modulePerms: Record<string, string[]> = {};
  for (const mod of ['moderation', 'tickets', 'polls', 'suggestions', 'giveaways', 'economy', 'music', 'levels', 'welcome', 'autoroles', 'logs', 'protection', 'audit']) {
    const field = `dashboard${mod.charAt(0).toUpperCase() + mod.slice(1)}Access` as keyof DashboardSettings;
    const val = settings?.[field];
    modulePerms[mod] = Array.isArray(val) ? val : [];
  }

  return (
    <PageLayout
      title="Paramètres du serveur"
      actions={
        <Button onClick={handleSave} loading={saving}>
          {saved ? '✓ Enregistré' : <><Save className="w-4 h-4 mr-2" />Enregistrer</>}
        </Button>
      }
    >
      <ModuleGrid>
        <SectionCard title="Configuration générale">
          <div>
            <Select
              label="Langue du serveur"
              value={settings?.locale || 'fr'}
              onChange={(e) => setSettings((s) => ({ ...s, locale: e.target.value }))}
              options={LANGUAGES.map((l) => ({
                value: l.value,
                label: l.ready ? `${l.native} (${l.label})` : `${l.native} — Bientôt disponible`,
              }))}
            />
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Le bot utilisera cette langue pour ses réponses sur ce serveur.
            </p>
          </div>

          <div className="mt-4">
            <Input
              label="Fuseau horaire"
              value={settings?.timezone || 'Europe/Paris'}
              onChange={(e) => setSettings((s) => ({ ...s, timezone: e.target.value }))}
            />
          </div>
        </SectionCard>

        <SectionCard title="Modération">
          <DiscordSelect
            type="channel"
            guildId={guildId}
            label="Salon des logs de modération"
            value={settings?.modLogChannelId || ''}
            onChange={(id) => setSettings((s) => ({ ...s, modLogChannelId: id }))}
          />
          <div className="mt-4">
            <DiscordSelect
              type="role"
              guildId={guildId}
              label="Rôle muet"
              value={settings?.muteRoleId || ''}
              onChange={(id) => setSettings((s) => ({ ...s, muteRoleId: id }))}
            />
          </div>
        </SectionCard>
      </ModuleGrid>

      <SectionCard title="Accès au dashboard" description="Configurez les rôles qui auront accès au dashboard de ce serveur. Par défaut, seul le propriétaire du serveur et les administrateurs Discord ont accès complet.">
        <DiscordSelect
          type="role"
          guildId={guildId}
          label="Rôle avec accès complet au dashboard"
          value={settings?.dashboardAccessRoles?.[0] || ''}
          onChange={(id) => setSettings((s) => ({ ...s, dashboardAccessRoles: id ? [id] : [] }))}
          placeholder="Sélectionner un rôle (optionnel)"
        />
        <p className="text-xs text-[var(--text-secondary)] mt-2">
          Les membres ayant ce rôle pourront accéder à l&apos;intégralité du dashboard de ce serveur, même sans être administrateur Discord.
        </p>
      </SectionCard>

      <SectionCard title="Permissions par module">
        <ModulePermissions
          guildId={guildId}
          values={modulePerms}
          onChange={updateModulePermission}
        />
      </SectionCard>

      <ModuleGrid>
        <SectionCard title="Export / Import de la configuration" description="Exportez toute la configuration du serveur en JSON ou importez une configuration depuis un autre serveur.">
          {importError && (
            <div className="flex items-center gap-2 text-sm text-[var(--error)] bg-[var(--error)]/10 px-3 py-2 mb-3">
              <AlertTriangle size={14} />
              {importError}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleExport} loading={exporting}>
              <Download className="w-4 h-4 mr-2" /> Exporter la config
            </Button>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" /> Importer une config
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          <p className="text-xs text-[var(--text-secondary)] mt-2">
            L&apos;export inclut tous les paramètres mais pas les données dynamiques (portefeuilles, XP, tickets ouverts, logs).
          </p>
        </SectionCard>

        <SectionCard title="Onboarding" description="Relancez l&apos;onboarding pour reconfigurer rapidement les paramètres essentiels du serveur.">
          <Button onClick={() => onboarding.openOnboarding()} loading={onboarding.loading}>
            <RefreshCw className="w-4 h-4 mr-2" /> Relancer l&apos;onboarding
          </Button>
        </SectionCard>
      </ModuleGrid>

      <SectionCard
        title="Zone de danger"
        description="Actions irréversibles — confirmation par le nom du serveur requise."
        accent="#ef4444"
      >
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Button variant="danger" onClick={() => setDangerModal('reset')} className="w-full">
              <RotateCcw className="w-4 h-4 mr-2" /> Réinitialiser
            </Button>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Remet à zéro toute la configuration du serveur.</p>
          </div>
          <div className="flex-1">
            <Button variant="danger" onClick={() => setDangerModal('leave')} className="w-full">
              <LogOut className="w-4 h-4 mr-2" /> Expulser le bot
            </Button>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Retire le bot du serveur définitivement.</p>
          </div>
          <div className="flex-1">
            <Button variant="danger" onClick={() => setDangerModal('delete')} className="w-full">
              <Trash2 className="w-4 h-4 mr-2" /> Supprimer les données
            </Button>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Efface toutes les données stockées pour ce serveur.</p>
          </div>
        </div>
      </SectionCard>

      <Modal
        open={importModalOpen}
        onClose={() => { setImportModalOpen(false); setImportError(''); }}
        title="Importer la configuration"
      >
        {importWarning && (
          <div className="flex items-start gap-2 text-sm text-[var(--warning)] bg-[var(--warning)]/10 px-3 py-2 mb-4">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{importWarning}</span>
          </div>
        )}

        <p className="text-sm text-[var(--text-secondary)] mb-3">
          Sélectionnez les modules à importer :
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {IMPORT_MODULES.map((mod) => (
            <label
              key={mod.key}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-surface-alt)] transition-colors"
            >
              <input
                type="checkbox"
                checked={importModules.includes(mod.key)}
                onChange={() => toggleImportModule(mod.key)}
                className="accent-[var(--accent)]"
              />
              <span className="text-[var(--text-primary)]">{mod.label}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-2">
          <Button onClick={handleImport} loading={importing} disabled={importModules.length === 0}>
            <Upload className="w-4 h-4 mr-2" /> Confirmer l&apos;import
          </Button>
          <Button variant="secondary" onClick={() => { setImportModalOpen(false); setImportError(''); }}>
            Annuler
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!dangerModal}
        onClose={() => { setDangerModal(null); setConfirmName(''); }}
        title="Confirmer l'action"
      >
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Tapez <strong>{guildName}</strong> pour confirmer.
        </p>
        <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={guildName} />
        <div className="flex gap-2 mt-4">
          <Button variant="danger" onClick={runDanger} loading={dangerLoading} disabled={confirmName !== guildName}>
            Confirmer
          </Button>
          <Button variant="secondary" onClick={() => setDangerModal(null)}>Annuler</Button>
        </div>
      </Modal>

      <OnboardingModal
        guildId={guildId}
        open={onboarding.open}
        currentStep={onboarding.currentStep}
        totalSteps={onboarding.totalSteps}
        data={onboarding.data}
        onClose={onboarding.skipOnboarding}
        onSkip={onboarding.skipOnboarding}
        onComplete={onboarding.completeOnboarding}
        onStepChange={onboarding.setStep}
        onNextStep={onboarding.nextStep}
        onPrevStep={onboarding.prevStep}
      />
    </PageLayout>
  );
}
