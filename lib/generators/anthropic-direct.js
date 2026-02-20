/**
 * Anthropic Direct Generator — Uses Claude API directly (not via Antigravity).
 * Messages API v1 with proper content blocks.
 */

import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';

const MODELS = {
  'claude-opus': 'claude-opus-4-6',
  'claude-sonnet': 'claude-sonnet-4-5-20250514',
  'claude-haiku': 'claude-haiku-3-5-20241022',
};

const SYSTEM = 'You are MODUS Forge (Claude Direct mode). Generate complete, self-contained HTML apps. Output ONLY valid HTML. No markdown fences. No explanation. Start with <!DOCTYPE html>. Use class-based patterns with clean separation of concerns. Prefer modern CSS with custom properties and subtle animations.';

/**
 * Resolve model alias to full model name.
 */
export function resolveModel(alias) {
  return MODELS[alias] || alias;
}

/**
 * Generate HTML via Anthropic Messages API directly.
 * @param {string} prompt - Enhanced RUNE prompt
 * @param {object} opts - { model, maxTokens }
 * @returns {Promise<string>} Generated HTML
 */
export async function generate(prompt, opts = {}) {
  const model = resolveModel(opts.model || 'claude-sonnet');
  const maxTokens = opts.maxTokens || 16384;

  if (!ANTHROPIC_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set — cannot use Anthropic direct generator');
  }

  const payload = {
    model,
    max_tokens: maxTokens,
    system: SYSTEM,
    messages: [
      { role: 'user', content: prompt },
    ],
  };

  const tmp = mkdtempSync(join(tmpdir(), 'forge-anthropic-'));
  const payloadFile = join(tmp, 'payload.json');
  writeFileSync(payloadFile, JSON.stringify(payload));

  try {
    const raw = execSync(
      `curl -sf "${ANTHROPIC_ENDPOINT}" \
        -H "x-api-key: ${ANTHROPIC_KEY}" \
        -H "anthropic-version: 2023-06-01" \
        -H "content-type: application/json" \
        -d @${payloadFile}`,
      { timeout: 120_000, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );

    const resp = JSON.parse(raw);

    if (resp.error) {
      throw new Error(`Anthropic API error: ${resp.error.message}`);
    }

    // Messages API returns content blocks array
    const text = (resp.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    // Extract HTML if wrapped in fences
    const htmlMatch = text.match(/<!DOCTYPE html>[\s\S]*/i);
    return htmlMatch ? htmlMatch[0] : text;
  } finally {
    try { unlinkSync(payloadFile); } catch {}
  }
}

/**
 * Check if direct Anthropic API is available.
 */
export function isAvailable() {
  return !!ANTHROPIC_KEY;
}
