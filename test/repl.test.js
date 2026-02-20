import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../lib/interactive/repl.js';

describe('Interactive REPL (evaluate)', () => {
  it('evaluates a prompt: enhance + validate', () => {
    const result = evaluate('Create a dark mode dashboard');
    assert.ok(result.enhanced);
    assert.ok(result.score);
    assert.ok(typeof result.score.conatus === 'number');
    assert.ok(typeof result.score.ratio === 'number');
  });

  it('handles empty input gracefully', () => {
    const result = evaluate('');
    assert.ok(result);
  });

  it('accepts context parameter', () => {
    const result = evaluate('Build a weather app', { timeOfDay: 'evening', mood: 'calm' });
    assert.ok(result.enhanced);
  });
});
