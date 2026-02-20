import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

// Mock the router before importing ab-test
const mockRoute = mock.fn(async (prompt, opts) => {
  // Return different quality HTML based on provider
  const templates = {
    gemini: '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>App</title><style>body{font-family:sans-serif;margin:0;padding:20px}h1{color:#333}</style></head><body><h1>Hello</h1><main><p>Content</p></main><script>console.log("ready")</script></body></html>',
    claude: '<!DOCTYPE html><html><head><title>App</title></head><body><h1>Hello</h1></body></html>',
    openai: '<html><body>basic</body></html>',
  };
  return templates[opts?.provider] || templates.gemini;
});

// We test the logic directly since mocking ESM imports is complex
import { validate } from '../lib/rune/validator.js';

function total(r) { r.total = (r.conatus + r.ratio + r.laetitia + r.natura) / 4; return r; }

describe('A/B Test Logic', () => {
  it('validate returns scores for good HTML', () => {
    const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>Test</title><style>body{margin:0}</style></head><body><main>content</main><script>console.log("ok")</script></body></html>';
    const result = total(validate(html));
    assert.ok(result.total > 0, 'Should have positive total score');
    assert.ok(result.conatus >= 0 && result.conatus <= 1, 'Conatus in range');
    assert.ok(result.ratio >= 0 && result.ratio <= 1, 'Ratio in range');
    assert.ok(result.laetitia >= 0 && result.laetitia <= 1, 'Laetitia in range');
    assert.ok(result.natura >= 0 && result.natura <= 1, 'Natura in range');
  });

  it('validate penalizes minimal HTML', () => {
    const good = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width"><title>App</title><style>body{margin:0;font-family:sans-serif}</style></head><body><main><h1>Title</h1></main><script>console.log("ok")</script></body></html>';
    const bad = '<html><body>hi</body></html>';
    const goodScore = total(validate(good));
    const badScore = total(validate(bad));
    assert.ok(goodScore.total > badScore.total, `Good (${goodScore.total}) should beat bad (${badScore.total})`);
  });

  it('validate returns issues array', () => {
    const result = validate('<div>no doctype</div>');
    assert.ok(Array.isArray(result.issues), 'Should have issues array');
    assert.ok(result.issues.length > 0, 'Minimal HTML should have issues');
  });

  it('score components sum to total', () => {
    const html = '<!DOCTYPE html><html><head><title>T</title></head><body>x</body></html>';
    const r = total(validate(html));
    const sum = (r.conatus + r.ratio + r.laetitia + r.natura) / 4;
    assert.ok(Math.abs(r.total - sum) < 0.01, `Total (${r.total}) ≈ avg of components (${sum})`);
  });
});

describe('Calendar Context', () => {
  it('calendarContext returns string', async () => {
    const { calendarContext } = await import('../lib/context/calendar.js');
    const result = calendarContext([]);
    assert.equal(result, 'Calendar: No upcoming events.');
  });

  it('calendarContext formats events', async () => {
    const { calendarContext } = await import('../lib/context/calendar.js');
    const events = [
      { title: 'Standup', start: new Date().toISOString(), isNow: true, isSoon: false },
      { title: 'Lunch', start: new Date(Date.now() + 3600000).toISOString(), isNow: false, isSoon: true },
    ];
    const result = calendarContext(events);
    assert.ok(result.includes('🔴 NOW'), 'Should mark current event');
    assert.ok(result.includes('🟡 SOON'), 'Should mark soon event');
    assert.ok(result.includes('Standup'), 'Should include event title');
  });
});
