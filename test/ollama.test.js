import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveModel, listModels } from '../lib/generators/ollama.js';

describe('Ollama Generator', () => {
  it('resolves default alias to llama3.3', () => {
    assert.equal(resolveModel('ollama'), 'llama3.3');
    assert.equal(resolveModel('llama'), 'llama3.3');
  });

  it('resolves specific aliases', () => {
    assert.equal(resolveModel('qwen'), 'qwen2.5:32b');
    assert.equal(resolveModel('phi'), 'phi4');
    assert.equal(resolveModel('mistral'), 'mistral');
    assert.equal(resolveModel('deepseek'), 'deepseek-coder-v2');
  });

  it('passes through unknown models', () => {
    assert.equal(resolveModel('custom-model:7b'), 'custom-model:7b');
  });

  it('listModels returns all aliases', () => {
    const models = listModels();
    assert.ok(Object.keys(models).length >= 8);
    assert.ok('ollama' in models);
    assert.ok('qwen' in models);
  });
});
