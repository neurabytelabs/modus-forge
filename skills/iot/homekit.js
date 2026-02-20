/**
 * HomeKit Skill — Smart home context from Apple HomeKit.
 * 
 * Reads home state via `shortcuts` CLI (requires configured Shortcuts).
 * Provides room/device/scene context for environment-aware generation.
 * 
 * Philosophy: "Extension is an attribute of God" — Spinoza, Ethics II, Prop 2
 * The physical world (IoT) is an extension of the digital substance.
 * 
 * NOTE: Stub — requires Apple Shortcuts "Get Home State" to be configured.
 */

import { execSync } from 'node:child_process';

let cache = { data: null, ts: 0 };
const CACHE_TTL = 300_000; // 5 minutes

/**
 * @typedef {Object} HomeState
 * @property {Array<{ name: string, room: string, type: string, state: string }>} devices
 * @property {string[]} activeScenes
 * @property {{ temp: number|null, humidity: number|null }} climate
 * @property {string} summary
 */

/**
 * Get HomeKit state via Apple Shortcuts.
 * Requires a Shortcut named "Get Home State" that outputs JSON.
 * @returns {HomeState}
 */
export function homeContext() {
  const now = Date.now();
  if (cache.data && (now - cache.ts) < CACHE_TTL) return cache.data;

  try {
    const raw = execSync('shortcuts run "Get Home State" 2>/dev/null', {
      encoding: 'utf-8', timeout: 10_000
    }).trim();
    const state = JSON.parse(raw);
    const data = {
      devices: state.devices || [],
      activeScenes: state.scenes || [],
      climate: {
        temp: state.temperature ?? null,
        humidity: state.humidity ?? null
      },
      summary: buildSummary(state)
    };
    cache = { data, ts: now };
    return data;
  } catch {
    // Graceful fallback — HomeKit not available
    const fallback = {
      devices: [],
      activeScenes: [],
      climate: { temp: null, humidity: null },
      summary: 'HomeKit: not available (Shortcut not configured)'
    };
    cache = { data: fallback, ts: now };
    return fallback;
  }
}

function buildSummary(state) {
  const parts = [];
  const lights = (state.devices || []).filter(d => d.type === 'light' && d.state === 'on');
  if (lights.length) parts.push(`${lights.length} lights on`);
  if (state.temperature != null) parts.push(`${state.temperature}°C indoors`);
  if (state.scenes?.length) parts.push(`Scene: ${state.scenes.join(', ')}`);
  return parts.length ? `HomeKit: ${parts.join(', ')}` : 'HomeKit: all quiet';
}
