import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CacheManager, globalCache } from '../lib/cache/manager.js';

describe('CacheManager', () => {
  it('should get/set values', () => {
    const cache = new CacheManager();
    cache.set('key1', 'value1');
    assert.equal(cache.get('key1'), 'value1');
  });

  it('should return undefined for missing keys', () => {
    const cache = new CacheManager();
    assert.equal(cache.get('nonexistent'), undefined);
  });

  it('should expire entries after TTL', () => {
    const cache = new CacheManager({ ttl: 1 }); // 1ms TTL
    cache.set('key1', 'value1');
    // Wait for expiry
    const start = Date.now();
    while (Date.now() - start < 5) {} // busy wait 5ms
    assert.equal(cache.get('key1'), undefined);
  });

  it('should support per-key TTL', () => {
    const cache = new CacheManager({ ttl: 60000 });
    cache.set('short', 'val', 1); // 1ms
    cache.set('long', 'val', 60000);
    const start = Date.now();
    while (Date.now() - start < 5) {}
    assert.equal(cache.get('short'), undefined);
    assert.equal(cache.get('long'), 'val');
  });

  it('should evict oldest when full', () => {
    const cache = new CacheManager({ maxEntries: 2, ttl: 60000 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3); // should evict 'a'
    assert.equal(cache.get('a'), undefined);
    assert.equal(cache.get('c'), 3);
    assert.equal(cache.stats.evictions, 1);
  });

  it('should support namespaces', () => {
    const cache = new CacheManager();
    const weather = cache.namespace('weather', 5000);
    const news = cache.namespace('news', 10000);
    weather.set('cologne', '15°C');
    news.set('top', 'AI news');
    assert.equal(weather.get('cologne'), '15°C');
    assert.equal(news.get('top'), 'AI news');
    assert.equal(weather.get('top'), undefined); // different namespace
  });

  it('should track stats', () => {
    const cache = new CacheManager();
    cache.set('x', 1);
    cache.get('x'); // hit
    cache.get('y'); // miss
    const stats = cache.getStats();
    assert.equal(stats.hits, 1);
    assert.equal(stats.misses, 1);
    assert.equal(stats.sets, 1);
    assert.equal(stats.hitRate, '50.0%');
  });

  it('should prune expired entries', () => {
    const cache = new CacheManager({ ttl: 1 });
    cache.set('a', 1);
    cache.set('b', 2);
    const start = Date.now();
    while (Date.now() - start < 5) {}
    const pruned = cache.prune();
    assert.equal(pruned, 2);
    assert.equal(cache.getStats().size, 0);
  });

  it('should has() check correctly', () => {
    const cache = new CacheManager();
    cache.set('exists', true);
    assert.equal(cache.has('exists'), true);
    assert.equal(cache.has('nope'), false);
  });

  it('should export global singleton', () => {
    assert.ok(globalCache instanceof CacheManager);
  });
});
