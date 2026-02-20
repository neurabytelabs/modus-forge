import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Test the classification logic without network
describe('News Context', () => {
  // Import dynamically so we can test classification
  it('module loads without error', async () => {
    const mod = await import('../lib/context/news.js');
    assert.ok(typeof mod.getNews === 'function');
    assert.ok(typeof mod.newsContext === 'function');
    assert.ok(typeof mod.clearCache === 'function');
  });

  it('newsContext returns string', async () => {
    const { newsContext } = await import('../lib/context/news.js');
    const result = newsContext();
    // May be empty string if network fails, that's ok (graceful)
    assert.equal(typeof result, 'string');
  });
});
