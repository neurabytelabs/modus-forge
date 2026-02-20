#!/usr/bin/env node

/**
 * MODUS Forge — Speak it. See it. Use it.
 * Turn a sentence into a personal app in seconds.
 * 
 * Usage: modus-forge "Track my cardio for 8 weeks"
 */

import { parseArgs } from 'node:util';
import { enhance } from '../lib/rune/enhancer.js';
import { generate } from '../lib/generators/gemini.js';
import { validate } from '../lib/rune/validator.js';
import { render } from '../lib/renderer/html.js';
import { preview } from '../lib/renderer/preview.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    model: { type: 'string', short: 'm', default: 'gemini-2.0-flash' },
    style: { type: 'string', short: 's', default: 'cyberpunk' },
    output: { type: 'string', short: 'o', default: 'output' },
    lang: { type: 'string', short: 'l', default: 'en' },
    'no-open': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help || positionals.length === 0) {
  console.log(`
🔥 MODUS Forge — Speak it. See it. Use it.

Usage:
  modus-forge "Track my cardio for 8 weeks"
  modus-forge "Budget dashboard for March" --model claude
  modus-forge "Sleep tracker" --style minimal --lang tr

Options:
  -m, --model     LLM model (default: gemini-2.0-flash)
  -s, --style     Visual style: cyberpunk | minimal | terminal (default: cyberpunk)
  -o, --output    Output directory (default: output/)
  -l, --lang      Language (default: en)
      --no-open   Don't auto-open in browser
  -h, --help      Show this help
  `);
  process.exit(0);
}

const intent = positionals.join(' ');

console.log('');
console.log('🔥 MODUS Forge');
console.log('─'.repeat(40));
console.log(`📝 Intent: "${intent}"`);
console.log(`🧠 Model: ${values.model}`);
console.log(`🎨 Style: ${values.style}`);
console.log('');

try {
  // Step 1: RUNE Enhancement
  console.log('⚡ L0-L7 RUNE Enhancement...');
  const enhanced = await enhance(intent, { style: values.style, lang: values.lang });
  
  // Step 2: LLM Generation
  console.log('🔮 Generating app...');
  const code = await generate(enhanced, { model: values.model });
  
  // Step 3: Spinoza Validation
  console.log('🔬 Spinoza Validation...');
  const report = validate(code);
  console.log(`   Conatus: ${report.conatus} | Ratio: ${report.ratio} | Laetitia: ${report.laetitia} | Natura: ${report.natura}`);
  console.log(`   Grade: ${report.grade}`);
  
  // Step 4: Render & Open
  const outputPath = await render(code, { dir: values.output, intent });
  console.log(`\n✅ Forged: ${outputPath}`);
  
  if (!values['no-open']) {
    await preview(outputPath);
  }
} catch (err) {
  console.error(`\n❌ Forge failed: ${err.message}`);
  process.exit(1);
}
