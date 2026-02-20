/**
 * lib/config/loader.js — Unified Configuration Loader
 * 
 * Priority (highest first):
 * 1. Environment variables (FORGE_*)
 * 2. Project-local .forgerc.json
 * 3. User-level ~/.forgerc.json
 * 4. Built-in defaults
 * 
 * "The order and connection of ideas is the same as the order
 *  and connection of things." — Spinoza, Ethics II, Prop 7
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DEFAULTS = {
  provider: 'gemini',
  model: null,           // null = let provider decide
  temperature: 0.7,
  maxTokens: 4096,
  theme: 'cyberpunk',
  persona: 'architect',
  cacheTtlMs: 30 * 60 * 1000,
  cacheMaxSize: 100,
  iterationPatience: 2,
  iterationThreshold: 0.8,
  previewPort: 3456,
  outputDir: './output',
  grimoire: './grimoire',
  telemetry: true,
  security: {
    sanitize: true,
    maxOutputBytes: 512 * 1024,
    blockPatterns: true
  },
  context: {
    time: true,
    weather: true,
    git: true,
    health: false,
    music: false,
    news: false,
    location: false,
    social: false,
    system: true
  }
};

/**
 * Deep merge b into a (a wins on conflict only if b is undefined)
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] === undefined) continue;
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])
        && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * Load JSON file, return {} if missing/invalid
 */
function loadJsonFile(path) {
  try {
    if (!existsSync(path)) return {};
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * Extract FORGE_* env vars into config shape
 * FORGE_PROVIDER=grok → { provider: 'grok' }
 * FORGE_CACHE_TTL_MS=60000 → { cacheTtlMs: 60000 }
 * FORGE_CONTEXT_WEATHER=false → { context: { weather: false } }
 * FORGE_SECURITY_SANITIZE=true → { security: { sanitize: true } }
 */
function envToConfig(env = process.env) {
  const config = {};
  const PREFIX = 'FORGE_';
  
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith(PREFIX)) continue;
    const parts = key.slice(PREFIX.length).toLowerCase().split('_');
    
    // Convert snake_case parts to camelCase path
    let parsed = parseValue(value);
    
    if (parts.length === 1) {
      config[camelCase(parts)] = parsed;
    } else if (parts[0] === 'context' || parts[0] === 'security') {
      if (!config[parts[0]]) config[parts[0]] = {};
      config[parts[0]][camelCase(parts.slice(1))] = parsed;
    } else {
      config[camelCase(parts)] = parsed;
    }
  }
  return config;
}

function camelCase(parts) {
  return parts[0] + parts.slice(1).map(p => p[0].toUpperCase() + p.slice(1)).join('');
}

function parseValue(v) {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null') return null;
  if (/^\d+$/.test(v)) return parseInt(v, 10);
  if (/^\d+\.\d+$/.test(v)) return parseFloat(v);
  return v;
}

/**
 * Load config with full priority chain
 * @param {object} [overrides] - Runtime overrides (highest priority)
 * @param {string} [projectDir] - Project directory for .forgerc.json lookup
 * @returns {object} Merged configuration
 */
export function loadConfig(overrides = {}, projectDir = process.cwd()) {
  const userConfig = loadJsonFile(join(homedir(), '.forgerc.json'));
  const projectConfig = loadJsonFile(join(projectDir, '.forgerc.json'));
  const envConfig = envToConfig();
  
  // Merge: defaults ← user ← project ← env ← overrides
  let config = deepMerge(DEFAULTS, userConfig);
  config = deepMerge(config, projectConfig);
  config = deepMerge(config, envConfig);
  config = deepMerge(config, overrides);
  
  return config;
}

/**
 * Get a single config value by dot-path
 * @param {string} path - e.g. 'security.sanitize' or 'provider'
 * @param {object} [config] - Pre-loaded config (loads fresh if omitted)
 */
export function getConfig(path, config = null) {
  const cfg = config || loadConfig();
  return path.split('.').reduce((obj, key) => obj?.[key], cfg);
}

export { DEFAULTS, deepMerge, envToConfig, loadJsonFile };
