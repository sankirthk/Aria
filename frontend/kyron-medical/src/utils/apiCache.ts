import type { ApiResponse } from "../types/agentTypes";

const DEFAULT_TTL = 60_000; // 1 minute

type CacheEntry<T> = {
  expiry: number;
  promise?: Promise<ApiResponse<T>>;
  value?: ApiResponse<T>;
};

export type CacheOptions = {
  ttl?: number;
  forceRefresh?: boolean;
};

const cache = new Map<string, CacheEntry<unknown>>();

export const fetchWithCache = async <T>(
  key: string,
  fetcher: () => Promise<ApiResponse<T>>,
  options: CacheOptions = {}
): Promise<ApiResponse<T>> => {
  const { ttl = DEFAULT_TTL, forceRefresh = false } = options;
  const now = Date.now();
  const entry = cache.get(key) as CacheEntry<T> | undefined;

  if (!forceRefresh && entry) {
    const isFresh = now < entry.expiry;

    if (entry.value && isFresh) {
      return entry.value;
    }

    if (entry.promise && isFresh) {
      return entry.promise;
    }
  }

  const expiry = now + ttl;
  const promise = fetcher()
    .then((value) => {
      cache.set(key, { value, expiry });
      return value;
    })
    .catch((error) => {
      cache.delete(key);
      throw error;
    });

  cache.set(key, { promise, expiry });

  return promise;
};

export const invalidateCache = (key: string) => {
  cache.delete(key);
};

export const clearCache = () => {
  cache.clear();
};
