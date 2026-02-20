import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Test the refiner's logic without actually calling LLMs
// We test the validator integration which refiner depends on
import { validate } from '../lib/rune/validator.js';

describe('Refiner Integration', () => {
  it('should identify low-scoring HTML for refinement', () => {
    const bareHTML = '<!DOCTYPE html><html><body><p>Hello</p></body></html>';
    const report = validate(bareHTML);
    const avg = (report.conatus + report.ratio + report.laetitia + report.natura) / 4;
    // Bare HTML should score low — refiner would target this
    assert.ok(avg < 0.5, `Expected low score for bare HTML, got ${avg}`);
    assert.ok(report.issues.length > 0, 'Should have issues to fix');
  });

  it('should identify high-scoring HTML as not needing refinement', () => {
    const richHTML = `<!DOCTYPE html><html><head><title>App</title></head><body>
      <header><nav aria-label="main">Nav</nav></header>
      <main><section>
        <form><input placeholder="Type..."><button>Go</button></form>
        <canvas id="c"></canvas>
      </section></main>
      <footer>Footer</footer>
      <style>
        :root { --primary: #0ff; }
        * { transition: all 0.3s; }
        body { background: linear-gradient(#000, #111); }
        @media (max-width: 600px) { body { padding: 1rem; } }
      </style>
      <script>
        try {
          document.querySelector('button').addEventListener('click', () => {
            localStorage.setItem('data', JSON.stringify({}));
            const ctx = document.getElementById('c').getContext('2d');
          });
        } catch(e) {}
      </script>
    </body></html>`;
    const report = validate(richHTML);
    const avg = (report.conatus + report.ratio + report.laetitia + report.natura) / 4;
    assert.ok(avg >= 0.7, `Expected high score for rich HTML, got ${avg}`);
    assert.ok(report.grade === 'S' || report.grade === 'A', `Expected S or A grade, got ${report.grade}`);
  });
});
