/**
 * REST API Server — MODUS Forge.
 *
 * IT-22: Exposes the full pipeline, grimoire, and history as a REST API.
 * Makes Forge accessible from any HTTP client, web app, or remote agent.
 *
 * Endpoints:
 *   POST   /api/generate       — Run full pipeline (prompt → HTML)
 *   POST   /api/validate       — Validate HTML with Spinoza scoring
 *   GET    /api/grimoire       — List saved spells
 *   POST   /api/grimoire       — Save a spell
 *   GET    /api/grimoire/:id   — Get a spell by ID
 *   GET    /api/history        — List generation history
 *   GET    /api/health         — Health check
 *   GET    /api/models         — List available models/providers
 *
 * Uses shared SSE channel for streaming generation progress.
 *
 * @module api/server
 */

import { createServer } from 'node:http';
import { createChannel } from '../sse/server.js';

/**
 * Parse JSON body from request.
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<object>}
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch (e) { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response.
 * @param {import('http').ServerResponse} res
 * @param {number} status
 * @param {object} data
 */
function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(body);
}

/**
 * Simple token-based auth middleware.
 * @param {import('http').IncomingMessage} req
 * @param {string} [token]
 * @returns {boolean}
 */
function checkAuth(req, token) {
  if (!token) return true; // no auth configured
  const header = req.headers.authorization || '';
  return header === `Bearer ${token}`;
}

/**
 * Rate limiter — sliding window per IP.
 */
class RateLimiter {
  /**
   * @param {object} opts
   * @param {number} [opts.windowMs=60000]
   * @param {number} [opts.maxRequests=30]
   */
  constructor({ windowMs = 60000, maxRequests = 30 } = {}) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    /** @type {Map<string, number[]>} */
    this.windows = new Map();
  }

  /**
   * Check if request is allowed.
   * @param {string} ip
   * @returns {{ allowed: boolean, remaining: number, resetMs: number }}
   */
  check(ip) {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    let hits = this.windows.get(ip) || [];
    hits = hits.filter(t => t > cutoff);
    const allowed = hits.length < this.maxRequests;
    if (allowed) hits.push(now);
    this.windows.set(ip, hits);

    // Cleanup old IPs every 100 checks
    if (Math.random() < 0.01) {
      for (const [k, v] of this.windows) {
        if (v.every(t => t <= cutoff)) this.windows.delete(k);
      }
    }

    return {
      allowed,
      remaining: Math.max(0, this.maxRequests - hits.length),
      resetMs: hits.length > 0 ? hits[0] + this.windowMs - now : 0,
    };
  }
}

/**
 * Extract route params from simple patterns like /api/grimoire/:id
 * @param {string} pattern
 * @param {string} pathname
 * @returns {object|null}
 */
