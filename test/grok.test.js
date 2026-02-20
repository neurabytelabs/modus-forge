import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveModel, listModels } from '../lib/generators/grok.js';

describe('Grok Generator', () => {
  it('resolveModel resolves known aliases', () => {
    assert.equal(resolveModel('grok'), 'grok-4-1-fast-reasoning');
    assert.equal(resolveModel('grok-fast'), 'grok-4-1-fast-reasoning');
    assert.equal(resolveModel('grok-code'), 'grok-code-fast-1');
    assert.equal(resolveModel('grok-mini'), 'grok-3-mini');
  });

  it('resolveModel passes through unknown models', () => {
    assert.equal(resolveModel('custom-model'), 'custom-model');
  });

  it('listModels returns all aliases', () => {
    const models = listModels();
    assert.ok(Object.keys(models).length >= 5);
    assert.ok('grok' in models);
    assert.ok('grok-code' in models);
  });

  it('generate throws without API key', async () => {
    const { generate } = await import('../lib/generators/grok.js');
    await assert.rejects(() => generate('test'), /GROK_API_KEY/);
  });
});
