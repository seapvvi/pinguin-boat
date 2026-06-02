'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight, SkipForward } from 'lucide-react';
import { Button } from '@pinguin/ui';
import { StepLogs } from './steps/StepLogs';
import { StepModRole } from './steps/StepModRole';
import { StepWelcome } from './steps/StepWelcome';
import { StepEconomy } from './steps/StepEconomy';
import { StepTickets } from './steps/StepTickets';
import { StepSource } from './steps/StepSource';
import { api } from '@/lib/api';
import type { OnboardingData } from '@/hooks/useOnboarding';

interface OnboardingModalProps {
  guildId: string;
  open: boolean;
  currentStep: number;
  totalSteps: number;
  data: OnboardingData | null;
  onClose: () => void;
  onSkip: () => void;
  onComplete: () => void;
  onStepChange: (step: number) => void;
  onNextStep: () => void;
  onPrevStep: () => void;
}

const stepLabels = [
  'Salon de logs',
  'Rôle modérateur',
  'Message de bienvenue',
  'Système économique',
  'Système de tickets',
  'Dernière question',
];

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -300 : 300, opacity: 0 }),
};

export function OnboardingModal({
  guildId,
  open,
  currentStep,
  totalSteps,
  data: propData,
  onClose,
  onSkip,
  onComplete,
  onStepChange,
  onNextStep,
  onPrevStep,
}: OnboardingModalProps) {
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState(0);
  const [data, setData] = useState<OnboardingData | null>(null);
  const [selectedSource, setSelectedSource] = useState('');
  const [sourceDetails, setSourceDetails] = useState('');

  useEffect(() => {
    if (propData) {
      setData(propData);
    }
  }, [propData]);

  useEffect(() => {
    if (!open) {
      setShowSkipConfirm(false);
      setSelectedSource('');
      setSourceDetails('');
    }
  }, [open]);

  const progressPercent = ((currentStep + 1) / totalSteps) * 100;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  const saveCurrentStep = async (): Promise<boolean> => {
    if (!data) return false;
    try {
      switch (currentStep) {
        case 0:
          await api.put(`/api/guilds/${guildId}/logs`, { logChannelId: data.logSettings.logChannelId || null });
          break;
        case 1:
          await api.put(`/api/guilds/${guildId}/settings`, { modRoleIds: data.guildSettings.modRoleIds });
          break;
        case 2:
          await api.put(`/api/guilds/${guildId}/welcome`, {
            enabled: data.welcomeSettings.enabled,
            welcomeChannelId: data.welcomeSettings.welcomeChannelId || null,
            welcomeMessage: data.welcomeSettings.welcomeMessage || null,
          });
          break;
        case 3:
          await api.put(`/api/guilds/${guildId}/economy`, {
            enabled: data.economySettings.enabled,
            currencyName: data.economySettings.currencyName,
            currencySymbol: data.economySettings.currencySymbol,
          });
          break;
        case 4:
          await api.patch(`/api/guilds/${guildId}/tickets/settings`, {
            enabled: data.ticketSettings.enabled,
            logChannelId: data.ticketSettings.logChannelId || null,
            panelMessage: data.ticketSettings.panelMessage,
          });
          break;
      }
      return true;
    } catch {
      return false;
    }
  };

  const handleNext = async () => {
    setSaving(true);
    await saveCurrentStep();
    setSaving(false);
    setDirection(1);
    onNextStep();
  };

  const handlePrev = () => {
    setDirection(-1);
    onPrevStep();
  };

  const handleSkipCross = () => {
    setShowSkipConfirm(true);
  };

  const confirmSkip = () => {
    setShowSkipConfirm(false);
    onSkip();
  };

  const saveSourceAndFinish = async () => {
    if (selectedSource) {
      await api.post('/api/onboarding/source', {
        guildId,
        source: selectedSource,
        details: sourceDetails || undefined,
      }).catch(() => {});
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    const promises = [];
    if (data) {
      promises.push(
        api.put(`/api/guilds/${guildId}/logs`, { logChannelId: data.logSettings.logChannelId || null }).catch(() => {}),
        api.put(`/api/guilds/${guildId}/settings`, { modRoleIds: data.guildSettings.modRoleIds || [] }).catch(() => {}),
        api.put(`/api/guilds/${guildId}/welcome`, {
          enabled: data.welcomeSettings.enabled,
          welcomeChannelId: data.welcomeSettings.welcomeChannelId || null,
          welcomeMessage: data.welcomeSettings.welcomeMessage || null,
        }).catch(() => {}),
        api.put(`/api/guilds/${guildId}/economy`, {
          enabled: data.economySettings.enabled,
          currencyName: data.economySettings.currencyName,
          currencySymbol: data.economySettings.currencySymbol,
        }).catch(() => {}),
        api.patch(`/api/guilds/${guildId}/tickets/settings`, {
          enabled: data.ticketSettings.enabled,
          logChannelId: data.ticketSettings.logChannelId || null,
          panelMessage: data.ticketSettings.panelMessage,
        }).catch(() => {}),
      );
    }
    await Promise.all(promises);
    await saveSourceAndFinish();
    onComplete();
    setSaving(false);
  };

  if (!data) return null;

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <StepLogs
            logChannelId={data.logSettings.logChannelId}
            channels={data.channels}
            onChange={(id) => setData({ ...data, logSettings: { ...data.logSettings, logChannelId: id } })}
          />
        );
      case 1:
        return (
          <StepModRole
            modRoleId={data.guildSettings.modRoleIds[0] || ''}
            roles={data.roles}
            onChange={(id) => setData({ ...data, guildSettings: { ...data.guildSettings, modRoleIds: id ? [id] : [] } })}
          />
        );
      case 2:
        return (
          <StepWelcome
            enabled={data.welcomeSettings.enabled}
            welcomeChannelId={data.welcomeSettings.welcomeChannelId}
            welcomeMessage={data.welcomeSettings.welcomeMessage}
            channels={data.channels}
            onEnabledChange={(v) => setData({ ...data, welcomeSettings: { ...data.welcomeSettings, enabled: v } })}
            onChannelChange={(id) => setData({ ...data, welcomeSettings: { ...data.welcomeSettings, welcomeChannelId: id } })}
            onMessageChange={(msg) => setData({ ...data, welcomeSettings: { ...data.welcomeSettings, welcomeMessage: msg } })}
          />
        );
      case 3:
        return (
          <StepEconomy
            enabled={data.economySettings.enabled}
            currencyName={data.economySettings.currencyName}
            currencySymbol={data.economySettings.currencySymbol}
            onEnabledChange={(v) => setData({ ...data, economySettings: { ...data.economySettings, enabled: v } })}
            onCurrencyNameChange={(name) => setData({ ...data, economySettings: { ...data.economySettings, currencyName: name } })}
            onCurrencySymbolChange={(sym) => setData({ ...data, economySettings: { ...data.economySettings, currencySymbol: sym } })}
          />
        );
      case 4:
        return (
          <StepTickets
            enabled={data.ticketSettings.enabled}
            logChannelId={data.ticketSettings.logChannelId}
            panelMessage={data.ticketSettings.panelMessage}
            channels={data.channels}
            onEnabledChange={(v) => setData({ ...data, ticketSettings: { ...data.ticketSettings, enabled: v } })}
            onLogChannelChange={(id) => setData({ ...data, ticketSettings: { ...data.ticketSettings, logChannelId: id } })}
            onPanelMessageChange={(msg) => setData({ ...data, ticketSettings: { ...data.ticketSettings, panelMessage: msg } })}
          />
        );
      case 5:
        return (
          <StepSource
            selectedSource={selectedSource}
            details={sourceDetails}
            onSourceChange={setSelectedSource}
            onDetailsChange={setSourceDetails}
          />
        );
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          />

          <div className="fixed inset-0 z-[61] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="relative w-full max-w-xl bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-[var(--radius)] shadow-xl overflow-hidden"
            >
              {showSkipConfirm ? (
                <div className="p-6">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
                    Passer l'onboarding ?
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    Êtes-vous sûr de vouloir passer l'onboarding ? Vous pouvez y revenir depuis les Settings.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <Button variant="secondary" onClick={() => setShowSkipConfirm(false)}>
                      Annuler
                    </Button>
                    <Button variant="danger" onClick={confirmSkip}>
                      Passer
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-6 pb-0">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                        Bienvenue sur Pinguin !
                      </h2>
                      <button
                        onClick={handleSkipCross}
                        className="flex items-center justify-center w-6 h-6 rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-[var(--text-secondary)]">
                          Étape {currentStep + 1} sur {totalSteps}
                        </span>
                        <span className="text-xs text-[var(--text-secondary)]">
                          {stepLabels[currentStep]}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[var(--bg-surface-alt)] rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-[var(--accent)] rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPercent}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-4 min-h-[200px]">
                    <AnimatePresence mode="wait" custom={direction}>
                      <motion.div
                        key={currentStep}
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                      >
                        {renderStep()}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-surface-alt)]/50">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePrev}
                      disabled={isFirstStep}
                    >
                      <ChevronLeft size={14} className="mr-1" />
                      Précédent
                    </Button>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSkipCross}
                      >
                        <SkipForward size={14} className="mr-1" />
                        Passer cette étape
                      </Button>

                      {isLastStep ? (
                        <Button
                          size="sm"
                          onClick={handleFinish}
                          loading={saving}
                        >
                          Terminer
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={handleNext}
                          loading={saving}
                        >
                          Suivant
                          <ChevronRight size={14} className="ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
