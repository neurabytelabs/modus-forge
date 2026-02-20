import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { toContextHint, suggestTheme } from '../skills/health/apple-health.js';

describe('Apple Health — Context Hints', () => {
  it('should return empty string for null data', () => {
    assert.equal(toContextHint(null), '');
  });

  it('should format sleep data', () => {
    const hint = toContextHint({
      sleepHours: 7.5, sleepQuality: 'good',
      steps: null, heartRate: null, activeCalories: null,
    });
    assert.ok(hint.includes('7.5h'));
    assert.ok(hint.includes('good'));
  });

  it('should format steps with activity level', () => {
    const hint = toContextHint({
      steps: 10234, sleepHours: null, sleepQuality: null,
      heartRate: null, activeCalories: null,
    });
    assert.ok(hint.includes('10,234'));
    assert.ok(hint.includes('active'));
  });

  it('should combine all health signals', () => {
    const hint = toContextHint({
      steps: 5000, sleepHours: 6.0, sleepQuality: 'fair',
      heartRate: 65, activeCalories: 200,
    });
    assert.ok(hint.includes('steps'));
    assert.ok(hint.includes('6.0h'));
    assert.ok(hint.includes('65 bpm'));
    assert.ok(hint.includes('200 active kcal'));
  });
});

describe('Apple Health — Theme Suggestions', () => {
  it('should return neutral for null data', () => {
    const theme = suggestTheme(null);
    assert.equal(theme.mood, 'neutral');
  });

  it('should suggest calm theme for poor sleep', () => {
    const theme = suggestTheme({ sleepQuality: 'poor', steps: 3000 });
    assert.ok(theme.mood.includes('calm'));
    assert.ok(theme.suggestion.includes('tired'));
  });

  it('should suggest energetic theme for active users', () => {
    const theme = suggestTheme({ sleepQuality: 'good', steps: 12000 });
    assert.ok(theme.mood.includes('energetic'));
  });
});
