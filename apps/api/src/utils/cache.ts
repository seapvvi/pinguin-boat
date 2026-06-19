interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const MAX_CACHE_SIZE = 500;
const store = new Map<string, CacheEntry<any>>();

export function get<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.data as T;
}

export function set<T>(key: string, value: T, ttlSeconds: number): void {
  if (store.size >= MAX_CACHE_SIZE) {
    const oldestKey = store.keys().next().value;
    if (oldestKey) store.delete(oldestKey);
  }
  store.set(key, { data: value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function del(key: string): void {
  store.delete(key);
}

export function invalidateCache(pattern: string): void {
  for (const key of store.keys()) {
    if (key.includes(pattern)) store.delete(key);
  }
}

/** @deprecated Use `get<T>` instead */
export function getCache<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

/** @deprecated Use `set<T>` instead */
export function setCache<T>(key: string, data: T, ttlMs: number): void {
  if (store.size >= MAX_CACHE_SIZE) {
    const oldestKey = store.keys().next().value;
    if (oldestKey) store.delete(oldestKey);
  }
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}
