import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { batch, compare, variations } from '../lib/pipeline/batch.js';

describe('Batch Pipeline', () => {
  describe('batch()', () => {
    it('exports batch function', () => {
      assert.equal(typeof batch, 'function');
    });

    it('returns empty summary for empty input', async () => {
      const result = await batch([]);
      assert.equal(result.total, 0);
      assert.equal(result.succeeded, 0);
      assert.equal(result.failed, 0);
      assert.equal(result.avgScore, 0);
      assert.deepEqual(result.results, []);
      assert.equal(result.best, null);
      assert.equal(result.worst, null);
    });
  });

  describe('compare()', () => {
    it('exports compare function', () => {
      assert.equal(typeof compare, 'function');
    });
  });

  describe('variations()', () => {
    it('exports variations function', () => {
      assert.equal(typeof variations, 'function');
    });
  });
});
