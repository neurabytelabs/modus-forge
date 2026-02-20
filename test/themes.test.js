import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getTheme, listThemes, themeToCSS, applyTheme, createTheme, suggestTheme, THEMES } from '../lib/themes/manager.js';

describe('Theme Manager', () => {
  it('has 6 built-in themes', () => {
    const themes = listThemes();
    assert.equal(themes.length, 6);
    const keys = themes.map(t => t.key);
    assert.ok(keys.includes('cyberpunk'));
    assert.ok(keys.includes('paper'));
    assert.ok(keys.includes('noir'));
  });

  it('getTheme returns theme by name', () => {
    const t = getTheme('cyberpunk');
    assert.ok(t);
    assert.equal(t.name, 'Cyberpunk');
    assert.ok(t.vars['--bg']);
    assert.ok(t.vars['--accent']);
  });

  it('getTheme is case-insensitive', () => {
    assert.ok(getTheme('CYBERPUNK'));
    assert.ok(getTheme('Paper'));
  });

  it('getTheme returns null for unknown', () => {
    assert.equal(getTheme('nonexistent'), null);
  });

  it('themeToCSS generates valid CSS', () => {
    const css = themeToCSS('noir');
    assert.ok(css.includes(':root'));
    assert.ok(css.includes('--bg: #000000'));
    assert.ok(css.includes('--text: #ffffff'));
  });

  it('themeToCSS handles null gracefully', () => {
    assert.equal(themeToCSS('nonexistent'), '');
  });

  it('applyTheme injects into HTML head', () => {
    const html = '<html><head><title>Test</title></head><body></body></html>';
    const result = applyTheme(html, 'cyberpunk');
    assert.ok(result.includes('id="forge-theme"'));
    assert.ok(result.includes('--bg: #0a0a0f'));
    assert.ok(result.includes('</head>'));
  });

  it('applyTheme replaces existing theme', () => {
    const html = '<style id="forge-theme">:root { --bg: red; }</style><body></body>';
    const result = applyTheme(html, 'paper');
    assert.ok(result.includes('--bg: #faf8f5'));
    assert.ok(!result.includes('--bg: red'));
    // Only one forge-theme block
    const matches = result.match(/id="forge-theme"/g);
    assert.equal(matches.length, 1);
  });

  it('applyTheme handles HTML without head', () => {
    const html = '<div>Hello</div>';
    const result = applyTheme(html, 'forest');
    assert.ok(result.includes('forge-theme'));
    assert.ok(result.includes('<div>Hello</div>'));
  });

  it('createTheme extends cyberpunk defaults', () => {
    const custom = createTheme('Custom', { '--bg': '#ff0000', '--accent': '#00ff00' }, 'My theme');
    assert.equal(custom.name, 'Custom');
    assert.equal(custom.vars['--bg'], '#ff0000');
    assert.equal(custom.vars['--accent'], '#00ff00');
    // Inherited from cyberpunk
    assert.equal(custom.vars['--text'], '#e0e0e0');
  });

  it('suggestTheme returns time-appropriate themes', () => {
    assert.equal(suggestTheme(7), 'paper');
    assert.equal(suggestTheme(12), 'arctic');
    assert.equal(suggestTheme(17), 'sunset');
    assert.equal(suggestTheme(20), 'cyberpunk');
    assert.equal(suggestTheme(23), 'noir');
    assert.equal(suggestTheme(3), 'noir');
  });

  it('all themes have consistent CSS vars', () => {
    const requiredVars = ['--bg', '--surface', '--text', '--accent', '--font-body', '--font-mono', '--radius'];
    for (const [key, theme] of Object.entries(THEMES)) {
      for (const v of requiredVars) {
        assert.ok(v in theme.vars, `${key} missing var ${v}`);
      }
    }
  });
});
