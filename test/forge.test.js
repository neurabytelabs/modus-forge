import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { enhance } from '../lib/rune/enhancer.js';
import { validate } from '../lib/rune/validator.js';
import { buildSystemInstruction, detectProvider } from '../lib/rune/system-instruction.js';

describe('RUNE Enhancer', () => {
  it('should enhance a raw intent into a structured prompt', () => {
    const result = enhance('Track my sleep');
    assert.ok(result.includes('Track my sleep'));
    assert.ok(result.includes('REQUIREMENTS'));
    assert.ok(result.includes('VISUAL DESIGN'));
  });

  it('should apply style presets', () => {
    const minimal = enhance('Budget app', { style: 'minimal' });
    assert.ok(minimal.includes('Inter'));
    assert.ok(minimal.includes('clean whitespace'));

    const terminal = enhance('Budget app', { style: 'terminal' });
    assert.ok(terminal.includes('IBM Plex Mono'));
    assert.ok(terminal.includes('green-on-black'));
  });

  it('should support language option', () => {
    const result = enhance('Track sleep', { lang: 'tr' });
    assert.ok(result.includes('Language: tr'));
  });
});

describe('RUNE Validator', () => {
  const goodHtml = `<!DOCTYPE html>
<html><head><title>Test App</title></head>
<body>
<header><h1>🏃 Tracker</h1></header>
<main>
  <form><input type="text" placeholder="Enter data" aria-label="Data"><button>Save</button></form>
  <canvas id="chart"></canvas>
</main>
<style>
  :root { --bg: #1a1a2e; }
  * { transition: all 0.2s; }
  body { background: linear-gradient(var(--bg), #000); font-family: Inter; }
  @media (max-width: 768px) { main { padding: 1rem; } }
</style>
<script>
  document.querySelector('button').addEventListener('click', () => {
    try { localStorage.setItem('test', 'data'); } catch(e) {}
  });
</script>
</body></html>`;

  it('should score good HTML highly', () => {
    const report = validate(goodHtml);
    assert.ok(report.conatus >= 0.7, `Conatus ${report.conatus} < 0.7`);
    assert.ok(report.ratio >= 0.6, `Ratio ${report.ratio} < 0.6`);
    assert.ok(report.laetitia >= 0.7, `Laetitia ${report.laetitia} < 0.7`);
    assert.ok(report.natura >= 0.6, `Natura ${report.natura} < 0.6`);
    assert.ok(['S', 'A'].includes(report.grade));
  });

  it('should score empty HTML poorly', () => {
    const report = validate('<html><body>Hello</body></html>');
    assert.ok(report.conatus <= 0.3);
    assert.ok(report.grade === 'D' || report.grade === 'C');
  });

  it('should return issues array', () => {
    const report = validate('<p>bare</p>');
    assert.ok(Array.isArray(report.issues));
    assert.ok(report.issues.length > 0);
  });
});

describe('System Instruction Builder', () => {
  it('should generate base instruction', () => {
    const inst = buildSystemInstruction();
    assert.ok(inst.includes('MODUS Forge'));
    assert.ok(inst.includes('Conatus'));
    assert.ok(inst.includes('<!DOCTYPE html>'));
  });

  it('should add provider tweaks for gemini', () => {
    const inst = buildSystemInstruction({ model: 'gemini-3-flash-preview' });
    assert.ok(inst.includes('canvas for charts'));
  });

  it('should add provider tweaks for claude', () => {
    const inst = buildSystemInstruction({ model: 'claude-sonnet-4-5' });
    assert.ok(inst.includes('class-based patterns'));
  });

  it('should add features list', () => {
    const inst = buildSystemInstruction({ features: ['dark mode', 'export CSV'] });
    assert.ok(inst.includes('dark mode'));
    assert.ok(inst.includes('export CSV'));
  });
});

describe('Provider Detection', () => {
  it('should detect gemini models', () => {
    assert.equal(detectProvider('gemini-3-flash-preview'), 'gemini');
    assert.equal(detectProvider('gemini-3-pro-preview'), 'gemini');
  });

  it('should detect claude models', () => {
    assert.equal(detectProvider('claude-sonnet-4-5-thinking'), 'claude');
    assert.equal(detectProvider('claude-opus-4-6'), 'claude');
  });

  it('should detect openai models', () => {
    assert.equal(detectProvider('gpt-5.2'), 'openai');
    assert.equal(detectProvider('o3'), 'openai');
    assert.equal(detectProvider('grok-4-1-fast'), 'openai');
  });
});
