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
  options?: { intervalMs?: number; enabled?: boolean }
) {
  const { intervalMs = 10000, enabled = true } = options ?? {};
  const dataRef = useRef(data);
  const saveRef = useRef(save);
  dataRef.current = data;
  saveRef.current = save;

  const runSave = useCallback(async () => {
    if (!enabled || dataRef.current == null) return;
    try {
      await saveRef.current(dataRef.current);
    } catch {
      /* silencieux — bouton Enregistrer pour erreurs explicites */
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => void runSave(), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, runSave]);

  useEffect(() => {
    return () => {
      void runSave();
    };
  }, [runSave]);
}
