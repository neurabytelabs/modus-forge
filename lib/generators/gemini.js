/**
 * Gemini Generator — LLM backend for MODUS Forge
 * Uses Antigravity gateway or direct Gemini API via curl
 */

import { execSync } from 'node:child_process';

const ANTIGRAVITY = 'http://127.0.0.1:8045';
const ANTIGRAVITY_KEY = 'sk-f741397b2b564a1eaac8e714034eec2f';

const MODEL_MAP = {
  'gemini': 'gemini-3-flash-preview',
  'gemini-flash': 'gemini-3-flash-preview',
  'gemini-pro': 'gemini-3-pro-preview',
  'gemini-2.0-flash': 'gemini-3-flash-preview',
  'claude': 'claude-sonnet-4-5-thinking',
  'grok': 'grok-4-1-fast-reasoning',
};

/**
 * Generate HTML from an enhanced prompt using LLM.
 * @param {string} prompt - Enhanced RUNE prompt
 * @param {object} opts - { model }
 * @returns {Promise<string>} Generated HTML
 */
export async function generate(prompt, opts = {}) {
  const modelKey = opts.model || 'gemini-2.0-flash';
  const model = MODEL_MAP[modelKey] || modelKey;

  const payload = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: 'You are MODUS Forge. Generate complete, self-contained HTML apps. Output ONLY valid HTML. No markdown. No explanation.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 16000,
    temperature: 0.7,
  });

  // Write payload to temp file to avoid shell escaping issues
  const tmpFile = `/tmp/modus-forge-${Date.now()}.json`;
  const { writeFileSync, unlinkSync } = await import('node:fs');
  writeFileSync(tmpFile, payload);

  try {
    const result = execSync(
      `curl -s -X POST "${ANTIGRAVITY}/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${ANTIGRAVITY_KEY}" \
        -d @${tmpFile}`,
      { encoding: 'utf-8', timeout: 120_000, maxBuffer: 10 * 1024 * 1024 }
    );

    unlinkSync(tmpFile);

    const json = JSON.parse(result);
    if (json.error) {
      throw new Error(`LLM error: ${json.error.message || JSON.stringify(json.error)}`);
    }

    let html = json.choices?.[0]?.message?.content;
    if (!html) throw new Error('Empty response from LLM');

    // Clean markdown fences if LLM wraps output
    html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();

    // Validate it looks like HTML
    if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
      throw new Error('Generated output does not appear to be valid HTML');
    }

    return html;
  } catch (err) {
    try { unlinkSync(tmpFile); } catch {}
    throw err;
  }
}
