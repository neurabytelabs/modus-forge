import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Pipeline imports many modules — we test that it loads without errors
// and that the exports are correct. Full integration requires LLM access.
describe('pipeline', () => {
  it('exports pipeline and quick functions', async () => {
    const mod = await import('../lib/pipeline/full.js');
    assert.equal(typeof mod.pipeline, 'function');
    assert.equal(typeof mod.quick, 'function');
  });
});
