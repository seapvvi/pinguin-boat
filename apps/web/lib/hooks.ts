'use client';

import { useEffect, useRef, useCallback } from 'react';

/** Recharge les données toutes les `intervalMs` millisecondes. */
export function useAutoRefresh(load: () => void | Promise<void>, intervalMs = 10000, deps: unknown[] = []) {
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const tick = () => void loadRef.current();
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);

  }, [intervalMs, ...deps]);
}

/**
 * Refresh silencieux — appelle load(true) pour signaler un background refresh.
 * La fonction load doit accepter un booléen `_silent` et ne pas appeler setLoading(true) si true.
 */
export function useBackgroundRefresh(load: (_silent: boolean) => void | Promise<void>, intervalMs = 10000, deps: unknown[] = []) {
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const id = setInterval(() => void loadRef.current(true), intervalMs);
    return () => clearInterval(id);

  }, [intervalMs, ...deps]);
}

/** Sauvegarde au démontage + toutes les `intervalMs` si `enabled` et données présentes. */
export function useAutoSave<T>(
  data: T | null,
  save: (_d: T) => Promise<void>,
  options?: { intervalMs?: number; enabled?: boolean; debounceMs?: number }
) {
  const { intervalMs = 10000, enabled = true, debounceMs = 750 } = options ?? {};
  const dataRef = useRef(data);
  const saveRef = useRef(save);
  const dirtyRef = useRef(false);

  // anti-parallélisme: on évite de lancer plusieurs saves simultanées
  const savingRef = useRef(false);

  // une sauvegarde “pending” est déclenchée via debounce, puis éventuellement
  // synchronisée sur l’intervalle.
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  dataRef.current = data;
  saveRef.current = save;

  const markClean = useCallback(() => {
    dirtyRef.current = false;
  }, []);

  const runSave = useCallback(async () => {
    if (!enabled || dataRef.current == null) return;
    if (!dirtyRef.current) return;
    if (savingRef.current) return;

    savingRef.current = true;
    try {
      await saveRef.current(dataRef.current);
      dirtyRef.current = false;
    } catch {
      // silencieux — bouton Enregistrer pour erreurs explicites
    } finally {
      savingRef.current = false;
    }
  }, [enabled]);

  // Marque “dirty” uniquement quand la donnée change vers un état non-null.
  // Si data repasse à null/transitoire, on évite de spammer une sauvegarde.
  useEffect(() => {
    if (!enabled) return;
    dirtyRef.current = data != null;
  }, [data, enabled]);

  // Debounce sur les changements
  useEffect(() => {
    if (!enabled) return;
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }

    if (dataRef.current == null) return;

    pendingTimerRef.current = setTimeout(() => {
      pendingTimerRef.current = null;
      void runSave();
    }, debounceMs);

    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
  }, [data, debounceMs, enabled, runSave]);

  // Intervalle: sauvegarde “sûre” mais seulement si dirty
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => void runSave(), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, runSave]);

  // Sauvegarde au démontage (si dirty et data non-null)
  useEffect(() => {
    return () => {
      void runSave();
    };
  }, [runSave]);

  return { markClean };
}

