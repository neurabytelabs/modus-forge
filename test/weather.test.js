import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getWeather, weatherContext } from '../lib/context/weather.js';

describe('Weather Context', () => {
  it('getWeather returns object or null', () => {
    const w = getWeather();
    if (w !== null) {
      assert.ok(w.condition, 'has condition');
      assert.ok(w.temp, 'has temp');
      assert.ok(w.mood, 'has mood');
      assert.ok(w.mood.palette, 'mood has palette');
      assert.ok(w.category, 'has category');
    }
  });

  it('weatherContext returns string', () => {
    const ctx = weatherContext();
    assert.equal(typeof ctx, 'string');
    // Either empty (network fail) or contains weather info
    if (ctx.length > 0) {
      assert.ok(ctx.includes('Weather:'), 'starts with Weather:');
      assert.ok(ctx.includes('mood:'), 'includes mood');
    }
  });

  it('caches results within TTL', () => {
    const w1 = getWeather();
    const w2 = getWeather();
    // Should be same reference if cached
    if (w1 !== null) {
      assert.strictEqual(w1, w2, 'cached result is same reference');
    }
  });
});
