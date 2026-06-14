interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const MAX_CACHE_SIZE = 500;
const store = new Map<string, CacheEntry<any>>();

export function getCache<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache<T>(key: string, data: T, ttlMs: number): void {
  // TODO: Remplacer par Redis ou un cache distribué avant déploiement multi-instance
  if (store.size >= MAX_CACHE_SIZE) {
    const oldestKey = store.keys().next().value;
    if (oldestKey) store.delete(oldestKey);
  }
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidateCache(pattern: string): void {
  for (const key of store.keys()) {
    if (key.includes(pattern)) store.delete(key);
  }
}
