import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveModel, listModels } from '../lib/generators/deepseek.js';

describe('DeepSeek Generator', () => {
  it('resolves default alias', () => {
    assert.equal(resolveModel('deepseek'), 'deepseek-chat');
  });

  it('resolves coder alias', () => {
    assert.equal(resolveModel('deepseek-coder'), 'deepseek-coder');
  });

  it('resolves reasoner alias', () => {
    assert.equal(resolveModel('deepseek-reasoner'), 'deepseek-reasoner');
  });

  it('passes through unknown models', () => {
    assert.equal(resolveModel('deepseek-v3'), 'deepseek-v3');
  });

  it('lists available models', () => {
    const models = listModels();
    assert.ok(Object.keys(models).length >= 3);
    assert.ok('deepseek' in models);
    assert.ok('deepseek-coder' in models);
  });
});
