/**
 * Full Pipeline — End-to-end RUNE-enhanced generation pipeline.
 * 
 * Orchestrates the complete flow:
 *   prompt → context enrichment → RUNE enhancement → generation →
 *   iteration chain → validation → persistence → output
 * 
 * This is the "one function to rule them all" — used by the CLI and
 * can be imported as a library for programmatic use.
 */

import { enhance } from '../rune/enhancer.js';
import { validate } from '../rune/validator.js';
import { chain } from '../iterate/chain.js';
import { route } from '../generators/router.js';
import { sense } from '../context/sensors.js';
import { loadProfile, profileContext } from '../context/profile.js';
import { getEvents, calendarContext } from '../context/calendar.js';
import { weatherContext } from '../context/weather.js';
import { getGitContextLine } from '../context/git-activity.js';
import { spotifyContext } from '../../skills/music/spotify.js';
import { set } from '../persistence/store.js';
import { record } from '../persistence/history.js';

/**
 * @typedef {object} PipelineResult
 * @property {string} html - Final generated HTML
 * @property {number} score - Spinoza validation score
 * @property {object} validation - Full validation breakdown
 * @property {object} context - Context signals used
 * @property {object} profile - User profile used
 * @property {number} iterations - Total generation iterations
 * @property {string} model - Model used
 * @property {string} enhancedPrompt - The RUNE-enhanced prompt
 * @property {number} durationMs - Total pipeline time
 */

/**
 * Run the full RUNE pipeline.
 * @param {string} prompt - Raw user prompt
 * @param {object} [opts]
 * @param {string} [opts.model='gemini'] - LLM model
 * @param {boolean} [opts.iterate=true] - Use iteration chain
 * @param {number} [opts.maxIterations=3] - Max chain iterations
 * @param {number} [opts.threshold=0.85] - Quality threshold
 * @param {boolean} [opts.persist=true] - Save to history
 * @param {boolean} [opts.verbose=false] - Verbose logging
 * @param {string} [opts.repoPath] - Git repo for context
 * @returns {Promise<PipelineResult>}
 */
export async function pipeline(prompt, opts = {}) {
  const {
    model = 'gemini',
    iterate = true,
    maxIterations = 3,
    threshold = 0.85,
    persist = true,
    verbose = false,
    repoPath,
  } = opts;

  const start = Date.now();
  const log = verbose ? console.log.bind(console) : () => {};

  // 1. Gather context signals
  log('📡 Gathering context...');
  const context = sense();
  const profile = loadProfile();
  const calendarEvents = getEvents();
  const calendarCtx = calendarContext(calendarEvents);
  const weatherCtx = weatherContext();
  const gitCtx = getGitContextLine(repoPath);
  const musicCtx = spotifyContext();
  const profileCtx = profileContext(profile);

  // Merge all context into a single L1 block
  const contextBlock = [
    context.summary || '',
    calendarCtx || '',
    weatherCtx || '',
    gitCtx || '',
    musicCtx || '',
    profileCtx || '',
  ].filter(Boolean).join('\n');

  log(`📡 Context:\n${contextBlock}`);

  // 2. RUNE Enhancement
  log('✨ Enhancing with RUNE 8-layer framework...');
  const enhancedPrompt = enhance(prompt, {
    context: contextBlock,
    profile,
  });

  log(`✨ Enhanced prompt: ${enhancedPrompt.length} chars`);

  // 3. Generate (with or without iteration chain)
  let html, score, iterations, validation;

  if (iterate) {
    log('🔄 Running iteration chain...');
    const result = await chain(enhancedPrompt, {
      model,
      maxIterations,
      threshold,
      verbose,
    });
    html = result.html;
    score = result.score;
    iterations = result.iterations;
    validation = validate(html);
  } else {
    log('⚡ Single-shot generation...');
    html = await route(enhancedPrompt, { model });
    validation = validate(html);
    score = validation.total || (
      (validation.conatus + validation.ratio + validation.laetitia + validation.natura) / 4
    );
    iterations = 1;
  }

  const durationMs = Date.now() - start;

  // 4. Persist
  if (persist) {
    const entry = {
      prompt,
      model,
      score,
      iterations,
      durationMs,
      timestamp: new Date().toISOString(),
    };
    try {
      set('pipeline-runs', Date.now().toString(), entry);
      record({ ...entry, htmlLength: html.length });
      log('💾 Saved to history');
    } catch (e) {
      log(`⚠️ Persist failed: ${e.message}`);
    }
  }

  log(`✅ Pipeline complete: score=${score.toFixed(2)}, iterations=${iterations}, ${durationMs}ms`);

  return {
    html,
    score,
    validation,
    context: { environment: context, calendar: calendarCtx, weather: weatherCtx, git: gitCtx },
    profile,
    iterations,
    model,
    enhancedPrompt,
    durationMs,
  };
}

/**
 * Quick-run: single-shot generation without iteration chain.
 * @param {string} prompt
 * @param {object} [opts]
 * @returns {Promise<PipelineResult>}
 */
export async function quick(prompt, opts = {}) {
  return pipeline(prompt, { ...opts, iterate: false });
}
