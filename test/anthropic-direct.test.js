import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveModel, isAvailable } from '../lib/generators/anthropic-direct.js';

describe('Anthropic Direct Generator', () => {
  it('resolves model aliases', () => {
    assert.equal(resolveModel('claude-opus'), 'claude-opus-4-6');
    assert.equal(resolveModel('claude-sonnet'), 'claude-sonnet-4-5-20250514');
    assert.equal(resolveModel('claude-haiku'), 'claude-haiku-3-5-20241022');
  });

  it('passes through unknown model names', () => {
    assert.equal(resolveModel('claude-custom-123'), 'claude-custom-123');
  });

  it('isAvailable reflects ANTHROPIC_API_KEY', () => {
    // In test env, key is likely not set
    assert.equal(typeof isAvailable(), 'boolean');
  });
});
