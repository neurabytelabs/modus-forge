/**
 * Tests for API Server — IT-22.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApiServer } from '../lib/api/server.js';

describe('API Server', () => {
  let api;
  const PORT = 31415;

  // Mock functions
  const mockGenerate = async ({ prompt }) => ({
    html: `<div>${prompt}</div>`,
    score: 0.85,
    validation: { conatus: 0.9, ratio: 0.8, laetitia: 0.85, natura: 0.85 },
    model: 'test-model',
    iterations: 1,
    durationMs: 100,
    enhancedPrompt: `Enhanced: ${prompt}`,
  });

  const mockValidate = (html) => ({
    score: 0.8,
    conatus: 0.9,
    ratio: 0.7,
    laetitia: 0.8,
    natura: 0.8,
    dimensions: { hasInteractivity: true, hasResponsive: true },
  });

  const spellStore = [];
  const mockGrimoire = {
    list: ({ query, tag, limit }) => spellStore.slice(0, limit),
    save: (spell) => { const s = { ...spell, id: 'sp-1' }; spellStore.push(s); return s; },
    get: (id) => spellStore.find(s => s.id === id) || null,
  };

  const mockHistory = {
    list: ({ limit }) => [{ id: 'h1', prompt: 'test', score: 0.8 }],
  };

  before(async () => {
    api = createApiServer({
      port: PORT,
      generateFn: mockGenerate,
      validateFn: mockValidate,
      grimoireFn: mockGrimoire,
      historyFn: mockHistory,
    });
    await api.listen();
  });

  after(async () => {
    await api.close();
  });

  const apiFetch = (path, opts = {}) =>
    fetch(`http://localhost:${PORT}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    }).then(async r => ({ status: r.status, data: await r.json() }));

  it('GET /api/health returns ok', async () => {
    const { status, data } = await apiFetch('/api/health');
    assert.equal(status, 200);
    assert.equal(data.status, 'ok');
    assert.ok(data.uptime >= 0);
  });

  it('GET /api/models returns provider list', async () => {
    const { status, data } = await apiFetch('/api/models');
    assert.equal(status, 200);
    assert.ok(data.models.length > 0);
    assert.ok(data.models.find(m => m.provider === 'gemini'));
  });

  it('POST /api/generate with prompt', async () => {
    const { status, data } = await apiFetch('/api/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'weather app' }),
    });
    assert.equal(status, 200);
    assert.ok(data.html.includes('weather app'));
    assert.equal(data.score, 0.85);
    assert.equal(data.model, 'test-model');
  });

  it('POST /api/generate without prompt returns 400', async () => {
    const { status, data } = await apiFetch('/api/generate', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert.equal(status, 400);
    assert.ok(data.error.includes('prompt'));
  });

  it('POST /api/validate scores HTML', async () => {
    const { status, data } = await apiFetch('/api/validate', {
      method: 'POST',
      body: JSON.stringify({ html: '<div>test</div>' }),
    });
    assert.equal(status, 200);
    assert.equal(data.score, 0.8);
    assert.ok(data.conatus > 0);
  });

  it('POST /api/grimoire saves a spell', async () => {
    const { status, data } = await apiFetch('/api/grimoire', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Spell', prompt: 'make a todo app', tags: ['test'] }),
    });
    assert.equal(status, 201);
    assert.equal(data.id, 'sp-1');
  });

  it('GET /api/grimoire lists spells', async () => {
    const { status, data } = await apiFetch('/api/grimoire');
    assert.equal(status, 200);
    assert.ok(Array.isArray(data.spells));
  });

  it('GET /api/grimoire/:id returns spell', async () => {
    const { status, data } = await apiFetch('/api/grimoire/sp-1');
    assert.equal(status, 200);
    assert.equal(data.name, 'Test Spell');
  });

  it('GET /api/grimoire/:id returns 404 for missing', async () => {
    const { status } = await apiFetch('/api/grimoire/nope');
    assert.equal(status, 404);
  });

  it('GET /api/history returns entries', async () => {
    const { status, data } = await apiFetch('/api/history');
    assert.equal(status, 200);
    assert.ok(data.history.length > 0);
  });

  it('GET /unknown returns 404 with endpoint list', async () => {
    const { status, data } = await apiFetch('/api/unknown');
    assert.equal(status, 404);
    assert.ok(data.endpoints.length > 0);
  });
});

describe('API Auth', () => {
  let api;
  const PORT = 31416;

  before(async () => {
    api = createApiServer({ port: PORT, token: 'secret-token' });
    await api.listen();
  });

  after(async () => {
    await api.close();
  });

  it('rejects without token', async () => {
    const res = await fetch(`http://localhost:${PORT}/api/models`);
    assert.equal(res.status, 401);
  });

  it('accepts with correct token', async () => {
    const res = await fetch(`http://localhost:${PORT}/api/models`, {
      headers: { Authorization: 'Bearer secret-token' },
    });
    assert.equal(res.status, 200);
  });

  it('health endpoint skips auth', async () => {
    const res = await fetch(`http://localhost:${PORT}/api/health`);
    assert.equal(res.status, 200);
  });
});
