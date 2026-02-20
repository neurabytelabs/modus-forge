import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { init, detect, loadConfig, updateConfig, stats, clean, remove, list } from '../lib/workspace/manager.js';
import { mkdirSync as mkdirSyncFs } from 'node:fs';

describe('Workspace Manager', () => {
  let tmpDir;

  before(() => { tmpDir = mkdtempSync(join(tmpdir(), 'forge-ws-')); });
  after(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('initializes a new workspace', () => {
    const result = init(tmpDir, { name: 'test-project' });
    assert.equal(result.ok, true);
    assert.equal(result.name, 'test-project');
    assert.ok(existsSync(join(tmpDir, '.forge', 'config.json')));
    assert.ok(existsSync(join(tmpDir, '.forge', 'history')));
    assert.ok(existsSync(join(tmpDir, '.forge', 'grimoire')));
  });

  it('prevents double init', () => {
    const result = init(tmpDir);
    assert.equal(result.ok, false);
  });

  it('detects workspace from directory', () => {
    const result = detect(tmpDir);
    assert.equal(result.found, true);
    assert.equal(result.config.name, 'test-project');
  });

  it('detects workspace from subdirectory', () => {
    const subDir = join(tmpDir, 'src', 'deep');
    mkdirSyncFs(subDir, { recursive: true });
    const result = detect(subDir);
    assert.equal(result.found, true);
    assert.equal(result.path, tmpDir);
  });

  it('loads config', () => {
    const config = loadConfig(tmpDir);
    assert.equal(config.name, 'test-project');
    assert.ok(config.created);
  });

  it('updates config', () => {
    const updated = updateConfig(tmpDir, { defaultModel: 'gemini' });
    assert.equal(updated.defaultModel, 'gemini');
    assert.ok(updated.updated);
  });

  it('gets stats', () => {
    const s = stats(tmpDir);
    assert.equal(s.ok, true);
    assert.equal(s.name, 'test-project');
    assert.equal(s.historyEntries, 0);
  });

  it('cleans empty history', () => {
    const result = clean(tmpDir);
    assert.equal(result.removed, 0);
  });

  it('lists workspaces (includes test workspace)', () => {
    const workspaces = list();
    assert.ok(workspaces.length > 0);
    assert.ok(workspaces.some(ws => ws.path === tmpDir));
  });

  it('removes workspace from registry', () => {
    const result = remove(tmpDir);
    assert.equal(result.ok, true);
  });
});
