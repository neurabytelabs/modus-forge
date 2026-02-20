import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { recordCall, getSummary, bestValueModel } from '../lib/telemetry/tracker.js';

describe('Telemetry Tracker', () => {
  it('records a call with cost estimation', () => {
    const record = recordCall({
      model: 'gemini-2.5-flash',
      inputText: 'Create a landing page',
      outputText: '<html><body><h1>Hello</h1></body></html>',
      durationMs: 2500,
      success: true
    });
    assert.ok(record.timestamp);
    assert.equal(record.model, 'gemini-2.5-flash');
    assert.ok(record.inputTokens > 0);
    assert.ok(record.outputTokens > 0);
    assert.ok(record.cost >= 0);
    assert.equal(record.success, true);
  });

  it('tracks ollama as free', () => {
    const record = recordCall({
      model: 'ollama/llama3',
      inputText: 'test prompt',
      outputText: 'test output',
      durationMs: 1000
    });
    assert.equal(record.cost, 0);
  });

  it('gets usage summary', () => {
    // Record a few calls
    recordCall({ model: 'gpt-4o', inputText: 'a'.repeat(4000), outputText: 'b'.repeat(8000) });
    recordCall({ model: 'gpt-4o', inputText: 'c'.repeat(2000), outputText: 'd'.repeat(4000) });
    
    const summary = getSummary(7);
    assert.ok(summary.totalCalls >= 2);
    assert.ok(summary.totalCost >= 0);
    assert.ok(summary.byModel['gpt-4o']);
    assert.ok(summary.byModel['gpt-4o'].calls >= 2);
  });

  it('identifies best value model', () => {
    // Record enough calls for ranking
    for (let i = 0; i < 3; i++) {
      recordCall({ model: 'ollama/llama3', inputText: 'cheap', outputText: 'free' });
    }
    const best = bestValueModel(7);
    assert.ok(best);
    assert.ok(best.avgCost >= 0);
  });

  it('handles unknown model gracefully', () => {
    const record = recordCall({
      model: 'mystery-model-9000',
      inputText: 'hello',
      outputText: 'world'
    });
    assert.ok(record.cost >= 0);
  });
});
