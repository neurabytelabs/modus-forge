/**
 * Apple Health Context Skill — Enrich forge prompts with health data.
 *
 * Reads Apple Health exports (XML) or shortcuts-exported JSON
 * to inject wellness context into generated apps.
 *
 * Philosophy: "The mind's highest good is the knowledge of God,
 * and the mind's highest virtue is to know God." — Spinoza, Ethics IV, P28
 *
 * Self-knowledge starts with the body. Health data is self-awareness.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';

const HEALTH_DIR = join(homedir(), '.modus-forge', 'health');
const SHORTCUTS_FILE = join(HEALTH_DIR, 'latest.json');

/**
 * @typedef {Object} HealthSnapshot
 * @property {number|null} steps - Steps today
 * @property {number|null} heartRate - Last resting heart rate (bpm)
 * @property {number|null} sleepHours - Hours slept last night
 * @property {number|null} activeCalories - Active calories today
 * @property {string|null} sleepQuality - 'poor' | 'fair' | 'good' | 'excellent'
 * @property {string} source - Data source description
 * @property {string} timestamp - ISO timestamp of data collection
 */

/**
 * Read health data from Apple Shortcuts export.
 *
 * Expected JSON format (from Shortcuts automation):
 * {
 *   "steps": 8234,
 *   "heartRate": 62,
 *   "sleepHours": 7.2,
 *   "activeCalories": 340,
 *   "timestamp": "2026-02-20T06:00:00Z"
 * }
 *
 * @returns {HealthSnapshot|null}
 */
export function readFromShortcuts() {
  if (!existsSync(SHORTCUTS_FILE)) return null;

  try {
    const raw = JSON.parse(readFileSync(SHORTCUTS_FILE, 'utf8'));
    const age = Date.now() - new Date(raw.timestamp).getTime();
    // Data older than 24h is stale
    if (age > 86400000) return null;

    return {
      steps: raw.steps ?? null,
      heartRate: raw.heartRate ?? null,
      sleepHours: raw.sleepHours ?? null,
      activeCalories: raw.activeCalories ?? null,
      sleepQuality: classifySleep(raw.sleepHours),
      source: 'Apple Shortcuts',
      timestamp: raw.timestamp,
    };
  } catch {
    return null;
  }
}

/**
 * Read step count from macOS Health database (if accessible).
 * Requires full disk access. Gracefully returns null if unavailable.
 * @returns {number|null}
 */
export function readStepsFromDB() {
  try {
    // healthkit_db on macOS is at ~/Library/Health/healthdb_secure.sqlite
    // Only accessible with FDA; we try a simpler approach first
    const dbPath = join(homedir(), 'Library', 'Health', 'healthdb_secure.sqlite');
    if (!existsSync(dbPath)) return null;

    const today = new Date().toISOString().slice(0, 10);
    const result = execSync(
      `sqlite3 "${dbPath}" "SELECT SUM(quantity) FROM samples WHERE data_type=7 AND DATE(start_date)='${today}'"`,
      { timeout: 5000, encoding: 'utf8' }
    ).trim();

    const steps = parseFloat(result);
    return isNaN(steps) ? null : Math.round(steps);
  } catch {
    return null;
  }
}

/**
 * Classify sleep quality by duration.
 * @param {number|null} hours
 * @returns {string|null}
 */
function classifySleep(hours) {
  if (hours == null) return null;
  if (hours < 5) return 'poor';
  if (hours < 6.5) return 'fair';
  if (hours < 8) return 'good';
  return 'excellent';
}

/**
 * Generate a wellness context hint for the enhancer.
 * @param {HealthSnapshot} data
 * @returns {string}
 */
export function toContextHint(data) {
  if (!data) return '';

  const hints = [];

  if (data.sleepHours != null) {
    hints.push(`User slept ${data.sleepHours.toFixed(1)}h (${data.sleepQuality})`);
  }
  if (data.steps != null) {
    const level = data.steps > 8000 ? 'active' : data.steps > 4000 ? 'moderate' : 'sedentary';
    hints.push(`${data.steps.toLocaleString()} steps today (${level})`);
  }
  if (data.heartRate != null) {
    hints.push(`Resting HR: ${data.heartRate} bpm`);
  }
  if (data.activeCalories != null) {
    hints.push(`${data.activeCalories} active kcal`);
  }

  return hints.length ? `Health context: ${hints.join(', ')}.` : '';
}

/**
 * Get the best available health snapshot.
 * Tries Shortcuts export first, then direct DB read for steps.
 * @returns {HealthSnapshot|null}
 */
export function getHealthSnapshot() {
  // Primary: Shortcuts export (most complete)
  let data = readFromShortcuts();

  // Fallback: try direct step count
  if (!data) {
    const steps = readStepsFromDB();
    if (steps != null) {
      data = {
        steps,
        heartRate: null,
        sleepHours: null,
        activeCalories: null,
        sleepQuality: null,
        source: 'HealthKit DB (steps only)',
        timestamp: new Date().toISOString(),
      };
    }
  }

  return data;
}

/**
 * Suggest app theme based on health state.
 * Tired users get calming apps; energetic users get vibrant ones.
 * @param {HealthSnapshot|null} data
 * @returns {{ mood: string, palette: string, suggestion: string }}
 */
export function suggestTheme(data) {
  if (!data) return { mood: 'neutral', palette: 'balanced', suggestion: '' };

  if (data.sleepQuality === 'poor') {
    return {
      mood: 'calm, gentle',
      palette: 'soft blues and warm grays',
      suggestion: 'User may be tired — keep UI simple and soothing',
    };
  }

  if (data.steps > 8000 && data.sleepQuality !== 'poor') {
    return {
      mood: 'energetic, vibrant',
      palette: 'bright greens and dynamic gradients',
      suggestion: 'User is active — can handle complex, engaging UIs',
    };
  }

  return { mood: 'balanced', palette: 'clean and focused', suggestion: '' };
}
