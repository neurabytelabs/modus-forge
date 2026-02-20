/**
 * Tests for streaming/handler.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stream, createProgressTracker } from '../lib/streaming/handler.js';

describe('streaming/handler', () => {
  it('exports stream function', () => {
    assert.equal(typeof stream, 'function');
  });

  it('exports createProgressTracker', () => {
    assert.equal(typeof createProgressTracker, 'function');
  });

  it('progress tracker counts chunks', () => {
    const events = [];
    const tracker = createProgressTracker({
      onProgress: (p) => events.push(p),
    });

    tracker.onChunk('hello ');
    tracker.onChunk('world');
    tracker.onDone('hello world');

    assert.equal(events.length, 3);
    assert.equal(events[0].chunks, 1);
    assert.equal(events[0].chars, 6);
    assert.equal(events[1].chunks, 2);
    assert.equal(events[1].chars, 11);
    assert.equal(events[2].done, true);
    assert.equal(events[2].chars, 11);
    assert.ok(events[2].estimatedTokens > 0);
  });

  it('progress tracker calculates speed', () => {
    const events = [];
    const tracker = createProgressTracker({
      onProgress: (p) => events.push(p),
    });

    tracker.onChunk('a'.repeat(1000));
    assert.ok(events[0].charsPerSec > 0);
  });
});
