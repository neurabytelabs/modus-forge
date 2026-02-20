/**
 * History — Track all forge generations with metadata.
 * 
 * Every forged app is recorded: prompt, model, scores, timestamp.
 * Enables analytics, re-forging, and learning from past generations.
 * 
 * Philosophy: "By reality and perfection I mean the same thing."
 * — Spinoza, Ethics II, Def 6
 * 
 * History is reality — what was built defines what we are.
 */

import { randomUUID } from 'node:crypto';
import * as store from './store.js';

const COLLECTION = 'history';

/**
 * @typedef {Object} HistoryEntry
 * @property {string} id - Unique generation ID
 * @property {string} prompt - Original user prompt
 * @property {string} enhancedPrompt - RUNE-enhanced prompt
 * @property {string} model - Model used
 * @property {string} provider - Provider (gemini/claude/openai)
 * @property {{ conatus: number, ratio: number, laetitia: number, natura: number }} score
 * @property {string} grade - Letter grade (S/A/B/C/D)
 * @property {number} codeLength - Length of generated HTML
 * @property {string} timestamp - ISO timestamp
 * @property {string[]} [tags] - Optional tags
 * @property {string} [style] - Style preset used
 */

/**
 * Record a generation in history.
 * @param {Object} entry
 * @param {string} entry.prompt
 * @param {string} [entry.enhancedPrompt]
 * @param {string} entry.model
 * @param {string} entry.provider
 * @param {Object} entry.score
 * @param {string} entry.grade
 * @param {string} entry.code - The generated HTML (stored separately)
 * @param {string} [entry.style]
 * @param {string[]} [entry.tags]
 * @returns {string} The generation ID
 */
export function record(entry) {
  const id = randomUUID().slice(0, 8);
  const timestamp = new Date().toISOString();

  // Store metadata in history collection
  const meta = {
    id,
    prompt: entry.prompt,
    enhancedPrompt: entry.enhancedPrompt || null,
    model: entry.model,
    provider: entry.provider,
    score: entry.score,
    grade: entry.grade,
    codeLength: entry.code?.length || 0,
    style: entry.style || null,
    tags: entry.tags || [],
    timestamp,
  };
  store.set(COLLECTION, id, meta);

  // Store code separately (can be large)
  if (entry.code) {
    store.set('generations', id, { code: entry.code, timestamp });
  }

  return id;
}

/**
 * Get a history entry by ID.
 * @param {string} id
 * @returns {HistoryEntry|undefined}
 */
export function get(id) {
  return store.get(COLLECTION, id);
}

/**
 * Get the generated code for a history entry.
 * @param {string} id
 * @returns {string|undefined}
 */
export function getCode(id) {
  const gen = store.get('generations', id);
  return gen?.code;
}

/**
 * List all history entries, newest first.
 * @param {Object} [options]
 * @param {number} [options.limit=20]
 * @param {string} [options.provider] - Filter by provider
 * @param {string} [options.minGrade] - Minimum grade (S > A > B > C > D)
 * @returns {HistoryEntry[]}
 */
export function list(options = {}) {
  const all = store.all(COLLECTION);
  let entries = Object.values(all);

  if (options.provider) {
    entries = entries.filter(e => e.provider === options.provider);
  }

  if (options.minGrade) {
    const gradeOrder = { S: 4, A: 3, B: 2, C: 1, D: 0 };
    const minRank = gradeOrder[options.minGrade] ?? 0;
    entries = entries.filter(e => (gradeOrder[e.grade] ?? 0) >= minRank);
  }

  entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return entries.slice(0, options.limit || 20);
}

/**
 * Get aggregate stats across all generations.
 * @returns {{ total: number, byProvider: Object, byGrade: Object, avgScores: Object }}
 */
export function stats() {
  const all = Object.values(store.all(COLLECTION));
  const byProvider = {};
  const byGrade = {};
  const scoreSum = { conatus: 0, ratio: 0, laetitia: 0, natura: 0 };
  let scored = 0;

  for (const entry of all) {
    byProvider[entry.provider] = (byProvider[entry.provider] || 0) + 1;
    byGrade[entry.grade] = (byGrade[entry.grade] || 0) + 1;
    if (entry.score) {
      scoreSum.conatus += entry.score.conatus || 0;
      scoreSum.ratio += entry.score.ratio || 0;
      scoreSum.laetitia += entry.score.laetitia || 0;
      scoreSum.natura += entry.score.natura || 0;
      scored++;
    }
  }

  const avgScores = scored > 0 ? {
    conatus: +(scoreSum.conatus / scored).toFixed(3),
    ratio: +(scoreSum.ratio / scored).toFixed(3),
    laetitia: +(scoreSum.laetitia / scored).toFixed(3),
    natura: +(scoreSum.natura / scored).toFixed(3),
  } : null;

  return { total: all.length, byProvider, byGrade, avgScores };
}

/**
 * Search history by prompt text.
 * @param {string} query
 * @returns {HistoryEntry[]}
 */
export function search(query) {
  const q = query.toLowerCase();
  return Object.values(store.all(COLLECTION))
    .filter(e => e.prompt?.toLowerCase().includes(q) || e.tags?.some(t => t.toLowerCase().includes(q)))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Delete a history entry and its code.
 * @param {string} id
 */
export function remove(id) {
  store.del(COLLECTION, id);
  store.del('generations', id);
}
