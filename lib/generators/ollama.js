/**
 * Ollama Generator — Local LLM backend for MODUS Forge.
 * Connects to locally running Ollama instance. Zero cost, full privacy.
 */

import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const OLLAMA_ENDPOINT = process.env.OLLAMA_HOST || 'http://localhost:11434';

const MODELS = {
  'ollama': 'llama3.3',
  'llama': 'llama3.3',
  'llama3': 'llama3.3',
  'codellama': 'codellama:34b',
  'mistral': 'mistral',
  'mixtral': 'mixtral',
  'qwen': 'qwen2.5:32b',
  'deepseek': 'deepseek-coder-v2',
  'phi': 'phi4',
  'gemma': 'gemma2:27b',
};

const SYSTEM = 'You are MODUS Forge (Local mode). Generate complete, self-contained HTML apps. Output ONLY valid HTML. No markdown fences. No explanation. Start with <!DOCTYPE html>. Use modern CSS with custom properties. Prefer functional JS patterns.';

/**
 * Resolve model alias to full model name.
 */
export function resolveModel(alias) {
  return MODELS[alias] || alias;
}

/**
 * Check if Ollama is running and accessible.
 * @returns {boolean}
 */
export function isAvailable() {
  try {
    execSync(`curl -sf "${OLLAMA_ENDPOINT}/api/tags" 2>/dev/null`, {
      timeout: 3000,
      encoding: 'utf-8',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * List models available on the local Ollama instance.
 * @returns {string[]} Array of model names
 */
export function listLocalModels() {
  try {
    const raw = execSync(`curl -sf "${OLLAMA_ENDPOINT}/api/tags"`, {
      timeout: 5000,
      encoding: 'utf-8',
    });
    const data = JSON.parse(raw);
    return (data.models || []).map(m => m.name);
  } catch {
    return [];
  }
}

/**
 * Generate HTML via local Ollama instance.
 * @param {string} prompt - Enhanced RUNE prompt
 * @param {object} opts - { model, maxTokens, temperature }
 * @returns {Promise<string>} Generated HTML
 */
export async function generate(prompt, opts = {}) {
  const model = resolveModel(opts.model || 'ollama');
  const temperature = opts.temperature ?? 0.7;

  if (!isAvailable()) {
    throw new Error(`Ollama not reachable at ${OLLAMA_ENDPOINT} — is it running?`);
  }

  const payload = {
    model,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: prompt },
    ],
    stream: false,
    options: {
      temperature,
      num_predict: opts.maxTokens || 16384,
    },
  };

  const tmp = join(mkdtempSync(join(tmpdir(), 'forge-ollama-')), 'payload.json');

  try {
    writeFileSync(tmp, JSON.stringify(payload));

    const result = execSync(
      `curl -sf -X POST "${OLLAMA_ENDPOINT}/api/chat" ` +
      `-H "Content-Type: application/json" ` +
      `-d @${tmp}`,
      { timeout: 300_000, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );

    const json = JSON.parse(result);
    let html = json.message?.content || '';

    // Strip markdown fences if present
    html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();

    return html;
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}

/**
 * List known model aliases.
 */
export function listModels() {
  return { ...MODELS };
}
