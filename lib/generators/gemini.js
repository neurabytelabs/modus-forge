/**
 * Gemini Generator — LLM backend for MODUS Forge
 * Primary: Direct Gemini API. Fallback: Antigravity gateway.
 */

import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';

const GEMINI_API_KEY = 'AIzaSyDvsIgQj9luKM3Ml1QiHfA1bm3vo9o80Gk';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const ANTIGRAVITY = 'http://127.0.0.1:8045';
const ANTIGRAVITY_KEY = 'sk-f741397b2b564a1eaac8e714034eec2f';

const GEMINI_MODELS = {
  'gemini': 'gemini-2.0-flash',
  'gemini-flash': 'gemini-2.0-flash',
  'gemini-pro': 'gemini-2.0-pro',
  'gemini-2.0-flash': 'gemini-2.0-flash',
};

const ANTIGRAVITY_MODELS = {
  'claude': 'claude-sonnet-4-5-thinking',
  'grok': 'grok-4-1-fast-reasoning',
};

const SYSTEM_INSTRUCTION = 'You are MODUS Forge. Generate complete, self-contained HTML apps. Output ONLY valid HTML. No markdown fences. No explanation. Start with <!DOCTYPE html>.';

/**
 * Generate HTML from an enhanced prompt using LLM.
 * @param {string} prompt - Enhanced RUNE prompt
 * @param {object} opts - { model }
 * @returns {Promise<string>} Generated HTML
 */
export async function generate(prompt, opts = {}) {
  const modelKey = opts.model || 'gemini-2.0-flash';

  // Route to Antigravity for non-Gemini models
  if (ANTIGRAVITY_MODELS[modelKey]) {
    return generateAntigravity(prompt, ANTIGRAVITY_MODELS[modelKey]);
  }

  const model = GEMINI_MODELS[modelKey] || modelKey;
  return generateGemini(prompt, model);
}

async function generateGemini(prompt, model) {
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const payload = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 16384,
    },
  });

  const tmpFile = `/tmp/modus-forge-${Date.now()}.json`;
  writeFileSync(tmpFile, payload);

  try {
    const result = execSync(
      `curl -s -X POST "${url}" -H "Content-Type: application/json" -d @${tmpFile}`,
      { encoding: 'utf-8', timeout: 120_000, maxBuffer: 10 * 1024 * 1024 }
    );
    unlinkSync(tmpFile);

    const json = JSON.parse(result);
    if (json.error) {
      throw new Error(`Gemini error: ${json.error.message || JSON.stringify(json.error)}`);
    }

    let html = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!html) throw new Error('Empty response from Gemini');

    return cleanHtml(html);
  } catch (err) {
    try { unlinkSync(tmpFile); } catch {}
    throw err;
  }
}

async function generateAntigravity(prompt, model) {
  const payload = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      { role: 'user', content: prompt },
    ],
    max_tokens: 16000,
    temperature: 0.7,
  });

  const tmpFile = `/tmp/modus-forge-${Date.now()}.json`;
  writeFileSync(tmpFile, payload);

  try {
    const result = execSync(
      `curl -s -X POST "${ANTIGRAVITY}/v1/chat/completions" -H "Content-Type: application/json" -H "Authorization: Bearer ${ANTIGRAVITY_KEY}" -d @${tmpFile}`,
      { encoding: 'utf-8', timeout: 120_000, maxBuffer: 10 * 1024 * 1024 }
    );
    unlinkSync(tmpFile);

    const json = JSON.parse(result);
    if (json.error) throw new Error(`LLM error: ${json.error.message || JSON.stringify(json.error)}`);

    let html = json.choices?.[0]?.message?.content;
    if (!html) throw new Error('Empty response from LLM');

    return cleanHtml(html);
  } catch (err) {
    try { unlinkSync(tmpFile); } catch {}
    throw err;
  }
}

function cleanHtml(html) {
  html = html.replace(/^```html?\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
    throw new Error('Generated output does not appear to be valid HTML');
  }
  return html;
}
