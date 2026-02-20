/**
 * OpenAI Generator — Direct OpenAI API backend
 * Supports GPT-5.2, o3, o4-mini
 */

import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';

const OPENAI_ENDPOINT = 'https://api.openai.com/v1';
const OPENAI_KEY = process.env.OPENAI_API_KEY || '';

// Also support Antigravity fallback
const ANTIGRAVITY = 'http://127.0.0.1:8045';
const ANTIGRAVITY_KEY = 'sk-f741397b2b564a1eaac8e714034eec2f';

const MODEL_MAP = {
  'openai': 'gpt-5.2',
  'gpt': 'gpt-5.2',
  'gpt5': 'gpt-5.2',
  'gpt-5': 'gpt-5.2',
  'gpt-codex': 'gpt-5.2-codex',
  'o3': 'o3',
  'o4-mini': 'o4-mini',
  'gpt-4o': 'gpt-4o',
};

/**
 * Generate HTML from an enhanced prompt using OpenAI.
 * Falls back to Antigravity gateway if no OPENAI_API_KEY.
 * @param {string} prompt - Enhanced RUNE prompt
 * @param {object} opts - { model }
 * @returns {Promise<string>} Generated HTML
 */
export async function generate(prompt, opts = {}) {
  const modelKey = opts.model || 'openai';
  const model = MODEL_MAP[modelKey] || modelKey;

  const useAntigravity = !OPENAI_KEY;
  const endpoint = useAntigravity ? ANTIGRAVITY : OPENAI_ENDPOINT;
  const apiKey = useAntigravity ? ANTIGRAVITY_KEY : OPENAI_KEY;

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

  const tmpFile = `/tmp/modus-forge-openai-${Date.now()}.json`;
  writeFileSync(tmpFile, payload);

  try {
    const result = execSync(
      `curl -s -X POST "${endpoint}/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${apiKey}" \
        -d @${tmpFile}`,
      { encoding: 'utf-8', timeout: 180_000, maxBuffer: 10 * 1024 * 1024 }
    );

    unlinkSync(tmpFile);

    const json = JSON.parse(result);
    if (json.error) {
      throw new Error(`OpenAI error: ${json.error.message || JSON.stringify(json.error)}`);
    }

    let html = json.choices?.[0]?.message?.content;
    if (!html) throw new Error('Empty response from OpenAI');

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
