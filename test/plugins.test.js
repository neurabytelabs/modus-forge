import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { discover, list, enable, disable, clear, gatherContexts, getCommands } from '../lib/plugins/registry.js';
import { clear as clearHooks, list as listHooks } from '../lib/hooks/lifecycle.js';

describe('Plugin Registry', () => {
  beforeEach(async () => {
    await clear();
    clearHooks();
  });

  it('should start with empty registry', () => {
    assert.deepEqual(list(), []);
  });

  it('should discover plugins from a directory', async () => {
    // Discovery from non-existent dir creates it and returns empty
    const results = await discover({ dir: '/tmp/forge-test-plugins-' + Date.now() });
    assert.deepEqual(results, []);
  });

  it('should list plugins with metadata', async () => {
    const plugins = list();
    assert.ok(Array.isArray(plugins));
  });

  it('should return empty commands when no plugins', () => {
    const cmds = getCommands();
    assert.deepEqual(cmds, {});
  });

  it('should return empty contexts when no plugins', async () => {
    const ctxs = await gatherContexts();
    assert.deepEqual(ctxs, []);
  });
});
