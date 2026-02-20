import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSpellPack, exportSpell, importSpell, spellToText, remixSpell } from '../lib/collaboration/share.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const TMP = join(import.meta.dirname, '..', '.test-tmp-share');

describe('Share — Spell Packs', () => {
  it('creates spell pack from result', () => {
    const result = {
      prompt: 'crypto dashboard',
      enhanced: 'Enhanced: crypto dashboard with real-time data',
      context: { timeOfDay: 'evening', location: { city: 'Berlin', country: 'DE' } },
      provider: 'gemini',
      code: '<html>...</html>',
      scores: { conatus: 8, ratio: 7, laetitia: 9, natura: 8, total: 32 },
    };
    
    const spell = createSpellPack(result, { author: 'morty', tags: ['crypto', 'dashboard'] });
    
    assert.equal(spell._format, 'modus-forge-spell');
    assert.equal(spell.prompt, 'crypto dashboard');
    assert.equal(spell.author, 'morty');
    assert.deepEqual(spell.tags, ['crypto', 'dashboard']);
    // Location anonymized — only country kept
    assert.equal(spell.context.location.country, 'DE');
    assert.equal(spell.context.location.city, undefined);
  });

  it('exports and imports spell', () => {
    mkdirSync(TMP, { recursive: true });
    
    const spell = createSpellPack({ prompt: 'test', code: '<h1>hi</h1>' });
    const path = join(TMP, 'test.spell.json');
    exportSpell(spell, path);
    
    const imported = importSpell(path);
    assert.equal(imported.prompt, 'test');
    assert.equal(imported._format, 'modus-forge-spell');
    
    rmSync(TMP, { recursive: true, force: true });
  });

  it('rejects invalid spell file', () => {
    mkdirSync(TMP, { recursive: true });
    const path = join(TMP, 'bad.spell.json');
    writeFileSync(path, JSON.stringify({ foo: 'bar' }));
    
    assert.throws(() => importSpell(path), /Not a valid spell pack/);
    
    rmSync(TMP, { recursive: true, force: true });
  });

  it('generates text summary', () => {
    const spell = createSpellPack({
      prompt: 'weather widget',
      provider: 'claude',
      scores: { conatus: 9, ratio: 8, laetitia: 7, natura: 8, total: 32 },
    });
    
    const text = spellToText(spell);
    assert.ok(text.includes('weather widget'));
    assert.ok(text.includes('32/40'));
    assert.ok(text.includes('MODUS Forge'));
  });

  it('remixes spell', () => {
    const original = createSpellPack({ prompt: 'original idea', code: '<div/>' }, { author: 'creator' });
    const remix = remixSpell(original, { prompt: 'remixed idea', author: 'remixer' });
    
    assert.equal(remix.prompt, 'remixed idea');
    assert.equal(remix.author, 'remixer');
    assert.equal(remix.output, null); // Cleared for regeneration
    assert.ok(remix.tags.includes('remix'));
    assert.ok(remix.notes.includes('Remixed from'));
  });
});
