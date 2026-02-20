/**
 * A/B Test — Generate multiple variants and pick the best one.
 * 
 * Uses Spinoza validation scores to compare outputs from different
 * models or prompts, returning the winner with reasoning.
 * 
 * Philosophy: "The more perfection a thing has, the more it acts
 * and the less it suffers." — Spinoza, Ethics III, Prop 3
 */

import { validate } from '../rune/validator.js';
import { route } from '../generators/router.js';

/** Compute total as average of 4 Spinoza scores */
function withTotal(score) {
  score.total = (score.conatus + score.ratio + score.laetitia + score.natura) / 4;
  return score;
}

/**
 * @typedef {Object} Variant
 * @property {string} provider - Which model generated this
 * @property {string} code - The generated HTML
 * @property {{ conatus: number, ratio: number, laetitia: number, natura: number, total: number, issues: string[] }} score
 */

/**
 * Run an A/B test across multiple providers for the same prompt.
 * @param {string} enhancedPrompt - The RUNE-enhanced prompt
 * @param {Object} options
 * @param {string[]} [options.providers=['gemini','claude','openai']] - Providers to test
 * @param {Object} [options.context] - Sensor/profile context
 * @returns {Promise<{ winner: Variant, variants: Variant[], reasoning: string }>}
 */
export async function abTest(enhancedPrompt, options = {}) {
  const providers = options.providers || ['gemini', 'claude', 'openai'];
  
  const variants = await Promise.allSettled(
    providers.map(async (provider) => {
      const code = await route(enhancedPrompt, { provider, context: options.context });
      const score = withTotal(validate(code));
      return { provider, code, score };
    })
  );

  // Filter successful results
  const results = variants
    .filter(v => v.status === 'fulfilled')
    .map(v => v.value);

  if (results.length === 0) {
    throw new Error('All providers failed in A/B test');
  }

  // Sort by total Spinoza score (descending)
  results.sort((a, b) => b.score.total - a.score.total);

  const winner = results[0];
  const reasoning = buildReasoning(results);

  return { winner, variants: results, reasoning };
}

/**
 * Run A/B test with prompt variants (same provider, different prompts).
 * @param {string[]} prompts - Different prompt versions
 * @param {Object} options
 * @param {string} [options.provider='gemini'] - Provider to use
 * @returns {Promise<{ winner: Variant, variants: Variant[], reasoning: string }>}
 */
export async function promptDuel(prompts, options = {}) {
  const provider = options.provider || 'gemini';

  const variants = await Promise.allSettled(
    prompts.map(async (prompt, i) => {
      const code = await route(prompt, { provider, context: options.context });
      const score = withTotal(validate(code));
      return { provider: `${provider}-v${i + 1}`, code, score };
    })
  );

  const results = variants
    .filter(v => v.status === 'fulfilled')
    .map(v => v.value);

  if (results.length === 0) {
    throw new Error('All prompt variants failed');
  }

  results.sort((a, b) => b.score.total - a.score.total);
  const winner = results[0];
  const reasoning = buildReasoning(results);

  return { winner, variants: results, reasoning };
}

/**
 * Build human-readable reasoning for why the winner won.
 * @param {Variant[]} results - Sorted results (winner first)
 * @returns {string}
 */
function buildReasoning(results) {
  if (results.length === 1) {
    return `Only one variant succeeded (${results[0].provider}). Score: ${results[0].score.total.toFixed(2)}`;
  }

  const [winner, ...rest] = results;
  const lines = [
    `🏆 Winner: ${winner.provider} (${winner.score.total.toFixed(2)})`,
    `   Conatus: ${winner.score.conatus} | Ratio: ${winner.score.ratio} | Laetitia: ${winner.score.laetitia} | Natura: ${winner.score.natura}`,
  ];

  for (const v of rest) {
    const diff = (winner.score.total - v.score.total).toFixed(2);
    lines.push(`   vs ${v.provider}: ${v.score.total.toFixed(2)} (−${diff})`);
    if (v.score.issues.length > 0) {
      lines.push(`      Issues: ${v.score.issues.slice(0, 3).join(', ')}`);
    }
  }

  return lines.join('\n');
}

/**
 * Quick 2-way test: generate with primary, validate, if score < threshold
 * try fallback provider.
 * @param {string} prompt
 * @param {Object} options
 * @param {string} [options.primary='gemini']
 * @param {string} [options.fallback='claude']
 * @param {number} [options.threshold=0.7]
 * @returns {Promise<Variant>}
 */
export async function fallbackTest(prompt, options = {}) {
  const primary = options.primary || 'gemini';
  const fallback = options.fallback || 'claude';
  const threshold = options.threshold ?? 0.7;

  const code = await route(prompt, { provider: primary, context: options.context });
  const score = withTotal(validate(code));
  const result = { provider: primary, code, score };

  if (score.total >= threshold) {
    return result;
  }

  // Primary didn't meet threshold — try fallback
  const code2 = await route(prompt, { provider: fallback, context: options.context });
  const score2 = validate(code2);
  const result2 = { provider: fallback, code: code2, score: score2 };

  return score2.total > score.total ? result2 : result;
}
