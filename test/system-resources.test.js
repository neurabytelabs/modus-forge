import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { systemResourcesContext } from '../lib/context/system-resources.js';

describe('System Resources Context', () => {
  it('returns cpu, memory, disk, and complexity', () => {
    const ctx = systemResourcesContext();
    assert.ok(typeof ctx.cpu === 'number', 'cpu should be a number');
    assert.ok(ctx.memory.totalGB >= 0, 'totalGB should be >= 0');
    assert.ok(ctx.memory.usedPercent >= 0 && ctx.memory.usedPercent <= 100, 'usedPercent 0-100');
    assert.ok(ctx.disk.totalGB >= 0, 'disk totalGB >= 0');
    assert.ok(['minimal', 'moderate', 'full'].includes(ctx.complexity.level), 'complexity level valid');
    assert.ok(ctx.summary.includes('CPU'), 'summary mentions CPU');
  });

  it('caches results on second call', () => {
    const a = systemResourcesContext();
    const b = systemResourcesContext();
    assert.deepStrictEqual(a, b, 'cached result should be identical');
  });

  it('complexity hint is a non-empty string', () => {
    const ctx = systemResourcesContext();
    assert.ok(ctx.complexity.hint.length > 10, 'hint should be descriptive');
  });
});
