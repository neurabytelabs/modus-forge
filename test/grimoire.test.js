import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { inscribe, search, toggleFavorite, recordUse, updateScore, remove, allTags, allCategories, stats, get, list } from '../lib/grimoire/store.js';
import { existsSync, mkdirSync, writeFileSync, unlinkSync, rmSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const GRIMOIRE_PATH = join(homedir(), '.modus-forge', 'grimoire.json');
let backup = null;

before(() => {
  if (existsSync(GRIMOIRE_PATH)) {
    backup = readFileSync(GRIMOIRE_PATH, 'utf-8');
  }
  writeFileSync(GRIMOIRE_PATH, JSON.stringify({ entries: [], version: 1 }));
});

after(() => {
  // Restore backup
  if (backup) writeFileSync(GRIMOIRE_PATH, backup);
  else if (existsSync(GRIMOIRE_PATH)) unlinkSync(GRIMOIRE_PATH);
});

describe('Grimoire Store', () => {
  let testId;

  it('inscribes a prompt', () => {
    const entry = inscribe('Create a dark dashboard with real-time charts', {
      tags: ['dashboard', 'dark-mode', 'charts'],
      category: 'ui',
      score: 0.85,
    });
    assert.ok(entry.id.startsWith('grm_'));
    assert.equal(entry.prompt, 'Create a dark dashboard with real-time charts');
    assert.deepEqual(entry.tags, ['dashboard', 'dark-mode', 'charts']);
    assert.equal(entry.category, 'ui');
    assert.equal(entry.favorite, false);
    assert.equal(entry.usedCount, 0);
    testId = entry.id;
  });

  it('inscribes more prompts', () => {
    inscribe('Build a Spinoza-themed landing page', { tags: ['spinoza', 'landing'], category: 'marketing' });
    inscribe('Generate a CLI help output formatter', { tags: ['cli', 'terminal'], category: 'tools', score: 0.92 });
    inscribe('Create an animated logo with SVG', { tags: ['svg', 'animation'], category: 'ui' });
  });

  it('searches by text', () => {
    const results = search('dashboard');
    assert.ok(results.length >= 1);
    assert.ok(results[0].prompt.includes('dashboard'));
  });

  it('searches by tag', () => {
    const results = search('', { tags: ['spinoza'] });
    assert.ok(results.length >= 1);
    assert.ok(results[0].tags.includes('spinoza'));
  });

  it('searches by category', () => {
    const results = search('', { category: 'ui' });
    assert.ok(results.length >= 2);
    results.forEach(r => assert.equal(r.category, 'ui'));
  });

  it('toggles favorite', () => {
    const updated = toggleFavorite(testId);
    assert.equal(updated.favorite, true);
    const again = toggleFavorite(testId);
    assert.equal(again.favorite, false);
  });

  it('filters favorites only', () => {
    toggleFavorite(testId); // make it favorite
    const results = search('', { favoritesOnly: true });
    assert.ok(results.length >= 1);
    results.forEach(r => assert.equal(r.favorite, true));
  });

  it('records usage', () => {
    const updated = recordUse(testId);
    assert.equal(updated.usedCount, 1);
    recordUse(testId);
    const check = get(testId);
    assert.equal(check.usedCount, 2);
  });

  it('updates score', () => {
    const updated = updateScore(testId, 0.95);
    assert.equal(updated.score, 0.95);
  });

  it('lists tags and categories', () => {
    const tags = allTags();
    assert.ok(tags.includes('dashboard'));
    assert.ok(tags.includes('spinoza'));
    const cats = allCategories();
    assert.ok(cats.includes('ui'));
    assert.ok(cats.includes('marketing'));
  });

  it('provides stats', () => {
    const s = stats();
    assert.ok(s.total >= 4);
    assert.ok(s.favorites >= 1);
    assert.ok(s.categories >= 2);
    assert.ok(s.avgScore > 0);
  });

  it('lists with pagination', () => {
    const { entries, total } = list({ limit: 2 });
    assert.equal(entries.length, 2);
    assert.ok(total >= 4);
  });

  it('removes an entry', () => {
    const result = remove(testId);
    assert.equal(result, true);
    assert.equal(get(testId), null);
  });
});
