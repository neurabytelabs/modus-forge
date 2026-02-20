/**
 * Unified Cache Manager — Replaces per-module caching with a single, configurable layer.
 * Supports TTL, LRU eviction, namespaces, and stats.
 * 
 * @module cache/manager
 * @since IT-18
 */

const DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes
const DEFAULT_MAX_ENTRIES = 500;

class CacheManager {
  constructor(options = {}) {
    this.ttl = options.ttl || DEFAULT_TTL;
    this.maxEntries = options.maxEntries || DEFAULT_MAX_ENTRIES;
    this.store = new Map();
    this.stats = { hits: 0, misses: 0, evictions: 0, sets: 0 };
  }

  /**
   * Get a cached value by key, respecting TTL.
   * @param {string} key
   * @returns {*} cached value or undefined
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      this.stats.misses++;
      return undefined;
    }
    // LRU: move to end
    this.store.delete(key);
    this.store.set(key, entry);
    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set a cached value with optional per-key TTL.
   * @param {string} key
   * @param {*} value
   * @param {number} [ttl] - TTL in ms, defaults to instance TTL
   */
  set(key, value, ttl) {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      // Evict oldest (first entry in Map)
      const oldest = this.store.keys().next().value;
      this.store.delete(oldest);
      this.stats.evictions++;
    }
    this.store.set(key, {
      value,
      expires: Date.now() + (ttl || this.ttl),
      created: Date.now()
    });
    this.stats.sets++;
  }

  /**
   * Check if key exists and is not expired.
   */
  has(key) {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete a specific key.
   */
  delete(key) {
    return this.store.delete(key);
  }

  /**
   * Create a namespaced sub-cache that prefixes keys.
   * @param {string} namespace
   * @param {number} [ttl] - Default TTL for this namespace
   * @returns {{ get, set, has, delete, clear }}
   */
  namespace(namespace, ttl) {
    const prefix = `${namespace}:`;
    const self = this;
    const nsTtl = ttl || this.ttl;
    return {
      get: (key) => self.get(prefix + key),
      set: (key, value, t) => self.set(prefix + key, value, t || nsTtl),
      has: (key) => self.has(prefix + key),
      delete: (key) => self.delete(prefix + key),
      clear: () => {
        for (const k of self.store.keys()) {
          if (k.startsWith(prefix)) self.store.delete(k);
        }
      }
    };
  }

  /**
   * Get cache statistics.
   */
  getStats() {
    const hitRate = (this.stats.hits + this.stats.misses) > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(1)
      : '0.0';
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      size: this.store.size,
      maxEntries: this.maxEntries
    };
  }

  /**
   * Clear all entries.
   */
  clear() {
    this.store.clear();
  }

  /**
   * Prune expired entries.
   * @returns {number} Number of entries pruned
   */
  prune() {
    let pruned = 0;
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expires) {
        this.store.delete(key);
        pruned++;
      }
    }
    return pruned;
  }
}

// Singleton global cache
const globalCache = new CacheManager();

export { CacheManager, globalCache };
export default globalCache;
