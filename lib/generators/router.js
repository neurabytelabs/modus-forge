/**
 * Generator Router — Picks the right generator based on model name.
 * Single entry point for all LLM generation.
 */

import { generate as geminiGenerate } from './gemini.js';
import { generate as claudeGenerate } from './claude.js';
import { generate as openaiGenerate } from './openai.js';
import { generate as grokGenerate } from './grok.js';
import { detectProvider } from '../rune/system-instruction.js';

const GENERATORS = {
  gemini: geminiGenerate,
  claude: claudeGenerate,
  openai: openaiGenerate,
  grok: grokGenerate,
  unknown: geminiGenerate, // fallback to gemini via Antigravity
};

/**
 * Route generation to the appropriate provider.
 * @param {string} prompt - Enhanced RUNE prompt
 * @param {object} opts - { model }
 * @returns {Promise<string>} Generated HTML
 */
export async function route(prompt, opts = {}) {
  const model = opts.model || 'gemini';
  const provider = detectProvider(model);
  const generator = GENERATORS[provider] || GENERATORS.unknown;

  return generator(prompt, opts);
}
