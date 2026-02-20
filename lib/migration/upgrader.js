/**
 * Migration / Upgrader — Data migration between Forge versions.
 * 
 * Each migration is a versioned transform function that upgrades
 * workspace data from one schema to the next. Migrations run in order,
 * are idempotent, and track what's been applied.
 * 
 * Spinoza: change is not destruction — it's a mode transitioning to
 * a more adequate expression of its nature.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATION_LOG = '.forge/migrations.json';

// --- Migration Registry ---

const migrations = [];

function defineMigration(version, description, fn) {
  migrations.push({ version, description, fn });
}

// v0.1.0 → v0.2.0: Add tags to workspace config
defineMigration('0.2.0', 'Add tags array to workspace config', (dir) => {
  const configPath = join(dir, '.forge', 'config.json');
  if (!existsSync(configPath)) return { skipped: true };
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  if (!config.tags) {
    config.tags = [];
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    return { changed: true };
  }
  return { changed: false };
});

// v0.2.0 → v0.5.0: Rename 'spells' dir to 'grimoire'
defineMigration('0.5.0', 'Rename spells/ to grimoire/ in .forge', (dir) => {
  const oldPath = join(dir, '.forge', 'spells');
  const newPath = join(dir, '.forge', 'grimoire');
  if (existsSync(oldPath) && !existsSync(newPath)) {
    renameSync(oldPath, newPath);
    return { changed: true, detail: 'spells/ → grimoire/' };
  }
  return { changed: false };
});

// v0.5.0 → v0.10.0: Add persona field to history entries
defineMigration('0.10.0', 'Add persona field to history entries', (dir) => {
  const historyDir = join(dir, '.forge', 'history');
  if (!existsSync(historyDir)) return { skipped: true };
  
  let updated = 0;
  
  for (const file of readdirSync(historyDir).filter(f => f.endsWith('.json'))) {
    const filePath = join(historyDir, file);
    try {
      const entry = JSON.parse(readFileSync(filePath, 'utf-8'));
      if (!entry.persona) {
        entry.persona = null;
        writeFileSync(filePath, JSON.stringify(entry, null, 2));
        updated++;
      }
    } catch { /* skip corrupt files */ }
  }
  
  return { changed: updated > 0, detail: `${updated} entries updated` };
});

// v0.10.0 → v0.15.0: Normalize score format in history
defineMigration('0.15.0', 'Normalize Spinoza scores in history (add total field)', (dir) => {
  const historyDir = join(dir, '.forge', 'history');
  if (!existsSync(historyDir)) return { skipped: true };
  
  let updated = 0;
  
  for (const file of readdirSync(historyDir).filter(f => f.endsWith('.json'))) {
    const filePath = join(historyDir, file);
    try {
      const entry = JSON.parse(readFileSync(filePath, 'utf-8'));
      if (entry.score && !entry.score.total) {
        const s = entry.score;
        s.total = ((s.conatus || 0) + (s.ratio || 0) + (s.laetitia || 0) + (s.natura || 0)) / 4;
        writeFileSync(filePath, JSON.stringify(entry, null, 2));
        updated++;
      }
    } catch { /* skip */ }
  }
  
  return { changed: updated > 0, detail: `${updated} scores normalized` };
});

// v0.15.0 → v0.19.0: Add theme field to workspace config
defineMigration('0.19.0', 'Add defaultTheme to workspace config', (dir) => {
  const configPath = join(dir, '.forge', 'config.json');
  if (!existsSync(configPath)) return { skipped: true };
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  if (config.defaultTheme === undefined) {
    config.defaultTheme = null;
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    return { changed: true };
  }
  return { changed: false };
});

// --- Runner ---

/**
 * Get list of all defined migrations.
 */
export function listMigrations() {
  return migrations.map(m => ({ version: m.version, description: m.description }));
}

/**
 * Get list of applied migrations for a workspace.
 */
export function getApplied(dir) {
  const logPath = join(dir, MIGRATION_LOG);
  if (!existsSync(logPath)) return [];
  try {
    return JSON.parse(readFileSync(logPath, 'utf-8'));
  } catch {
    return [];
  }
}

/**
 * Get pending (unapplied) migrations for a workspace.
 */
export function getPending(dir) {
  const applied = new Set(getApplied(dir).map(a => a.version));
  return migrations.filter(m => !applied.has(m.version));
}

/**
 * Run all pending migrations on a workspace directory.
 */
export async function upgrade(dir, opts = {}) {
  const pending = getPending(dir);
  if (pending.length === 0) return { ok: true, applied: 0, results: [] };
  
  const applied = getApplied(dir);
  const results = [];
  
  for (const migration of pending) {
    if (opts.dryRun) {
      results.push({ version: migration.version, description: migration.description, dryRun: true });
      continue;
    }
    
    try {
      const result = await migration.fn(dir);
      const record = {
        version: migration.version,
        description: migration.description,
        appliedAt: new Date().toISOString(),
        result,
      };
      applied.push(record);
      results.push(record);
    } catch (err) {
      results.push({
        version: migration.version,
        description: migration.description,
        error: err.message,
      });
      if (!opts.continueOnError) break;
    }
  }
  
  if (!opts.dryRun) {
    const logDir = join(dir, '.forge');
    mkdirSync(logDir, { recursive: true });
    writeFileSync(join(dir, MIGRATION_LOG), JSON.stringify(applied, null, 2));
  }
  
  return {
    ok: results.every(r => !r.error),
    applied: results.filter(r => !r.error && !r.dryRun).length,
    results,
  };
}

/**
 * Format upgrade results as human-readable text.
 */
export function formatResults(upgradeResult) {
  const lines = ['📦 Forge Migration Report\n'];
  
  if (upgradeResult.results.length === 0) {
    lines.push('  ✅ Already up to date — no migrations needed.');
    return lines.join('\n');
  }
  
  for (const r of upgradeResult.results) {
    const icon = r.error ? '❌' : r.dryRun ? '🔍' : '✅';
    lines.push(`  ${icon} v${r.version}: ${r.description}`);
    if (r.error) lines.push(`     Error: ${r.error}`);
    if (r.result?.detail) lines.push(`     ${r.result.detail}`);
  }
  
  lines.push('');
  lines.push(`  Applied: ${upgradeResult.applied} | Total: ${upgradeResult.results.length}`);
  
  return lines.join('\n');
}
