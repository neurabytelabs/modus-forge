import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runAll, formatReport, isHealthy } from '../lib/doctor/check.js';

describe('Doctor', () => {
  it('runs all checks', async () => {
    const results = await runAll();
    assert.ok(Array.isArray(results));
    assert.ok(results.length > 0);
    for (const r of results) {
      assert.ok(['ok', 'warn', 'fail'].includes(r.status));
      assert.ok(r.name);
      assert.ok(r.detail);
    }
  });

  it('formats report as string', async () => {
    const results = await runAll();
    const report = formatReport(results);
    assert.ok(report.includes('Forge Doctor'));
    assert.ok(report.includes('Summary:'));
  });

  it('filters by category', async () => {
    const results = await runAll({ category: 'runtime' });
    assert.ok(results.every(r => r.category === 'runtime'));
  });

  it('isHealthy returns boolean', async () => {
    const healthy = await isHealthy();
    assert.equal(typeof healthy, 'boolean');
  });

  it('Node.js check passes', async () => {
    const results = await runAll({ category: 'runtime' });
    const nodeCheck = results.find(r => r.name === 'Node.js version');
    assert.ok(nodeCheck);
    assert.equal(nodeCheck.status, 'ok');
  });
});
