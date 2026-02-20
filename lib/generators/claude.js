/**
 * Claude Generator — LLM backend via Antigravity gateway
 * Supports Claude Sonnet 4.5 and Opus 4.6
 */

import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';

const ANTIGRAVITY = 'http://127.0.0.1:8045';
const ANTIGRAVITY_KEY = 'sk-f741397b2b564a1eaac8e714034eec2f';

const MODEL_MAP = {
  'claude': 'claude-sonnet-4-5-thinking',
  'claude-sonnet': 'claude-sonnet-4-5-thinking',
  'claude-opus': 'claude-opus-4-6-thinking',
  'sonnet': 'claude-sonnet-4-5-thinking',
  'opus': 'claude-opus-4-6-thinking',
};

/**
 * Generate HTML from an enhanced prompt using Claude via Antigravity.
 * @param {string} prompt - Enhanced RUNE prompt
 * @param {object} opts - { model }
 * @returns {Promise<string>} Generated HTML
 */
export async function generate(prompt, opts = {}) {
  const modelKey = opts.model || 'claude';
  const model = MODEL_MAP[modelKey] || modelKey;

  const payload = JSON.stringify({
    model,
    messages: [
      {
        role: 'system',
        content: 'You are MODUS Forge. Generate complete, self-contained HTML apps. Output ONLY valid HTML. No markdown. No explanation. Start with <!DOCTYPE html>.',
      },
      { role: 'user', content: prompt },
    ],
    max_tokens: 16000,
    temperature: 0.7,
  });

  const tmpFile = `/tmp/modus-forge-claude-${Date.now()}.json`;
  writeFileSync(tmpFile, payload);

  try {
    const result = execSync(
      `curl -s -X POST "${ANTIGRAVITY}/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${ANTIGRAVITY_KEY}" \
        -d @${tmpFile}`,
      { encoding: 'utf-8', timeout: 180_000, maxBuffer: 10 * 1024 * 1024 }
    );

    unlinkSync(tmpFile);

    const json = JSON.parse(result);
    if (json.error) {
      throw new Error(`Claude error: ${json.error.message || JSON.stringify(json.error)}`);
    }

    let html = json.choices?.[0]?.message?.content;
    if (!html) throw new Error('Empty response from Claude');

    // Clean markdown fences
    html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();

    if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
      throw new Error('Generated output does not appear to be valid HTML');
    }

    return html;
  } catch (err) {
    try { unlinkSync(tmpFile); } catch {}
    throw err;
  }
}
