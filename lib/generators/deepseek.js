/**
 * DeepSeek Generator — DeepSeek API backend for MODUS Forge.
 * Uses the official DeepSeek API (OpenAI-compatible format).
 * Falls back to Antigravity gateway if no direct API key.
 */

import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const DEEPSEEK_ENDPOINT = process.env.DEEPSEEK_ENDPOINT || 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';
const ANTIGRAVITY_ENDPOINT = 'http://127.0.0.1:8045/v1/chat/completions';
const ANTIGRAVITY_KEY = process.env.ANTIGRAVITY_API_KEY || 'sk-f741397b2b564a1eaac8e714034eec2f';

const MODELS = {
  'deepseek': 'deepseek-chat',
  'deepseek-chat': 'deepseek-chat',
  'deepseek-coder': 'deepseek-coder',
  'deepseek-reasoner': 'deepseek-reasoner',
};

const SYSTEM = `You are MODUS Forge (DeepSeek mode). Generate complete, self-contained HTML apps.
Output ONLY valid HTML — no markdown fences, no explanation. Start with <!DOCTYPE html>.
Use modern CSS with custom properties. Prefer clean, modular JavaScript.
DeepSeek strength: precise code generation with strong reasoning. Use it.`;

/**
 * Resolve model alias to full model name.
 */
export function resolveModel(alias) {
  return MODELS[alias] || alias;
}

/**
 * Generate HTML via DeepSeek API (direct or via Antigravity gateway).
 * @param {string} prompt - Enhanced RUNE prompt
 * @param {object} opts - { model, maxTokens }
 * @returns {Promise<string>} Generated HTML
 */
export async function generate(prompt, opts = {}) {
  const model = resolveModel(opts.model || 'deepseek');
  const maxTokens = opts.maxTokens || 16384;

  // Use direct API if key available, otherwise Antigravity gateway
  const useDirectApi = !!DEEPSEEK_KEY;
  const endpoint = useDirectApi ? DEEPSEEK_ENDPOINT : ANTIGRAVITY_ENDPOINT;
  const apiKey = useDirectApi ? DEEPSEEK_KEY : ANTIGRAVITY_KEY;

  const payload = {
    model,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: prompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.7,
  };

  const tmp = join(mkdtempSync(join(tmpdir(), 'forge-deepseek-')), 'payload.json');

  try {
    writeFileSync(tmp, JSON.stringify(payload));

    const result = execSync(
      `curl -sf -X POST "${endpoint}" ` +
      `-H "Content-Type: application/json" ` +
      `-H "Authorization: Bearer ${apiKey}" ` +
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
 * List available DeepSeek models.
 */
export function listModels() {
  return { ...MODELS };
}
