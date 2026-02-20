/**
 * Tests for hooks/lifecycle.js
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { on, off, run, registerPlugin, unregisterPlugin, list, clear, loggingPlugin, timingPlugin } from '../lib/hooks/lifecycle.js';

describe('hooks/lifecycle', () => {
  beforeEach(() => clear());

  it('registers and runs a hook', async () => {
    let called = false;
    on('beforeGenerate', (state) => { called = true; return state; });
    await run('beforeGenerate', {});
    assert.equal(called, true);
  });

  it('rejects invalid hook names', () => {
    assert.throws(() => on('invalidHook', () => {}), /Invalid hook/);
  });

  it('runs hooks in priority order', async () => {
    const order = [];
    on('afterGenerate', () => order.push('b'), { name: 'b', priority: 20 });
    on('afterGenerate', () => order.push('a'), { name: 'a', priority: 5 });
    on('afterGenerate', () => order.push('c'), { name: 'c', priority: 10 });
    
    await run('afterGenerate', {});
    assert.deepEqual(order, ['a', 'c', 'b']);
  });

  it('hook can modify state', async () => {
    on('beforeEnhance', (state) => ({ ...state, modified: true }));
    const result = await run('beforeEnhance', { prompt: 'test' });
    assert.equal(result.modified, true);
    assert.equal(result.prompt, 'test');
  });

  it('hook errors are captured, not thrown', async () => {
    on('beforeGenerate', () => { throw new Error('boom'); }, { name: 'bad' });
    const state = await run('beforeGenerate', {});
    assert.ok(state._hookErrors);
    assert.equal(state._hookErrors[0].error, 'boom');
    assert.equal(state._hookErrors[0].handler, 'bad');
  });

  it('off removes a handler', async () => {
    let count = 0;
    on('afterValidate', () => count++, { name: 'counter' });
    await run('afterValidate', {});
    assert.equal(count, 1);
    
    off('afterValidate', 'counter');
    await run('afterValidate', {});
    assert.equal(count, 1); // not called again
  });

  it('registerPlugin registers multiple hooks', async () => {
    const calls = [];
    registerPlugin({
      name: 'test-plugin',
      hooks: {
        beforeContext: () => calls.push('ctx'),
        afterGenerate: () => calls.push('gen'),
      },
    });
    
    await run('beforeContext', {});
    await run('afterGenerate', {});
    assert.deepEqual(calls, ['ctx', 'gen']);
  });

  it('unregisterPlugin removes all hooks', async () => {
    let called = false;
    registerPlugin({
      name: 'removable',
      hooks: { beforeGenerate: () => { called = true; } },
    });
    
    unregisterPlugin('removable');
    await run('beforeGenerate', {});
    assert.equal(called, false);
  });

  it('list returns registered hooks', () => {
    on('beforeGenerate', () => {}, { name: 'test' });
    const l = list();
    assert.ok(l.beforeGenerate);
    assert.equal(l.beforeGenerate[0].name, 'test');
  });

  it('built-in plugins have correct shape', () => {
    assert.equal(typeof loggingPlugin.name, 'string');
    assert.ok(loggingPlugin.hooks.beforeContext);
    assert.equal(typeof timingPlugin.name, 'string');
    assert.ok(timingPlugin.hooks.beforeContext);
  });
});
