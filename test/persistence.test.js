import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../lib/persistence/store.js';
import * as history from '../lib/persistence/history.js';

const TEST_COLLECTION = '__test_persistence__';

describe('Store', () => {
  after(() => { store.drop(TEST_COLLECTION); });

  it('should set and get a value', () => {
    store.set(TEST_COLLECTION, 'key1', { name: 'test', value: 42 });
    const result = store.get(TEST_COLLECTION, 'key1');
    assert.deepEqual(result, { name: 'test', value: 42 });
  });

  it('should return undefined for missing key', () => {
    assert.equal(store.get(TEST_COLLECTION, 'nonexistent'), undefined);
  });

  it('should list keys', () => {
    store.set(TEST_COLLECTION, 'a', 1);
    store.set(TEST_COLLECTION, 'b', 2);
    const k = store.keys(TEST_COLLECTION);
    assert.ok(k.includes('a'));
    assert.ok(k.includes('b'));
  });

  it('should delete a key', () => {
    store.set(TEST_COLLECTION, 'del_me', 'gone');
    assert.equal(store.del(TEST_COLLECTION, 'del_me'), true);
    assert.equal(store.get(TEST_COLLECTION, 'del_me'), undefined);
    assert.equal(store.del(TEST_COLLECTION, 'del_me'), false);
  });

  it('should query with filter', () => {
    store.set(TEST_COLLECTION, 'x', { score: 10 });
    store.set(TEST_COLLECTION, 'y', { score: 50 });
    const high = store.query(TEST_COLLECTION, (_k, v) => v.score > 20);
    assert.ok('y' in high);
    assert.ok(!('x' in high));
  });

  it('should list collections', () => {
    const cols = store.collections();
    assert.ok(Array.isArray(cols));
  });
});

describe('History', () => {
  const TEST_ENTRY = {
    prompt: 'Track my sleep patterns',
    enhancedPrompt: 'Enhanced: Track my sleep patterns...',
    model: 'gemini-3-flash-preview',
    provider: 'gemini',
    score: { conatus: 0.8, ratio: 0.7, laetitia: 0.9, natura: 0.6 },
    grade: 'A',
    code: '<html><body>Sleep Tracker</body></html>',
    tags: ['health', 'tracker'],
  };

  let recordedId;

  it('should record a generation', () => {
    recordedId = history.record(TEST_ENTRY);
    assert.ok(recordedId);
    assert.equal(typeof recordedId, 'string');
  });

  it('should retrieve by ID', () => {
    const entry = history.get(recordedId);
    assert.equal(entry.prompt, 'Track my sleep patterns');
    assert.equal(entry.provider, 'gemini');
    assert.equal(entry.grade, 'A');
    assert.ok(entry.timestamp);
  });

  it('should retrieve code separately', () => {
    const code = history.getCode(recordedId);
    assert.ok(code.includes('Sleep Tracker'));
  });

  it('should list entries', () => {
    const entries = history.list();
    assert.ok(entries.length > 0);
    assert.ok(entries.some(e => e.id === recordedId));
  });

  it('should search by prompt text', () => {
    const results = history.search('sleep');
    assert.ok(results.length > 0);
  });

  it('should compute stats', () => {
    const s = history.stats();
    assert.ok(s.total > 0);
    assert.ok(s.byProvider.gemini > 0);
    assert.ok(s.avgScores);
  });

  it('should remove entry', () => {
    history.remove(recordedId);
    assert.equal(history.get(recordedId), undefined);
    assert.equal(history.getCode(recordedId), undefined);
  });

  after(() => {
    store.drop('history');
    store.drop('generations');
  });
});
