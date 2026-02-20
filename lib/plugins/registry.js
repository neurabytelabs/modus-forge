/**
 * Plugin Registry — Auto-discovery and lifecycle management for MODUS Forge plugins.
 * 
 * IT-21: Combines hooks/lifecycle (execution) with skills/loader (discovery)
 * into a unified plugin system. Plugins live in plugins/ or are installed via npm.
 * 
 * Plugin contract:
 *   export default {
 *     name: 'my-plugin',
 *     version: '1.0.0',
 *     description: 'What it does',
 *     hooks: { beforeGenerate(state) { ... } },   // lifecycle hooks
 *     context(opts) { return '...'; },              // L1 context sensor
 *     commands: { 'my-cmd': { desc, run(args) } }, // CLI commands
 *     init() { ... },                               // called once on load
 *     destroy() { ... },                            // called on unload
 *   }
 * 
 * @module plugins/registry
 */

import { readdirSync, existsSync, statSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerPlugin, unregisterPlugin } from '../hooks/lifecycle.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = join(__dirname, '..', '..', 'plugins');
const PLUGIN_STATE_FILE = join(__dirname, '..', '..', '.plugin-state.json');

/** @type {Map<string, {meta: object, module: object, enabled: boolean}>} */
const registry = new Map();

/**
 * Discover and load all plugins from the plugins/ directory.
 * @param {object} [opts]
 * @param {string} [opts.dir] - Override plugins directory
 * @param {boolean} [opts.autoEnable=true] - Enable plugins on load
 * @returns {Promise<Array<{name: string, version: string, status: string}>>}
 */
export async function discover(opts = {}) {
  const { dir = PLUGINS_DIR, autoEnable = true } = opts;
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
    return [];
  }

  const results = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    let modulePath;

    if (statSync(fullPath).isDirectory()) {
      // Plugin as directory: plugins/my-plugin/index.js
      modulePath = join(fullPath, 'index.js');
      if (!existsSync(modulePath)) continue;
    } else if (entry.endsWith('.js')) {
      // Plugin as single file: plugins/my-plugin.js
      modulePath = fullPath;
    } else {
      continue;
    }

    try {
      const mod = await import(modulePath);
      const plugin = mod.default || mod;

      if (!plugin.name) {
        results.push({ name: entry, version: '?', status: 'error: no name' });
        continue;
      }

      registry.set(plugin.name, {
        meta: {
          name: plugin.name,
          version: plugin.version || '0.0.0',
          description: plugin.description || '',
          path: modulePath,
        },
        module: plugin,
        enabled: false,
      });

      if (autoEnable) {
        await enable(plugin.name);
      }

      results.push({ name: plugin.name, version: plugin.version || '0.0.0', status: 'loaded' });
    } catch (err) {
      results.push({ name: entry, version: '?', status: `error: ${err.message}` });
    }
  }

  return results;
}

/**
 * Enable a plugin (register hooks, run init).
 * @param {string} name
 */
export async function enable(name) {
  const entry = registry.get(name);
  if (!entry) throw new Error(`Plugin "${name}" not found`);
  if (entry.enabled) return;

  const plugin = entry.module;

  // Register lifecycle hooks
  if (plugin.hooks && typeof plugin.hooks === 'object') {
    registerPlugin({ name: plugin.name, hooks: plugin.hooks, priority: plugin.priority });
  }

  // Run init
  if (typeof plugin.init === 'function') {
    await plugin.init();
  }

  entry.enabled = true;
}

/**
 * Disable a plugin (unregister hooks, run destroy).
 * @param {string} name
 */
export async function disable(name) {
  const entry = registry.get(name);
  if (!entry) throw new Error(`Plugin "${name}" not found`);
  if (!entry.enabled) return;

  const plugin = entry.module;

  // Unregister hooks
  unregisterPlugin(plugin.name);

  // Run destroy
  if (typeof plugin.destroy === 'function') {
    await plugin.destroy();
  }

  entry.enabled = false;
}

/**
 * List all registered plugins.
 * @returns {Array<{name: string, version: string, description: string, enabled: boolean, hasHooks: boolean, hasContext: boolean, hasCommands: boolean}>}
 */
export function list() {
  return [...registry.values()].map(({ meta, module, enabled }) => ({
    name: meta.name,
    version: meta.version,
    description: meta.description,
    enabled,
    hasHooks: !!(module.hooks && Object.keys(module.hooks).length),
    hasContext: typeof module.context === 'function',
    hasCommands: !!(module.commands && Object.keys(module.commands).length),
  }));
}

/**
 * Get context strings from all enabled plugins that provide context().
 * @param {object} [opts]
 * @returns {Promise<Array<{plugin: string, context: string}>>}
 */
export async function gatherContexts(opts = {}) {
  const contexts = [];
  for (const [name, entry] of registry) {
    if (!entry.enabled || typeof entry.module.context !== 'function') continue;
    try {
      const ctx = await entry.module.context(opts);
      if (ctx) contexts.push({ plugin: name, context: ctx });
    } catch {
      // Graceful skip
    }
  }
  return contexts;
}

/**
 * Get all CLI commands from enabled plugins.
 * @returns {object} Map of commandName → { desc, run, plugin }
 */
export function getCommands() {
  const commands = {};
  for (const [name, entry] of registry) {
    if (!entry.enabled || !entry.module.commands) continue;
    for (const [cmd, handler] of Object.entries(entry.module.commands)) {
      commands[cmd] = { ...handler, plugin: name };
    }
  }
  return commands;
}

/**
 * Get a specific plugin's module.
 * @param {string} name
 * @returns {object|null}
 */
export function get(name) {
  return registry.get(name)?.module || null;
}

/**
 * Save plugin enabled/disabled state.
 */
export async function saveState() {
  const state = {};
  for (const [name, entry] of registry) {
    state[name] = { enabled: entry.enabled };
  }
  await writeFile(PLUGIN_STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Load plugin state and apply enabled/disabled.
 */
export async function loadState() {
  if (!existsSync(PLUGIN_STATE_FILE)) return;
  try {
    const state = JSON.parse(await readFile(PLUGIN_STATE_FILE, 'utf-8'));
    for (const [name, s] of Object.entries(state)) {
      if (registry.has(name)) {
        if (s.enabled && !registry.get(name).enabled) await enable(name);
        if (!s.enabled && registry.get(name).enabled) await disable(name);
      }
    }
  } catch { /* ignore */ }
}

/**
 * Clear all plugins (for testing).
 */
export async function clear() {
  for (const name of [...registry.keys()]) {
    await disable(name).catch(() => {});
  }
  registry.clear();
}
