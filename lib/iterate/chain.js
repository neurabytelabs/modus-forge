/**
 * Iteration Chain — Orchestrates multi-step refinement pipelines.
 * 
 * A chain takes an initial prompt through N iterations, each scored by
 * the Spinoza validator. Stops early if quality threshold is met or
 * if no improvement after patience rounds.
 * 
 * Pattern: generate → validate → refine → validate → ... → best output
 */

import { route } from '../generators/router.js';
import { validate } from '../rune/validator.js';
import { refine } from './refiner.js';

/**
 * @typedef {object} ChainResult
 * @property {string} html - Best HTML output
 * @property {number} score - Best Spinoza score
 * @property {number} iterations - Total iterations run
 * @property {Array<{iteration: number, score: number, improved: boolean}>} history
 */

/**
 * Run an iteration chain.
 * @param {string} prompt - RUNE-enhanced prompt
 * @param {object} [opts]
 * @param {string} [opts.model='gemini'] - LLM model
 * @param {number} [opts.maxIterations=3] - Max refinement rounds
 * @param {number} [opts.threshold=0.85] - Stop if score >= this
 * @param {number} [opts.patience=2] - Stop after N rounds without improvement
 * @param {boolean} [opts.verbose=false] - Log progress
 * @returns {Promise<ChainResult>}
 */
export async function chain(prompt, opts = {}) {
  const {
    model = 'gemini',
    maxIterations = 3,
    threshold = 0.85,
    patience = 2,
    verbose = false,
  } = opts;

  let bestHtml = '';
  let bestScore = 0;
  let noImproveCount = 0;
  const history = [];

  const log = verbose ? console.log.bind(console) : () => {};

  // Initial generation
  log(`[chain] Starting with model=${model}, maxIterations=${maxIterations}`);
  let html = await route(prompt, { model });
  let scores = validate(html);
  let score = computeTotal(scores);

  bestHtml = html;
  bestScore = score;
  history.push({ iteration: 0, score, improved: true });
  log(`[chain] IT-0: score=${score.toFixed(3)}`);

  if (score >= threshold) {
    log(`[chain] Threshold met on first try`);
    return { html: bestHtml, score: bestScore, iterations: 1, history };
  }

  // Refinement loop
  for (let i = 1; i <= maxIterations; i++) {
    log(`[chain] Refining IT-${i}...`);

    const issues = identifyIssues(scores);
    html = await refine(html, issues, { model });
    scores = validate(html);
    score = computeTotal(scores);

    const improved = score > bestScore;
    history.push({ iteration: i, score, improved });

    if (improved) {
      bestHtml = html;
      bestScore = score;
      noImproveCount = 0;
      log(`[chain] IT-${i}: score=${score.toFixed(3)} ✅ (new best)`);
    } else {
      noImproveCount++;
      log(`[chain] IT-${i}: score=${score.toFixed(3)} — no improvement (${noImproveCount}/${patience})`);
    }

    if (bestScore >= threshold) {
      log(`[chain] Threshold ${threshold} met at IT-${i}`);
      break;
    }

    if (noImproveCount >= patience) {
      log(`[chain] Patience exhausted at IT-${i}`);
      break;
    }
  }

  return { html: bestHtml, score: bestScore, iterations: history.length, history };
}

/**
 * Compute total score from validator dimensions.
 */
function computeTotal(scores) {
  const dims = ['conatus', 'ratio', 'laetitia', 'natura'];
  const vals = dims.map(d => scores[d] ?? 0);
  return vals.reduce((a, b) => a + b, 0) / dims.length;
}

/**
 * Identify weak areas from scores to guide refinement.
 */
function identifyIssues(scores) {
  const issues = [];
  if ((scores.conatus ?? 0) < 0.7) issues.push('Needs more interactive elements and functional features');
  if ((scores.ratio ?? 0) < 0.7) issues.push('Code structure needs improvement — better naming, modularity');
  if ((scores.laetitia ?? 0) < 0.7) issues.push('Visual design needs polish — better typography, spacing, color harmony');
  if ((scores.natura ?? 0) < 0.7) issues.push('Needs responsive design and accessibility improvements');
  if (issues.length === 0) issues.push('General polish and refinement');
  return issues.join('. ');
}
