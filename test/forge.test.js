import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { enhance } from '../lib/rune/enhancer.js';
import { validate } from '../lib/rune/validator.js';
import { render } from '../lib/renderer/html.js';
import { unlinkSync, rmdirSync } from 'node:fs';

describe('RUNE Enhancer', () => {
  it('should generate a prompt from intent', () => {
    const result = enhance('Track my sleep');
    assert.ok(result.includes('Track my sleep'));
    assert.ok(result.includes('Principal Engineer'));
    assert.ok(result.includes('localStorage'));
  });

  it('should respect style option', () => {
    const result = enhance('Budget tracker', { style: 'terminal' });
    assert.ok(result.includes('green-on-black'));
  });

  it('should respect lang option', () => {
    const result = enhance('Görev takibi', { lang: 'tr' });
    assert.ok(result.includes('Language: tr'));
  });
});

describe('Spinoza Validator', () => {
  it('should score a full HTML app highly', () => {
    const goodHtml = `<!DOCTYPE html><html><head><title>App</title>
    <style>:root{--c:#0ff} .x{transition:all .3s; background:linear-gradient(#000,#111)}
    @media(max-width:600px){.x{width:100%}}</style></head>
    <body><header><main><form><input placeholder="Name">
    <button onclick="save()">Save</button></form></main></header>
    <script>try{localStorage.setItem('x','1')}catch(e){}
    document.addEventListener('click',()=>{});
    const c=document.querySelector('canvas');</script></body></html>`;
    const r = validate(goodHtml);
    assert.ok(r.conatus >= 0.7, `Conatus ${r.conatus}`);
    assert.ok(r.ratio >= 0.6, `Ratio ${r.ratio}`);
    assert.ok(r.grade === 'S' || r.grade === 'A', `Grade ${r.grade}`);
  });

  it('should score empty HTML poorly', () => {
    const r = validate('<div>hello</div>');
    assert.ok(r.conatus <= 0.3);
    assert.ok(r.grade === 'C' || r.grade === 'D');
  });
});

describe('HTML Renderer', () => {
  it('should write HTML to output dir', async () => {
    const path = await render('<html></html>', { dir: '/tmp/modus-test', intent: 'test app' });
    assert.ok(path.includes('test-app'));
    assert.ok(path.endsWith('.html'));
    try { unlinkSync(path); rmdirSync('/tmp/modus-test'); } catch {}
  });
});