function matchRoute(pattern, pathname) {
  const patternParts = pattern.split('/');
  const pathParts = pathname.split('/');
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

/**
 * Available provider/model list.
 */
const MODELS = [
  { provider: 'gemini', models: ['gemini-3-pro-preview', 'gemini-3-flash-preview'], default: true },
  { provider: 'claude', models: ['claude-sonnet-4-5', 'claude-opus-4-6'] },
  { provider: 'openai', models: ['gpt-5.2', 'gpt-4o'] },
  { provider: 'grok', models: ['grok-4-1-fast-reasoning', 'grok-3'] },
  { provider: 'deepseek', models: ['deepseek-chat', 'deepseek-coder'] },
  { provider: 'anthropic-direct', models: ['claude-sonnet-4-5', 'claude-opus-4-6'] },
  { provider: 'ollama', models: ['llama3', 'codellama', 'mistral'] },
];

/**
 * Create and start the Forge API server.
 * @param {object} opts
 * @param {number} [opts.port=3141] — π port 🔥
 * @param {string} [opts.token] — Bearer token for auth
 * @param {number} [opts.rateLimit=30] — Requests per minute
 * @param {function} [opts.generateFn] — Custom generate function (default: full pipeline)
 * @param {function} [opts.validateFn] — Custom validate function
 * @param {function} [opts.grimoireFn] — Grimoire store access
 * @param {function} [opts.historyFn] — History access
 * @param {function} [opts.onRequest] — Hook called on each request
 * @returns {{ server: import('http').Server, close: () => Promise<void>, progressChannel: SSEChannel }}
 */
export function createApiServer(opts = {}) {
  const {
    port = 3141,
    token,
    rateLimit: rateMax = 30,
    generateFn,
    validateFn,
    grimoireFn,
    historyFn,
    onRequest,
  } = opts;

  const limiter = new RateLimiter({ maxRequests: rateMax });
  const progressChannel = createChannel({ heartbeatMs: 15000 });
  const startTime = Date.now();
  let requestCount = 0;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method;

    requestCount++;
    if (onRequest) onRequest({ method, pathname, ip: req.socket.remoteAddress });

    // CORS preflight
    if (method === 'OPTIONS') {
      json(res, 204, {});
      return;
    }

    // Rate limit
    const ip = req.socket.remoteAddress || 'unknown';
    const rl = limiter.check(ip);
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
    if (!rl.allowed) {
      json(res, 429, { error: 'Rate limit exceeded', retryAfterMs: rl.resetMs });
      return;
    }

    // Auth check (skip for health + SSE progress)
    if (pathname !== '/api/health' && pathname !== '/api/progress') {
      if (!checkAuth(req, token)) {
        json(res, 401, { error: 'Unauthorized' });
        return;
      }
    }

    try {
      // --- Health ---
      if (pathname === '/api/health' && method === 'GET') {
        json(res, 200, {
          status: 'ok',
          version: '0.2.0',
          uptime: Date.now() - startTime,
          requests: requestCount,
        });
        return;
      }

      // --- Models ---
      if (pathname === '/api/models' && method === 'GET') {
        json(res, 200, { models: MODELS });
        return;
      }

      // --- Generate ---
      if (pathname === '/api/generate' && method === 'POST') {
        const body = await parseBody(req);
        if (!body.prompt) {
          json(res, 400, { error: 'Missing required field: prompt' });
          return;
        }
        if (!generateFn) {
          json(res, 501, { error: 'Generate function not configured' });
          return;
        }

        progressChannel.broadcast({ type: 'start', prompt: body.prompt });

        const result = await generateFn({
          prompt: body.prompt,
          model: body.model,
          iterations: body.iterations || 1,
          persona: body.persona,
          theme: body.theme,
          onProgress: (stage) => progressChannel.broadcast({ type: 'progress', stage }),
        });

        progressChannel.broadcast({ type: 'complete', score: result?.score });

        json(res, 200, {
          html: result?.html || '',
          score: result?.score || 0,
          validation: result?.validation || {},
          model: result?.model || 'unknown',
          iterations: result?.iterations || 1,
          durationMs: result?.durationMs || 0,
          enhancedPrompt: result?.enhancedPrompt || '',
        });
        return;
      }

      // --- Validate ---
      if (pathname === '/api/validate' && method === 'POST') {
        const body = await parseBody(req);
        if (!body.html) {
          json(res, 400, { error: 'Missing required field: html' });
          return;
        }
        if (!validateFn) {
          json(res, 501, { error: 'Validate function not configured' });
          return;
        }
        const result = validateFn(body.html);
        json(res, 200, result);
        return;
      }

      // --- Grimoire List ---
      if (pathname === '/api/grimoire' && method === 'GET') {
        if (!grimoireFn) {
          json(res, 501, { error: 'Grimoire not configured' });
          return;
        }
        const query = url.searchParams.get('q') || '';
        const tag = url.searchParams.get('tag') || '';
        const limit = parseInt(url.searchParams.get('limit') || '20', 10);
        const results = grimoireFn.list({ query, tag, limit });
        json(res, 200, { spells: results });
        return;
      }

      // --- Grimoire Save ---
      if (pathname === '/api/grimoire' && method === 'POST') {
        const body = await parseBody(req);
        if (!body.name || !body.prompt) {
          json(res, 400, { error: 'Missing required fields: name, prompt' });
          return;
        }
        if (!grimoireFn) {
          json(res, 501, { error: 'Grimoire not configured' });
          return;
        }
        const saved = grimoireFn.save(body);
        json(res, 201, saved);
        return;
      }

      // --- Grimoire Get by ID ---
      const grimoireMatch = matchRoute('/api/grimoire/:id', pathname);
      if (grimoireMatch && method === 'GET') {
        if (!grimoireFn) {
          json(res, 501, { error: 'Grimoire not configured' });
          return;
        }
        const spell = grimoireFn.get(grimoireMatch.id);
        if (!spell) {
          json(res, 404, { error: 'Spell not found' });
          return;
        }
        json(res, 200, spell);
        return;
      }

      // --- History ---
      if (pathname === '/api/history' && method === 'GET') {
        if (!historyFn) {
          json(res, 501, { error: 'History not configured' });
          return;
        }
        const limit = parseInt(url.searchParams.get('limit') || '20', 10);
        const provider = url.searchParams.get('provider') || '';
        const results = historyFn.list({ limit, provider });
        json(res, 200, { history: results });
        return;
      }

      // --- SSE Progress Stream ---
      if (pathname === '/api/progress' && method === 'GET') {
        progressChannel.handler(req, res);
        return;
      }

      // --- 404 ---
      json(res, 404, { error: 'Not found', endpoints: [
        'GET  /api/health',
        'GET  /api/models',
        'POST /api/generate',
        'POST /api/validate',
        'GET  /api/grimoire',
        'POST /api/grimoire',
        'GET  /api/grimoire/:id',
        'GET  /api/history',
        'GET  /api/progress (SSE)',
      ]});
    } catch (err) {
      json(res, 500, { error: err.message || 'Internal server error' });
    }
  });

  return {
    server,
    progressChannel,
    listen: () => new Promise(resolve => {
      server.listen(port, () => resolve({ port }));
    }),
    close: () => new Promise(resolve => {
      progressChannel.close();
      server.close(() => resolve());
    }),
  };
}

export default createApiServer;
