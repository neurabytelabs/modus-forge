/**
 * Grok Generator — xAI LLM backend for MODUS Forge.
 * Uses curl subprocess to bypass Cloudflare (urllib gets 403).
 */

import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const GROK_ENDPOINT = 'https://api.x.ai/v1/chat/completions';
const GROK_KEY = process.env.GROK_API_KEY || '';

const MODELS = {
  'grok': 'grok-4-1-fast-reasoning',
  'grok-fast': 'grok-4-1-fast-reasoning',
  'grok-4': 'grok-4-fast',
  'grok-3': 'grok-3',
  'grok-mini': 'grok-3-mini',
  'grok-code': 'grok-code-fast-1',
};

const SYSTEM = 'You are MODUS Forge (Grok mode). Generate complete, self-contained HTML apps. Output ONLY valid HTML. No markdown fences. No explanation. Start with <!DOCTYPE html>. Use modern CSS with custom properties. Prefer functional JS patterns.';

/**
 * Resolve model alias to full model name.
 */
export function resolveModel(alias) {
  return MODELS[alias] || alias;
}

/**
 * Generate HTML via Grok API.
 * @param {string} prompt - Enhanced RUNE prompt
 * @param {object} opts - { model, maxTokens }
 * @returns {Promise<string>} Generated HTML
 */
export async function generate(prompt, opts = {}) {
  const model = resolveModel(opts.model || 'grok');
  const maxTokens = opts.maxTokens || 16384;

  if (!GROK_KEY) {
    throw new Error('GROK_API_KEY not set — cannot use Grok generator directly');
  }

  const payload = {
    model,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: prompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.7,
  };

  const tmp = join(mkdtempSync(join(tmpdir(), 'forge-grok-')), 'payload.json');

  try {
    writeFileSync(tmp, JSON.stringify(payload));

    const result = execSync(
      `curl -sf -X POST "${GROK_ENDPOINT}" ` +
      `-H "Content-Type: application/json" ` +
      `-H "Authorization: Bearer ${GROK_KEY}" ` +
      `-d @${tmp}`,
      { timeout: 120_000, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );

    const json = JSON.parse(result);
    let html = json.choices?.[0]?.message?.content || '';

    // Strip markdown fences if present
    html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();

    return html;
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}

/**
 * List available Grok models.
 */
export function listModels() {
  return { ...MODELS };
}
