const { TTLCache } = require('../utils/ttlCache');

describe('TTLCache', () => {
  test('returns cached value on hit and only computes once', async () => {
    const cache = new TTLCache({ ttlMs: 1000 });
    let calls = 0;
    const producer = async () => { calls++; return 'value'; };

    await expect(cache.wrap('k', producer)).resolves.toBe('value');
    await expect(cache.wrap('k', producer)).resolves.toBe('value');
    expect(calls).toBe(1); // second call served from cache
  });

  test('recomputes after TTL expires', async () => {
    const cache = new TTLCache({ ttlMs: 20 });
    let calls = 0;
    const producer = async () => { calls++; return calls; };

    await expect(cache.wrap('k', producer)).resolves.toBe(1);
    await new Promise((r) => setTimeout(r, 40)); // let it expire
    await expect(cache.wrap('k', producer)).resolves.toBe(2);
    expect(calls).toBe(2);
  });

  test('clear() drops all entries (used for write invalidation)', async () => {
    const cache = new TTLCache({ ttlMs: 10000 });
    let calls = 0;
    const producer = async () => { calls++; return calls; };

    await cache.wrap('k', producer);
    cache.clear();
    await cache.wrap('k', producer);
    expect(calls).toBe(2); // recomputed after clear
  });

  test('caches distinct keys independently', async () => {
    const cache = new TTLCache({ ttlMs: 1000 });
    await cache.wrap('a', async () => 1);
    await cache.wrap('b', async () => 2);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(2);
  });

  test('evicts oldest entry when maxEntries exceeded', () => {
    const cache = new TTLCache({ ttlMs: 10000, maxEntries: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3); // evicts 'a'
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });
});
