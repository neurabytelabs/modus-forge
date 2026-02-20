/**
 * Interactive REPL — Live prompt experimentation in the terminal.
 * Forge prompts, test providers, compare results in real-time.
 *
 * "The mind's highest good is the knowledge of God,
 *  and the mind's highest virtue is to know God." — Spinoza
 * (Here, God = the infinite creative potential of well-crafted prompts)
 */

import { createInterface } from 'node:readline';
import { enhance } from '../rune/enhancer.js';
import { validate } from '../rune/validator.js';

const COMMANDS = {
  '.help': 'Show available commands',
  '.enhance <text>': 'Run RUNE 8-layer enhancement on text',
  '.validate <code>': 'Run Spinoza validator on code/HTML',
  '.compare <text>': 'Enhance + validate, show scores',
  '.model <name>': 'Set active model (e.g., gemini-2.5-flash)',
  '.context': 'Show current session context',
  '.history': 'Show command history',
  '.clear': 'Clear screen',
  '.exit': 'Exit REPL'
};

/**
 * Start the interactive REPL.
 * @param {object} options - { model, context }
 */
export function startRepl(options = {}) {
  const state = {
    model: options.model || 'gemini-2.5-flash',
    context: options.context || {},
    history: [],
    sessionStart: new Date()
  };

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `\x1b[35mforge>\x1b[0m `,
    historySize: 100
  });

  console.log('\x1b[36m🔥 Forge Interactive REPL\x1b[0m');
  console.log(`Model: ${state.model} | Type .help for commands\n`);
  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }

    state.history.push(input);

    try {
      if (input === '.help') {
        console.log('\n\x1b[33mCommands:\x1b[0m');
        for (const [cmd, desc] of Object.entries(COMMANDS)) {
          console.log(`  ${cmd.padEnd(20)} ${desc}`);
        }
      } else if (input === '.exit') {
        console.log('👋 Forge out.');
        rl.close();
        return;
      } else if (input === '.clear') {
        console.clear();
      } else if (input === '.context') {
        console.log(JSON.stringify(state, null, 2));
      } else if (input === '.history') {
        state.history.forEach((h, i) => console.log(`  ${i + 1}. ${h}`));
      } else if (input.startsWith('.model ')) {
        state.model = input.slice(7).trim();
        console.log(`Model set to: ${state.model}`);
      } else if (input.startsWith('.enhance ')) {
        const text = input.slice(9);
        const result = enhance(text, state.context);
        console.log('\n\x1b[32m--- Enhanced ---\x1b[0m');
        console.log(result.enhancedPrompt || result);
      } else if (input.startsWith('.validate ')) {
        const code = input.slice(10);
        const result = validate(code);
        console.log('\n\x1b[32m--- Validation ---\x1b[0m');
        console.log(`Conatus: ${result.conatus} | Ratio: ${result.ratio} | Laetitia: ${result.laetitia} | Natura: ${result.natura}`);
        console.log(`Total: ${result.total || (result.conatus + result.ratio + result.laetitia + result.natura)}`);
      } else if (input.startsWith('.compare ')) {
        const text = input.slice(9);
        const enhanced = enhance(text, state.context);
        const prompt = enhanced.enhancedPrompt || enhanced;
        const score = validate(typeof prompt === 'string' ? `<div>${prompt}</div>` : '');
        console.log('\n\x1b[32m--- Compare ---\x1b[0m');
        console.log(`Enhanced: ${typeof prompt === 'string' ? prompt.slice(0, 200) : JSON.stringify(prompt).slice(0, 200)}...`);
        console.log(`Score: C=${score.conatus} R=${score.ratio} L=${score.laetitia} N=${score.natura}`);
      } else {
        // Bare text = quick enhance
        const result = enhance(input, state.context);
        console.log('\n\x1b[36m' + (result.enhancedPrompt || JSON.stringify(result).slice(0, 500)) + '\x1b[0m');
      }
    } catch (err) {
      console.error(`\x1b[31mError: ${err.message}\x1b[0m`);
    }

    console.log();
    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });

  return rl;
}

/**
 * Non-interactive evaluate: enhance + validate a prompt.
 */
export function evaluate(text, context = {}) {
  const enhanced = enhance(text, context);
  const prompt = enhanced.enhancedPrompt || enhanced;
  const score = validate(typeof prompt === 'string' ? `<div>${prompt}</div>` : '');
  return { enhanced: prompt, score };
}
