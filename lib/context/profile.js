/**
 * Context Profile — User preferences and personalization.
 * 
 * Persists user preferences to ~/.modus-forge/profile.json.
 * Learns from usage patterns to suggest better defaults.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.modus-forge');
const PROFILE_PATH = join(CONFIG_DIR, 'profile.json');

const DEFAULT_PROFILE = {
  name: null,
  preferredStyle: 'cyberpunk',
  preferredModel: 'gemini',
  preferredLang: 'en',
  customPalette: null,
  customFont: null,
  history: [],        // { intent, model, style, grade, timestamp }
  totalForged: 0,
  avgScore: 0,
};

/**
 * Load user profile from disk.
 * @returns {object} Profile
 */
export function loadProfile() {
  try {
    const raw = readFileSync(PROFILE_PATH, 'utf-8');
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

/**
 * Save user profile to disk.
 * @param {object} profile
 */
export function saveProfile(profile) {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2), 'utf-8');
  } catch (err) {
    console.error(`⚠️  Could not save profile: ${err.message}`);
  }
}

/**
 * Record a forge result in the profile history.
 * @param {object} profile
 * @param {{ intent: string, model: string, style: string, grade: string, score: number }} entry
 * @returns {object} Updated profile
 */
export function recordForge(profile, entry) {
  const updated = { ...profile };
  updated.history = [
    { ...entry, timestamp: new Date().toISOString() },
    ...(updated.history || []).slice(0, 49), // keep last 50
  ];
  updated.totalForged = (updated.totalForged || 0) + 1;

  // Recalculate average score from recent history
  const scores = updated.history
    .filter(h => typeof h.score === 'number')
    .slice(0, 20)
    .map(h => h.score);
  updated.avgScore = scores.length > 0
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
    : 0;

  saveProfile(updated);
  return updated;
}

/**
 * Suggest the best model based on past performance.
 * @param {object} profile
 * @returns {{ model: string, confidence: number, reason: string }}
 */
export function suggestModel(profile) {
  const history = (profile.history || []).filter(h => h.score != null);
  if (history.length < 3) {
    return { model: 'gemini', confidence: 0.5, reason: 'Not enough history — defaulting to Gemini' };
  }

  // Group by model, get average score
  const modelScores = {};
  for (const h of history.slice(0, 30)) {
    const m = h.model || 'gemini';
    if (!modelScores[m]) modelScores[m] = [];
    modelScores[m].push(h.score);
  }

  let bestModel = 'gemini';
  let bestAvg = 0;
  for (const [model, scores] of Object.entries(modelScores)) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestModel = model;
    }
  }

  return {
    model: bestModel,
    confidence: Math.min(1, history.length / 10),
    reason: `${bestModel} averages ${(bestAvg * 100).toFixed(0)}% across ${modelScores[bestModel].length} runs`,
  };
}

/**
 * Generate a profile context string for the enhancer.
 * @param {object} profile
 * @returns {string}
 */
export function profileContext(profile) {
  const parts = [];
  if (profile.name) parts.push(`User: ${profile.name}`);
  if (profile.preferredLang !== 'en') parts.push(`Preferred language: ${profile.preferredLang}`);
  if (profile.customPalette) parts.push(`Custom palette: ${profile.customPalette.join(', ')}`);
  if (profile.customFont) parts.push(`Custom font: ${profile.customFont}`);
  if (profile.totalForged > 5) parts.push(`Experienced user (${profile.totalForged} apps forged)`);
  return parts.join('. ');
}
