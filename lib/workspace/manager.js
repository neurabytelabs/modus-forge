/**
 * Workspace Manager — Multi-project workspace management for Forge.
 * 
 * Each workspace is a directory with a .forge/ folder containing:
 *   - config.json (project-level config overrides)
 *   - history/ (generation history)
 *   - grimoire/ (project-specific prompts)
 * 
 * Workspaces can be initialized, switched, listed, and cleaned.
 * Spinoza: each workspace is a "mode" — a particular expression of the forge substance.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { homedir } from 'node:os';

const FORGE_DIR = '.forge';
const GLOBAL_REGISTRY = join(homedir(), '.forge', 'workspaces.json');
const WORKSPACE_CONFIG = 'config.json';

/**
 * Initialize a new workspace in the given directory.
 */
export function init(dir = process.cwd(), opts = {}) {
  const root = resolve(dir);
  const forgePath = join(root, FORGE_DIR);
  
  if (existsSync(forgePath)) {
    return { ok: false, error: 'Workspace already initialized', path: root };
  }
  
  mkdirSync(join(forgePath, 'history'), { recursive: true });
  mkdirSync(join(forgePath, 'grimoire'), { recursive: true });
  
  const config = {
    name: opts.name || basename(root),
    created: new Date().toISOString(),
    defaultModel: opts.model || null,
    defaultPersona: opts.persona || null,
    defaultTheme: opts.theme || null,
    tags: opts.tags || [],
  };
  
  writeFileSync(join(forgePath, WORKSPACE_CONFIG), JSON.stringify(config, null, 2));
  
  // Register in global registry
  registerWorkspace(root, config.name);
  
  return { ok: true, path: root, name: config.name };
}

/**
 * Detect workspace from current or ancestor directory.
 */
export function detect(dir = process.cwd()) {
  let current = resolve(dir);
  const root = '/';
  
  while (current !== root) {
    if (existsSync(join(current, FORGE_DIR, WORKSPACE_CONFIG))) {
      return { found: true, path: current, config: loadConfig(current) };
    }
    const parent = resolve(current, '..');
    if (parent === current) break;
    current = parent;
  }
  
  return { found: false, path: null, config: null };
}

/**
 * Load workspace config.
 */
export function loadConfig(dir) {
  const configPath = join(resolve(dir), FORGE_DIR, WORKSPACE_CONFIG);
  if (!existsSync(configPath)) return null;
  
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Update workspace config (merge).
 */
export function updateConfig(dir, patch) {
  const root = resolve(dir);
  const configPath = join(root, FORGE_DIR, WORKSPACE_CONFIG);
  const current = loadConfig(root) || {};
  const updated = { ...current, ...patch, updated: new Date().toISOString() };
  writeFileSync(configPath, JSON.stringify(updated, null, 2));
  return updated;
}

/**
 * List all registered workspaces.
 */
export function list() {
  const registry = loadRegistry();
  return registry.workspaces.map(ws => ({
    ...ws,
    exists: existsSync(join(ws.path, FORGE_DIR)),
    config: loadConfig(ws.path),
  }));
}

/**
 * Get workspace stats: file count, history entries, grimoire size.
 */
export function stats(dir = process.cwd()) {
  const root = resolve(dir);
  const forgePath = join(root, FORGE_DIR);
  
  if (!existsSync(forgePath)) {
    return { ok: false, error: 'Not a forge workspace' };
  }
  
  const historyDir = join(forgePath, 'history');
  const grimoireDir = join(forgePath, 'grimoire');
  
  const historyCount = existsSync(historyDir) ? readdirSync(historyDir).filter(f => f.endsWith('.json')).length : 0;
  const grimoireCount = existsSync(grimoireDir) ? readdirSync(grimoireDir).filter(f => f.endsWith('.json')).length : 0;
  
  // Calculate total .forge size
  const totalSize = dirSize(forgePath);
  
  return {
    ok: true,
    name: loadConfig(root)?.name || basename(root),
    path: root,
    historyEntries: historyCount,
    grimoireEntries: grimoireCount,
    totalSizeBytes: totalSize,
    totalSizeHuman: humanSize(totalSize),
  };
}

/**
 * Clean workspace: remove history older than N days, or all.
 */
export function clean(dir = process.cwd(), opts = {}) {
  const root = resolve(dir);
  const historyDir = join(root, FORGE_DIR, 'history');
  
  if (!existsSync(historyDir)) return { removed: 0 };
  
  const maxAgeDays = opts.olderThanDays || null;
  const now = Date.now();
  let removed = 0;
  
  for (const file of readdirSync(historyDir)) {
    const filePath = join(historyDir, file);
    const stat = statSync(filePath);
    
    if (maxAgeDays === null || (now - stat.mtimeMs) > maxAgeDays * 86400000) {
      rmSync(filePath);
      removed++;
    }
  }
  
  return { removed };
}

/**
 * Remove workspace from registry (optionally delete .forge dir).
 */
export function remove(dir, opts = {}) {
  const root = resolve(dir);
  const registry = loadRegistry();
  registry.workspaces = registry.workspaces.filter(ws => ws.path !== root);
  saveRegistry(registry);
  
  if (opts.deleteData && existsSync(join(root, FORGE_DIR))) {
    rmSync(join(root, FORGE_DIR), { recursive: true });
  }
  
  return { ok: true, deleted: !!opts.deleteData };
}

// --- Internal ---

function registerWorkspace(path, name) {
  const registry = loadRegistry();
  if (!registry.workspaces.find(ws => ws.path === path)) {
    registry.workspaces.push({ path, name, registered: new Date().toISOString() });
    saveRegistry(registry);
  }
}

function loadRegistry() {
  if (!existsSync(GLOBAL_REGISTRY)) return { workspaces: [] };
  try {
    return JSON.parse(readFileSync(GLOBAL_REGISTRY, 'utf-8'));
  } catch {
    return { workspaces: [] };
  }
}

function saveRegistry(registry) {
  const dir = join(homedir(), '.forge');
  mkdirSync(dir, { recursive: true });
  writeFileSync(GLOBAL_REGISTRY, JSON.stringify(registry, null, 2));
}

function dirSize(dir) {
  let total = 0;
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      total += stat.isDirectory() ? dirSize(full) : stat.size;
    }
  } catch { /* permission errors, etc. */ }
  return total;
}

function humanSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(1)} ${units[i]}`;
}
