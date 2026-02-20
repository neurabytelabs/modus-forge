import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectLocation, locationContext } from '../lib/context/location.js';

describe('Location Context', () => {
  it('detectLocation returns object or null', async () => {
    const loc = await detectLocation();
    // May be null in CI/offline — that's fine
    if (loc) {
      assert.ok(loc.city, 'should have city');
      assert.ok(loc.country, 'should have country');
      assert.ok(loc.source, 'should have source');
    }
  });

  it('locationContext returns string', async () => {
    const ctx = await locationContext();
    assert.equal(typeof ctx, 'string');
    // May be empty if offline
  });

  it('respects env var override', async () => {
    process.env.FORGE_CITY = 'TestCity';
    process.env.FORGE_COUNTRY = 'XX';
    // Clear cache
    const { unlinkSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { homedir } = await import('node:os');
    try { unlinkSync(join(homedir(), '.forge-location-cache.json')); } catch {}

    const loc = await detectLocation();
    assert.equal(loc.city, 'TestCity');
    assert.equal(loc.country, 'XX');
    assert.equal(loc.source, 'env');

    delete process.env.FORGE_CITY;
    delete process.env.FORGE_COUNTRY;
  });
});
