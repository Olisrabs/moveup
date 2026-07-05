/**
 * MoveUp Client-Side Cache
 * ─────────────────────────────────────────────────────────────────
 * A lightweight, two-tier cache (memory → sessionStorage) with TTL
 * and stale-while-revalidate semantics.
 *
 * TTLs (in ms):
 *   rooms        — 2 min   (changes on join/create/expire)
 *   tasks        — 90 sec  (changes on add/complete)
 *   proofCount   — 2 min
 *   memberCounts — 3 min   (rarely changes mid-session)
 *
 * Usage:
 *   import { cache } from "@/lib/cache";
 *   cache.set("rooms:userId", data, 120_000);
 *   const hit = cache.get<Room[]>("rooms:userId");
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;  // Date.now() + TTL
  storedAt: number;
}

const SESSION_KEY = "mu_cache_v1";

// ─── In-memory store (fastest tier) ────────────────────────────────────────
const mem = new Map<string, CacheEntry<unknown>>();

// ─── Helpers ────────────────────────────────────────────────────────────────
function readStorage(): Record<string, CacheEntry<unknown>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeStorage(store: Record<string, CacheEntry<unknown>>) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(store));
  } catch {
    // Storage quota exceeded — clear and retry
    sessionStorage.removeItem(SESSION_KEY);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────
export const cache = {
  /**
   * Store a value with a TTL (milliseconds).
   * Writes to memory and sessionStorage.
   */
  set<T>(key: string, data: T, ttlMs: number): void {
    const entry: CacheEntry<T> = {
      data,
      expiresAt: Date.now() + ttlMs,
      storedAt: Date.now(),
    };
    mem.set(key, entry as CacheEntry<unknown>);

    const store = readStorage();
    store[key] = entry as CacheEntry<unknown>;
    writeStorage(store);
  },

  /**
   * Retrieve a value. Returns `null` if missing or expired.
   * Checks memory first, then sessionStorage.
   */
  get<T>(key: string): T | null {
    const now = Date.now();

    // 1. Memory hit
    const memEntry = mem.get(key) as CacheEntry<T> | undefined;
    if (memEntry) {
      if (memEntry.expiresAt > now) return memEntry.data;
      mem.delete(key);
    }

    // 2. sessionStorage hit (e.g. after a soft navigation)
    const store = readStorage();
    const diskEntry = store[key] as CacheEntry<T> | undefined;
    if (diskEntry && diskEntry.expiresAt > now) {
      // Promote back to memory
      mem.set(key, diskEntry as CacheEntry<unknown>);
      return diskEntry.data;
    }

    return null;
  },

  /**
   * Returns the cached value regardless of expiry (for stale-while-revalidate).
   * Returns `null` only if there is no entry at all.
   */
  getStale<T>(key: string): T | null {
    const memEntry = mem.get(key) as CacheEntry<T> | undefined;
    if (memEntry) return memEntry.data;

    const store = readStorage();
    const diskEntry = store[key] as CacheEntry<T> | undefined;
    if (diskEntry) {
      mem.set(key, diskEntry as CacheEntry<unknown>);
      return diskEntry.data;
    }

    return null;
  },

  /** True if a fresh (non-expired) entry exists. */
  isFresh(key: string): boolean {
    return this.get(key) !== null;
  },

  /** Remove a specific key from both tiers. */
  invalidate(key: string): void {
    mem.delete(key);
    const store = readStorage();
    delete store[key];
    writeStorage(store);
  },

  /** Remove all keys matching a prefix (e.g. "rooms:" to bust all room caches). */
  invalidatePrefix(prefix: string): void {
    for (const key of mem.keys()) {
      if (key.startsWith(prefix)) mem.delete(key);
    }
    const store = readStorage();
    for (const key of Object.keys(store)) {
      if (key.startsWith(prefix)) delete store[key];
    }
    writeStorage(store);
  },

  /** Wipe everything — call on sign-out. */
  clear(): void {
    mem.clear();
    if (typeof window !== "undefined") sessionStorage.removeItem(SESSION_KEY);
  },
};

// ─── TTL constants (export for consistent usage across files) ────────────────
export const TTL = {
  ROOMS: 2 * 60 * 1000,          // 2 min
  TASKS: 90 * 1000,              // 90 sec
  PROOF_COUNT: 2 * 60 * 1000,   // 2 min
  MEMBER_COUNTS: 3 * 60 * 1000, // 3 min
  ROOMS_DETAIL: 5 * 60 * 1000,  // 5 min (rarely changes)
} as const;
