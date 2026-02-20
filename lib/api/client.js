/**
 * Forge API Client — MODUS Forge.
 *
 * IT-22: Lightweight client for the Forge REST API.
 * Can be used from Node.js scripts, other agents, or imported as a library.
 *
 * Usage:
 *   import { ForgeClient } from './lib/api/client.js';
 *   const forge = new ForgeClient({ baseUrl: 'http://localhost:3141', token: 'secret' });
 *   const result = await forge.generate('a weather dashboard');
 *
 * @module api/client
 */

/**
 * Forge API Client.
 */
export class ForgeClient {
  /**
   * @param {object} opts
   * @param {string} [opts.baseUrl='http://localhost:3141']
   * @param {string} [opts.token]
   * @param {number} [opts.timeoutMs=120000]
   */
  constructor({ baseUrl = 'http://localhost:3141', token, timeoutMs = 120000 } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.timeoutMs = timeoutMs;
  }

  /**
   * @param {string} path
   * @param {object} [opts]
   * @returns {Promise<object>}
   */
  async _fetch(path, { method = 'GET', body } = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Health check. */
  async health() {
    return this._fetch('/api/health');
  }

  /** List available models. */
  async models() {
    return this._fetch('/api/models');
  }

  /**
   * Generate HTML from prompt.
   * @param {string} prompt
   * @param {object} [opts]
   * @param {string} [opts.model]
   * @param {number} [opts.iterations]
   * @param {string} [opts.persona]
   * @param {string} [opts.theme]
   * @returns {Promise<object>}
   */
  async generate(prompt, opts = {}) {
    return this._fetch('/api/generate', {
      method: 'POST',
      body: { prompt, ...opts },
    });
  }

  /**
   * Validate HTML with Spinoza scoring.
   * @param {string} html
   * @returns {Promise<object>}
   */
  async validate(html) {
    return this._fetch('/api/validate', { method: 'POST', body: { html } });
  }

  /**
   * List grimoire spells.
   * @param {object} [opts]
   * @returns {Promise<object>}
   */
  async grimoireList({ query, tag, limit } = {}) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (tag) params.set('tag', tag);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    return this._fetch(`/api/grimoire${qs ? '?' + qs : ''}`);
  }

  /**
   * Save a spell to grimoire.
   * @param {object} spell
   * @returns {Promise<object>}
   */
  async grimoireSave(spell) {
    return this._fetch('/api/grimoire', { method: 'POST', body: spell });
  }

  /**
   * Get spell by ID.
   * @param {string} id
   * @returns {Promise<object>}
   */
  async grimoireGet(id) {
    return this._fetch(`/api/grimoire/${id}`);
  }

  /**
   * List generation history.
   * @param {object} [opts]
   * @returns {Promise<object>}
   */
  async history({ limit, provider } = {}) {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (provider) params.set('provider', provider);
    const qs = params.toString();
    return this._fetch(`/api/history${qs ? '?' + qs : ''}`);
  }

  /**
   * Connect to SSE progress stream.
   * @param {function} onEvent
   * @returns {{ close: () => void }}
   */
  connectProgress(onEvent) {
    const es = new EventSource(`${this.baseUrl}/api/progress`);
    es.onmessage = (e) => {
      try { onEvent(JSON.parse(e.data)); }
      catch { onEvent({ raw: e.data }); }
    };
    es.onerror = () => { /* auto-reconnect */ };
    return { close: () => es.close() };
  }
}

export default ForgeClient;
