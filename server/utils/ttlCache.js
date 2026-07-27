// Minimal in-process TTL cache for expensive, shared, read-mostly computations.
//
// Intended for data that is identical across users and changes infrequently —
// e.g. the scraped events/opportunities listings, which are recomputed (Mongo
// find + countDocuments + regex filtering + sort) on every dashboard load but
// only actually change when the collector cron writes new events. A single
// cached entry amortizes one computation across the whole user base.
//
// This is process-local (fine for the single-container Render deploy). Entries
// carry a TTL as a safety net, and callers should also invalidate explicitly
// on write (see eventService.saveEvents) so stale data never outlives a scrape.

class TTLCache {
  constructor({ ttlMs = 5 * 60 * 1000, maxEntries = 500 } = {}) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.store = new Map(); // key -> { value, expiresAt }
  }

  get(key) {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key, value, ttlMs = this.ttlMs) {
    // Simple bound: evict the oldest entry when full (Map preserves insert order).
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  // Wrap an async producer: return the cached value or compute, cache, and return.
  async wrap(key, producer, ttlMs = this.ttlMs) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await producer();
    this.set(key, value, ttlMs);
    return value;
  }

  del(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

module.exports = { TTLCache };
