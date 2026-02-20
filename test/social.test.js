import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sense } from '../lib/context/social.js';

describe('Social Context Sensor', () => {
  it('returns an object with context, mood, trending, notifications', () => {
    const result = sense();
    assert.ok(typeof result.context === 'string', 'context should be a string');
    assert.ok(typeof result.mood === 'string', 'mood should be a string');
    assert.ok(Array.isArray(result.trending), 'trending should be an array');
    assert.ok(typeof result.notifications === 'number', 'notifications should be a number');
  });

  it('caches results on second call', () => {
    const r1 = sense();
    const r2 = sense();
    assert.deepStrictEqual(r1, r2, 'cached result should match');
  });

  it('trending items have required fields', () => {
    const { trending } = sense();
    for (const r of trending) {
      assert.ok(typeof r.name === 'string', 'repo needs name');
      assert.ok(typeof r.stars === 'number', 'repo needs stars');
      assert.ok(typeof r.topic === 'string', 'repo needs topic');
    }
  });
});
