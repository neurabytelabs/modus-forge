import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

// Test the chain's internal logic by importing and testing computeTotal/identifyIssues indirectly
// Since chain() calls LLMs, we test the module loads and exports correctly

describe('Iteration Chain', () => {
  it('module loads without error', async () => {
    const mod = await import('../lib/iterate/chain.js');
    assert.ok(typeof mod.chain === 'function', 'exports chain function');
  });
});
