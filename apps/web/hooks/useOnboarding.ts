'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

export interface OnboardingData {
  guildSettings: {
    onboardingDone: boolean;
    modRoleIds: string[];
  };
  logSettings: {
    logChannelId: string | null;
  };
  welcomeSettings: {
    enabled: boolean;
    welcomeChannelId: string | null;
    welcomeMessage: string | null;
  };
  economySettings: {
    enabled: boolean;
    currencyName: string;
    currencySymbol: string;
  };
  ticketSettings: {
    enabled: boolean;
    logChannelId: string | null;
    panelMessage: string;
  };
  channels: { id: string; name: string }[];
  roles: { id: string; name: string }[];
}

interface OnboardingState {
  open: boolean;
  currentStep: number;
  totalSteps: number;
  data: OnboardingData | null;
  loading: boolean;
  error: string | null;
}

export function useOnboarding(guildId: string) {
  const [state, setState] = useState<OnboardingState>({
    open: false,
    currentStep: 0,
    totalSteps: 6,
    data: null,
    loading: false,
    error: null,
  });

  const checkOnboardingStatus = useCallback(async () => {
    if (!guildId || typeof window === 'undefined') return;
    try {
      const cookieKey = `onboarding_done_${guildId}`;
      const hasCookie = document.cookie.split('; ').some((c) => c.startsWith(`${cookieKey}=true`));
      if (hasCookie) return;

      const res = await api.get<any>(`/api/guilds/${guildId}`);
      if (res.success && res.data) {
        const guild = res.data.guild || res.data;
        const settings = guild.settings || guild;
        if (settings?.onboardingDone) return;
      }

      const onboardingRes = await api.get<any>(`/api/guilds/${guildId}/onboarding-data`);
      if (onboardingRes.success && onboardingRes.data) {
        setState((s) => ({
          ...s,
          open: true,
          data: onboardingRes.data as OnboardingData,
        }));
      }
    } catch {
      // Silent fail — l'onboarding ne s'affiche pas en cas d'erreur
    }
  }, [guildId]);

  const openOnboarding = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const onboardingRes = await api.get<any>(`/api/guilds/${guildId}/onboarding-data`);
      if (onboardingRes.success && onboardingRes.data) {
        setState((s) => ({
          ...s,
          open: true,
          currentStep: 0,
          data: onboardingRes.data as OnboardingData,
          loading: false,
        }));
      }
    } catch {
      setState((s) => ({ ...s, loading: false, error: 'Impossible de charger les données' }));
    }
  }, [guildId]);

  const closeOnboarding = useCallback(() => {
    setState((s) => ({ ...s, open: false, currentStep: 0 }));
  }, []);

  const skipOnboarding = useCallback(async () => {
    try {
      await api.patch(`/api/guilds/${guildId}/settings/onboarding-done`);
    } catch {
      // Échec silencieux — le cookie sera utilisé comme fallback
    }
    if (typeof window !== 'undefined') {
      document.cookie = `onboarding_done_${guildId}=true; path=/; max-age=31536000`;
    }
    setState((s) => ({ ...s, open: false, currentStep: 0 }));
  }, [guildId]);

  const completeOnboarding = useCallback(async () => {
    try {
      await api.patch(`/api/guilds/${guildId}/settings/onboarding-done`);
    } catch {
      // Échec silencieux
    }
    if (typeof window !== 'undefined') {
      document.cookie = `onboarding_done_${guildId}=true; path=/; max-age=31536000`;
    }
    setState((s) => ({ ...s, open: false, currentStep: 0 }));
  }, [guildId]);

  const setStep = useCallback((step: number) => {
    setState((s) => ({ ...s, currentStep: Math.max(0, Math.min(step, s.totalSteps - 1)) }));
  }, []);

  const nextStep = useCallback(() => {
    setState((s) => ({ ...s, currentStep: Math.min(s.currentStep + 1, s.totalSteps - 1) }));
  }, []);

  const prevStep = useCallback(() => {
    setState((s) => ({ ...s, currentStep: Math.max(s.currentStep - 1, 0) }));
  }, []);

  const updateData = useCallback((partial: Partial<OnboardingData>) => {
    setState((s) => ({
      ...s,
      data: s.data ? { ...s.data, ...partial } : null,
    }));
  }, []);

  return {
    ...state,
    checkOnboardingStatus,
    openOnboarding,
    closeOnboarding,
    skipOnboarding,
    completeOnboarding,
    setStep,
    nextStep,
    prevStep,
    updateData,
  };
}
