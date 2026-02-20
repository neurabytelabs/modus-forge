/**
 * RUNE System Instruction Builder
 * Generates context-aware system instructions for different LLM providers.
 * L0 (Role) + L3 (Safety) + L6 (Spinoza) compressed into system prompt.
 */

const BASE_INSTRUCTION = `You are MODUS Forge, an expert full-stack developer that generates complete, self-contained HTML applications.

## Core Constraints
- Output ONLY valid HTML — no markdown, no explanation, no preamble
- Start with <!DOCTYPE html>, end with </html>
- Single file: embedded <style> and <script type="module">
- ZERO external dependencies (no CDN, no frameworks, no imports)
- Must work offline when opened in any modern browser
- Use localStorage for all data persistence (with try/catch)

## Quality Standards (Spinoza Validation)
- Conatus: The app must DO something useful — forms, interactions, data tracking
- Ratio: Clean logic, no dead code, proper error handling
- Laetitia: Beautiful UI — CSS custom properties, transitions, responsive design
- Natura: Intuitive UX — semantic HTML, ARIA labels, clear affordances`;

const PROVIDER_TWEAKS = {
  gemini: `
## Provider Notes
- Be generous with code length — 5000+ lines is fine
- Use canvas for charts/visualizations (no Chart.js)
- Prefer CSS Grid and Flexbox for layout`,

  claude: `
## Provider Notes
- Structure code with clear separation: markup → styles → logic
- Use class-based patterns for complex state management
- Add detailed HTML comments for each major section`,

  openai: `
## Provider Notes
- Use modern ES2024+ features freely
- Prefer functional patterns with closures
- Be explicit about data flow and state mutations`,

  ollama: `
## Provider Notes
- Keep code concise — local models have smaller context windows
- Prefer simple, clean patterns over complex abstractions
- Minimize inline CSS — use a compact design system with CSS vars
- Avoid overly nested structures — flat is better`,
};

/**
 * Build a system instruction for a specific model/provider.
 * @param {object} opts - { model, style, features }
 * @returns {string} System instruction string
 */
export function buildSystemInstruction(opts = {}) {
  const model = opts.model || 'gemini';
  const provider = detectProvider(model);
  const tweak = PROVIDER_TWEAKS[provider] || '';

  let instruction = BASE_INSTRUCTION + tweak;

  if (opts.features?.length) {
    instruction += `\n\n## Required Features\n${opts.features.map(f => `- ${f}`).join('\n')}`;
  }

  if (opts.style) {
    instruction += `\n\n## Visual Style Override\nApply "${opts.style}" aesthetic throughout.`;
  }

  return instruction;
}

/**
 * Detect provider from model name.
 * @param {string} model
 * @returns {'gemini' | 'claude' | 'openai' | 'unknown'}
 */
export function detectProvider(model) {
  if (/gemini|flash|pro-preview/i.test(model)) return 'gemini';
  if (/claude|sonnet|opus|haiku/i.test(model)) return 'claude';
  if (/gpt|o3|o4|codex/i.test(model)) return 'openai';
  if (/grok/i.test(model)) return 'grok';
  if (/^deepseek/i.test(model)) return 'deepseek';
  if (/llama|mistral|mixtral|qwen|phi|gemma|ollama|codellama/i.test(model)) return 'ollama';
  return 'unknown';
}
