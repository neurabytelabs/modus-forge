#!/usr/bin/env node

/**
 * MODUS Forge — Speak it. See it. Use it.
 * Turn a sentence into a personal app in seconds.
 * 
 * Usage: modus-forge "Track my cardio for 8 weeks"
 */

import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { enhance } from '../lib/rune/enhancer.js';
import { route } from '../lib/generators/router.js';
import { validate } from '../lib/rune/validator.js';
import { render } from '../lib/renderer/html.js';
import { preview } from '../lib/renderer/preview.js';
import { buildSystemInstruction, detectProvider } from '../lib/rune/system-instruction.js';
import { sense } from '../lib/context/sensors.js';
import { loadProfile, recordForge, profileContext } from '../lib/context/profile.js';
import { refine } from '../lib/iterate/refiner.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    model: { type: 'string', short: 'm', default: 'gemini' },
    style: { type: 'string', short: 's', default: 'cyberpunk' },
    output: { type: 'string', short: 'o', default: 'output' },
    lang: { type: 'string', short: 'l', default: 'en' },
    iterate: { type: 'string', short: 'i', default: '1' },
    refine: { type: 'boolean', short: 'r', default: false },
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
  modus-forge "Habit tracker" --iterate 3   (generate 3x, keep best)

Options:
  -m, --model     LLM: gemini | claude | opus | openai | grok (default: gemini)
  -s, --style     Visual style: cyberpunk | minimal | terminal (default: cyberpunk)
  -o, --output    Output directory (default: output/)
  -l, --lang      Language (default: en)
  -i, --iterate   Generate N versions, keep the best (default: 1)
  -r, --refine    Auto-refine if quality below threshold
      --no-open   Don't auto-open in browser
  -h, --help      Show this help

Models:
  gemini        Gemini 3 Flash (fast, great HTML)
  gemini-pro    Gemini 3 Pro (higher quality)
  claude        Claude Sonnet 4.5 (structured, clean)
  opus          Claude Opus 4.6 (maximum quality)
  openai / gpt  GPT-5.2
  grok          Grok 4.1 Fast
  `);
  process.exit(0);
}

const intent = positionals.join(' ');
const iterations = Math.min(parseInt(values.iterate) || 1, 5);
const doRefine = values.refine;

// Context gathering
const sensors = sense({ outputDir: values.output });
const profile = loadProfile();
const profCtx = profileContext(profile);

console.log('');
console.log('🔥 MODUS Forge');
console.log('─'.repeat(40));
console.log(`📝 Intent: "${intent}"`);
console.log(`🧠 Model: ${values.model} (${detectProvider(values.model)})`);
console.log(`🎨 Style: ${values.style}`);
console.log(`🌡️  Context: ${sensors.time.period} — ${sensors.time.mood}`);
if (profile.totalForged > 0) console.log(`👤 Profile: ${profile.totalForged} apps forged, avg ${(profile.avgScore * 100).toFixed(0)}%`);
if (iterations > 1) console.log(`🔄 Iterations: ${iterations} (best-of-N)`);
if (doRefine) console.log(`🔧 Auto-refine: enabled`);
console.log('');

try {
  // Step 1: RUNE Enhancement (now with sensor + profile context)
  console.log('⚡ L0-L7 RUNE Enhancement...');
  const enhanced = enhance(intent, {
    style: values.style,
    lang: values.lang,
    sensorHint: sensors.contextHint,
    profileHint: profCtx,
  });

  let bestCode = null;
  let bestScore = -1;
  let bestReport = null;

  for (let i = 0; i < iterations; i++) {
    if (iterations > 1) console.log(`\n🔄 Iteration ${i + 1}/${iterations}...`);

    // Step 2: LLM Generation
    console.log('🔮 Generating app...');
    const code = await route(enhanced, { model: values.model });

    // Step 3: Spinoza Validation
    console.log('🔬 Spinoza Validation...');
    const report = validate(code);
    const score = (report.conatus + report.ratio + report.laetitia + report.natura) / 4;
    console.log(`   C:${report.conatus} R:${report.ratio} L:${report.laetitia} N:${report.natura} → ${report.grade} (${(score * 100).toFixed(0)}%)`);

    if (score > bestScore) {
      bestCode = code;
      bestScore = score;
      bestReport = report;
    }
  }

  if (iterations > 1) {
    console.log(`\n🏆 Best: ${bestReport.grade} (${(bestScore * 100).toFixed(0)}%)`);
  }

  // Step 4: Auto-refine if enabled and below threshold
  if (doRefine && bestScore < 0.75) {
    console.log('\n🔧 Auto-refining...');
    const result = await refine(bestCode, { model: values.model, maxRounds: 2, threshold: 0.75 });
    if (result.improved) {
      bestCode = result.code;
      bestReport = result.report;
      bestScore = (bestReport.conatus + bestReport.ratio + bestReport.laetitia + bestReport.natura) / 4;
      console.log(`   Final: ${bestReport.grade} (${(bestScore * 100).toFixed(0)}%)`);
    }
  }

  // Step 5: Render & Open
  const outputPath = await render(bestCode, { dir: values.output, intent });
  console.log(`\n✅ Forged: ${outputPath}`);
  console.log(`📊 ${bestCode.length.toLocaleString()} bytes | Grade: ${bestReport.grade}`);

  // Step 6: Record to profile
  recordForge(profile, {
    intent,
    model: values.model,
    style: values.style,
    grade: bestReport.grade,
    score: bestScore,
  });

  if (!values['no-open']) {
    await preview(outputPath);
  }
} catch (err) {
  console.error(`\n❌ Forge failed: ${err.message}`);
  process.exit(1);
}
