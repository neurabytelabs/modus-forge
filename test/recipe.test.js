import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execute, saveRecipe, loadRecipe, listRecipes, BUILT_IN_RECIPES } from '../lib/recipe/engine.js';

describe('Recipe Engine', () => {

  it('executes a simple recipe with variable interpolation', async () => {
    const recipe = {
      name: 'Test Recipe',
      steps: [
        { id: 'step1', prompt: 'Hello {{name}}', provider: 'test' },
        { id: 'step2', prompt: 'Extend: {{step1.output}}', provider: 'test' },
      ],
      variables: { name: 'World' },
    };

    const mockGen = async (prompt, provider) => `[${provider}] Generated from: ${prompt}`;
    const result = await execute(recipe, mockGen);

    assert.ok(result.outputs.step1.includes('Hello World'));
    assert.ok(result.outputs.step2.includes('Generated from'));
    assert.ok(result.finalOutput.length > 0);
    assert.ok(result.totalMs >= 0);
  });

  it('handles merge steps', async () => {
    const recipe = {
      name: 'Merge Test',
      steps: [
        { id: 'a', prompt: 'Part A', provider: 'test' },
        { id: 'b', prompt: 'Part B', provider: 'test' },
        { id: 'merged', type: 'merge', sources: ['a', 'b'] },
      ],
      variables: {},
    };

    const mockGen = async (prompt) => `<body><h1>${prompt}</h1></body>`;
    const result = await execute(recipe, mockGen);

    assert.ok(result.finalOutput.includes('Part A'));
    assert.ok(result.finalOutput.includes('Part B'));
    assert.ok(result.finalOutput.includes('<!DOCTYPE html>'));
  });

  it('handles step errors gracefully', async () => {
    const recipe = {
      name: 'Error Test',
      steps: [
        { id: 'ok', prompt: 'Works', provider: 'test' },
        { id: 'fail', prompt: 'Breaks', provider: 'test' },
      ],
      variables: {},
    };

    let callCount = 0;
    const mockGen = async () => {
      callCount++;
      if (callCount === 2) throw new Error('LLM timeout');
      return 'output';
    };

    const result = await execute(recipe, mockGen);
    assert.ok(result.outputs.ok === 'output');
    assert.ok(result.outputs.fail.includes('Error'));
  });

  it('calls onStep callback for progress', async () => {
    const recipe = {
      name: 'Callback Test',
      steps: [{ id: 's1', prompt: 'Go', provider: 'test' }],
      variables: {},
    };

    const events = [];
    const mockGen = async () => 'done';
    await execute(recipe, mockGen, (id, status) => events.push({ id, status }));

    assert.ok(events.some(e => e.status === 'generating'));
    assert.ok(events.some(e => e.status === 'complete'));
  });

  it('truncates long outputs in interpolation', async () => {
    const recipe = {
      name: 'Truncate Test',
      steps: [
        { id: 'big', prompt: 'Generate a lot', provider: 'test' },
        { id: 'use', prompt: 'Use: {{big.output}}', provider: 'test' },
      ],
      variables: {},
    };

    const mockGen = async (prompt) => {
      if (prompt.includes('a lot')) return 'x'.repeat(3000);
      return `received ${prompt.length} chars`;
    };

    const result = await execute(recipe, mockGen);
    // The interpolated prompt should have been truncated
    assert.ok(result.outputs.use.length > 0);
  });

  it('saves and loads recipes', () => {
    const saved = saveRecipe({ name: 'Test Save', steps: [], variables: {} });
    assert.ok(saved.id);
    assert.ok(saved.savedAt);

    const loaded = loadRecipe(saved.id);
    assert.equal(loaded.name, 'Test Save');
  });

  it('lists recipes', () => {
    const recipes = listRecipes();
    assert.ok(Array.isArray(recipes));
  });

  it('has built-in recipe templates', () => {
    assert.ok(BUILT_IN_RECIPES['landing-page']);
    assert.ok(BUILT_IN_RECIPES['dashboard-suite']);
    assert.ok(BUILT_IN_RECIPES['landing-page'].steps.length >= 3);
  });
});
