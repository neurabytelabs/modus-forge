/**
 * Grimoire Store — Prompt library with save, search, tag, and favorite.
 * Every great spell deserves a place in the book.
 * 
 * Storage: JSON file at ~/.modus-forge/grimoire.json
 * Each entry: { id, prompt, tags[], category, favorite, score, metadata, createdAt, usedCount }
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const GRIMOIRE_DIR = join(homedir(), '.modus-forge');
const GRIMOIRE_PATH = join(GRIMOIRE_DIR, 'grimoire.json');

function ensureDir() {
  if (!existsSync(GRIMOIRE_DIR)) mkdirSync(GRIMOIRE_DIR, { recursive: true });
}

function load() {
  ensureDir();
  if (!existsSync(GRIMOIRE_PATH)) return { entries: [], version: 1 };
  try {
    return JSON.parse(readFileSync(GRIMOIRE_PATH, 'utf-8'));
  } catch {
    return { entries: [], version: 1 };
  }
}

function save(data) {
  ensureDir();
  writeFileSync(GRIMOIRE_PATH, JSON.stringify(data, null, 2));
}

function generateId() {
  return `grm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Add a prompt to the grimoire
 */
export function inscribe(prompt, { tags = [], category = 'general', score = null, metadata = {} } = {}) {
  const data = load();
  const entry = {
    id: generateId(),
    prompt: prompt.trim(),
    tags: tags.map(t => t.toLowerCase().trim()),
    category: category.toLowerCase().trim(),
    favorite: false,
    score,
    metadata,
    createdAt: new Date().toISOString(),
    usedCount: 0,
  };
  data.entries.push(entry);
  save(data);
  return entry;
}

/**
 * Search grimoire by text match, tags, or category
 */
export function search(query = '', { tags = [], category = null, favoritesOnly = false, limit = 20 } = {}) {
  const data = load();
  let results = data.entries;

  if (favoritesOnly) results = results.filter(e => e.favorite);
  if (category) results = results.filter(e => e.category === category.toLowerCase());
  if (tags.length) {
    const lowerTags = tags.map(t => t.toLowerCase());
    results = results.filter(e => lowerTags.some(t => e.tags.includes(t)));
  }
  if (query) {
    const q = query.toLowerCase();
    results = results.filter(e =>
      e.prompt.toLowerCase().includes(q) ||
      e.tags.some(t => t.includes(q)) ||
      e.category.includes(q)
    );
  }

  // Sort: favorites first, then by score (desc), then by usedCount (desc)
  results.sort((a, b) => {
    if (a.favorite !== b.favorite) return b.favorite ? 1 : -1;
    if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
    return (b.usedCount || 0) - (a.usedCount || 0);
  });

  return results.slice(0, limit);
}

/**
 * Toggle favorite on an entry
 */
export function toggleFavorite(id) {
  const data = load();
  const entry = data.entries.find(e => e.id === id);
  if (!entry) return null;
  entry.favorite = !entry.favorite;
  save(data);
  return entry;
}

/**
 * Record usage of a prompt (increment usedCount)
 */
export function recordUse(id) {
  const data = load();
  const entry = data.entries.find(e => e.id === id);
  if (!entry) return null;
  entry.usedCount = (entry.usedCount || 0) + 1;
  save(data);
  return entry;
}

/**
 * Update score on an entry (from Spinoza validation)
 */
export function updateScore(id, score) {
  const data = load();
  const entry = data.entries.find(e => e.id === id);
  if (!entry) return null;
  entry.score = score;
  save(data);
  return entry;
}

/**
 * Remove an entry
 */
export function remove(id) {
  const data = load();
  const before = data.entries.length;
  data.entries = data.entries.filter(e => e.id !== id);
  save(data);
  return data.entries.length < before;
}

/**
 * Get all unique tags
 */
export function allTags() {
  const data = load();
  const tagSet = new Set();
  data.entries.forEach(e => e.tags.forEach(t => tagSet.add(t)));
  return [...tagSet].sort();
}

/**
 * Get all unique categories
 */
export function allCategories() {
  const data = load();
  return [...new Set(data.entries.map(e => e.category))].sort();
}

/**
 * Get stats
 */
export function stats() {
  const data = load();
  const entries = data.entries;
  return {
    total: entries.length,
    favorites: entries.filter(e => e.favorite).length,
    categories: [...new Set(entries.map(e => e.category))].length,
    tags: allTags().length,
    avgScore: entries.filter(e => e.score).reduce((s, e) => s + e.score, 0) / (entries.filter(e => e.score).length || 1),
    topUsed: entries.sort((a, b) => (b.usedCount || 0) - (a.usedCount || 0)).slice(0, 5).map(e => ({ id: e.id, prompt: e.prompt.slice(0, 60), usedCount: e.usedCount })),
  };
}

/**
 * Get a single entry by ID
 */
export function get(id) {
  const data = load();
  return data.entries.find(e => e.id === id) || null;
}

/**
 * List all entries (paginated)
 */
export function list({ offset = 0, limit = 50 } = {}) {
  const data = load();
  return {
    entries: data.entries.slice(offset, offset + limit),
    total: data.entries.length,
  };
}
