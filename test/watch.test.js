import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { watchMode } from '../lib/pipeline/watch.js';

describe('Watch Mode', () => {
  it('should throw on non-existent target', async () => {
    await assert.rejects(
      () => watchMode('/tmp/nonexistent-' + Date.now()),
      /Watch target not found/
    );
  });

  it('should export watchMode function', () => {
    assert.equal(typeof watchMode, 'function');
  });
});
