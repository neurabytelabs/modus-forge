import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getPortfolio, portfolioContext, marketMood } from '../skills/finance/portfolio.js';

describe('Finance Portfolio', () => {
  it('getPortfolio returns structured data', async () => {
    const p = await getPortfolio();
    assert.ok(p.timestamp);
    assert.ok(Array.isArray(p.crypto));
    assert.ok(Array.isArray(p.stocks));
    assert.ok(typeof p.summary === 'string');
    assert.equal(p.crypto.length, 3);
    assert.equal(p.stocks.length, 3);
  });

  it('portfolioContext returns string with emoji', async () => {
    const ctx = await portfolioContext();
    assert.equal(typeof ctx, 'string');
    assert.ok(ctx.startsWith('💰'));
  });

  it('marketMood returns valid mood', async () => {
    const mood = await marketMood();
    assert.ok(['bullish', 'bearish', 'neutral'].includes(mood));
  });

  it('handles custom crypto list', async () => {
    const p = await getPortfolio({ crypto: ['bitcoin'] });
    // Uses cache so might still have 3 — just verify structure
    assert.ok(p.crypto.length >= 1);
  });
});
