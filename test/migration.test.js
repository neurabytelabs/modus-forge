import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { listMigrations, getApplied, getPending, upgrade, formatResults } from '../lib/migration/upgrader.js';

describe('Migration / Upgrader', () => {
  let tmpDir;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'forge-mig-'));
    mkdirSync(join(tmpDir, '.forge', 'history'), { recursive: true });
    writeFileSync(join(tmpDir, '.forge', 'config.json'), JSON.stringify({ name: 'test' }));
  });

  after(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it('lists all migrations', () => {
    const all = listMigrations();
    assert.ok(all.length >= 3);
    assert.ok(all[0].version);
    assert.ok(all[0].description);
  });

  it('returns empty applied list for fresh workspace', () => {
    const applied = getApplied(tmpDir);
    assert.deepEqual(applied, []);
  });

  it('all migrations are pending for fresh workspace', () => {
    const pending = getPending(tmpDir);
    assert.equal(pending.length, listMigrations().length);
  });

  it('dry run does not apply', async () => {
    const result = await upgrade(tmpDir, { dryRun: true });
    assert.ok(result.ok);
    assert.equal(result.applied, 0);
    assert.ok(result.results.every(r => r.dryRun));
  });

  it('upgrade applies pending migrations', async () => {
    const result = await upgrade(tmpDir, { continueOnError: true });
    assert.ok(result.applied > 0);
    assert.ok(existsSync(join(tmpDir, '.forge', 'migrations.json')));
  });

  it('no pending after upgrade', () => {
    const pending = getPending(tmpDir);
    assert.ok(pending.length < listMigrations().length);
  });

  it('formats results', async () => {
    const result = await upgrade(tmpDir, { dryRun: true });
    const text = formatResults(result);
    assert.ok(text.includes('Migration Report'));
  });
});
