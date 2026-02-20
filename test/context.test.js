import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sense } from '../lib/context/sensors.js';
import { loadProfile, recordForge, suggestModel, profileContext } from '../lib/context/profile.js';

describe('Context Sensors', () => {
  it('should return time mood', () => {
    const ctx = sense();
    assert.ok(ctx.time.period);
    assert.ok(ctx.time.mood);
    assert.ok(ctx.time.palette);
  });

  it('should return platform info', () => {
    const ctx = sense();
    assert.ok(ctx.platform.os);
    assert.ok(ctx.platform.timezone);
  });

  it('should build context hint string', () => {
    const ctx = sense();
    assert.ok(typeof ctx.contextHint === 'string');
    assert.ok(ctx.contextHint.length > 0);
  });

  it('should handle missing output dir gracefully', () => {
    const ctx = sense({ outputDir: '/nonexistent/path' });
    assert.equal(ctx.history.totalForged, 0);
    assert.deepEqual(ctx.history.recentApps, []);
  });
});

describe('Context Profile', () => {
  it('should load default profile when none exists', () => {
    const profile = loadProfile();
    assert.ok(profile);
    assert.equal(profile.preferredStyle, 'cyberpunk');
    assert.equal(profile.preferredModel, 'gemini');
  });

  it('should suggest model with low confidence when no history', () => {
    const suggestion = suggestModel({ history: [] });
    assert.equal(suggestion.model, 'gemini');
    assert.equal(suggestion.confidence, 0.5);
  });

  it('should suggest best model from history', () => {
    const profile = {
      history: [
        { model: 'claude', score: 0.9 },
        { model: 'claude', score: 0.85 },
        { model: 'gemini', score: 0.7 },
        { model: 'gemini', score: 0.6 },
      ],
    };
    const suggestion = suggestModel(profile);
    assert.equal(suggestion.model, 'claude');
  });

  it('should generate profile context string', () => {
    const ctx = profileContext({ name: 'Mustafa', preferredLang: 'tr', totalForged: 10 });
    assert.ok(ctx.includes('Mustafa'));
    assert.ok(ctx.includes('tr'));
    assert.ok(ctx.includes('10'));
  });

  it('should handle empty profile context', () => {
    const ctx = profileContext({ preferredLang: 'en' });
    assert.equal(ctx, '');
  });
});
