import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeHistory, providerReport } from '../lib/analytics/insights.js';

describe('Analytics Insights', () => {
  it('should return insights structure even with no data', () => {
    const insights = analyzeHistory();
    assert.ok(typeof insights.totalForges === 'number');
    assert.ok(typeof insights.avgScore === 'number');
    assert.ok(Array.isArray(insights.topPrompts));
    assert.ok(Array.isArray(insights.recommendations));
    assert.ok(typeof insights.trend === 'string');
  });

  it('should generate recommendations', () => {
    const insights = analyzeHistory();
    assert.ok(insights.recommendations.length > 0);
  });

  it('should return provider report', () => {
    const report = providerReport();
    assert.ok(Array.isArray(report));
  });
});
