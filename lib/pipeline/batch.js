/**
 * Batch Pipeline — Run multiple prompts through the RUNE pipeline.
 *
 * Use cases:
 *   - Generate a suite of related apps from a theme
 *   - A/B test the same prompt across multiple models
 *   - Bulk content generation with quality filtering
 *
 * Supports concurrency control, progress callbacks, and result aggregation.
 */

import { pipeline } from './full.js';

/**
 * @typedef {Object} BatchItem
 * @property {string} prompt - Raw user prompt
 * @property {string} [model] - Override model for this item
 * @property {string} [label] - Human-readable label
 * @property {object} [opts] - Additional pipeline options
 */

/**
 * @typedef {Object} BatchResult
 * @property {string} label - Item label
 * @property {string} prompt - Original prompt
 * @property {string} model - Model used
 * @property {number} score - Spinoza validation score
 * @property {number} iterations - Iterations used
 * @property {number} durationMs - Time taken
 * @property {string} html - Generated HTML
 * @property {object} validation - Full validation result
 * @property {string|null} error - Error message if failed
 */

/**
 * @typedef {Object} BatchSummary
 * @property {BatchResult[]} results - Individual results
 * @property {number} total - Total items
 * @property {number} succeeded - Successful items
 * @property {number} failed - Failed items
 * @property {number} avgScore - Average Spinoza score (successful only)
 * @property {number} totalDurationMs - Wall-clock time
 * @property {BatchResult|null} best - Highest-scoring result
 * @property {BatchResult|null} worst - Lowest-scoring result
 */

/**
 * Run a batch of prompts through the pipeline.
 * @param {BatchItem[]} items - Prompts to process
 * @param {object} [opts]
 * @param {number} [opts.concurrency=1] - Max concurrent generations
 * @param {string} [opts.defaultModel='gemini'] - Default model
 * @param {number} [opts.minScore=0] - Filter out results below this score
 * @param {boolean} [opts.stopOnFail=false] - Stop batch on first failure
 * @param {function} [opts.onProgress] - Callback (completed, total, result)
 * @param {boolean} [opts.verbose=false] - Verbose logging
 * @returns {Promise<BatchSummary>}
 */
export async function batch(items, opts = {}) {
  const {
    concurrency = 1,
    defaultModel = 'gemini',
    minScore = 0,
    stopOnFail = false,
    onProgress,
    verbose = false,
  } = opts;

  const start = Date.now();
  const results = [];
  let completed = 0;
  let stopped = false;

  // Process in concurrency-limited chunks
  const chunks = [];
  for (let i = 0; i < items.length; i += concurrency) {
    chunks.push(items.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    if (stopped) break;

    const promises = chunk.map(async (item, idx) => {
      const label = item.label || `item-${results.length + idx + 1}`;
      const model = item.model || defaultModel;

      try {
        const result = await pipeline(item.prompt, {
          model,
          verbose,
          ...item.opts,
        });

        return {
          label,
          prompt: item.prompt,
          model,
          score: result.score,
          iterations: result.iterations,
          durationMs: result.durationMs,
          html: result.html,
          validation: result.validation,
          error: null,
        };
      } catch (err) {
        if (stopOnFail) stopped = true;
        return {
          label,
          prompt: item.prompt,
          model,
          score: 0,
          iterations: 0,
          durationMs: 0,
          html: '',
          validation: null,
          error: err.message || String(err),
        };
      }
    });

    const chunkResults = await Promise.all(promises);
    for (const r of chunkResults) {
      results.push(r);
      completed++;
      if (onProgress) onProgress(completed, items.length, r);
    }
  }

  // Aggregate
  const succeeded = results.filter(r => !r.error && r.score >= minScore);
  const failed = results.filter(r => r.error);
  const scores = succeeded.map(r => r.score);
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  const sorted = [...succeeded].sort((a, b) => b.score - a.score);

  return {
    results: minScore > 0 ? results.filter(r => !r.error ? r.score >= minScore : true) : results,
    total: items.length,
    succeeded: succeeded.length,
    failed: failed.length,
    avgScore: Math.round(avgScore * 100) / 100,
    totalDurationMs: Date.now() - start,
    best: sorted[0] || null,
    worst: sorted[sorted.length - 1] || null,
  };
}

/**
 * Compare the same prompt across multiple models.
 * Convenience wrapper around batch().
 * @param {string} prompt - The prompt to test
 * @param {string[]} models - Models to compare
 * @param {object} [opts] - Additional batch options
 * @returns {Promise<BatchSummary>}
 */
export async function compare(prompt, models, opts = {}) {
  const items = models.map(model => ({
    prompt,
    model,
    label: model,
  }));

  return batch(items, { ...opts, concurrency: models.length });
}

/**
 * Generate variations of a prompt with different themes/contexts.
 * @param {string} basePrompt - Base prompt template (use {theme} placeholder)
 * @param {string[]} themes - Themes to substitute
 * @param {object} [opts] - Additional batch options
 * @returns {Promise<BatchSummary>}
 */
export async function variations(basePrompt, themes, opts = {}) {
  const items = themes.map(theme => ({
    prompt: basePrompt.replace(/\{theme\}/g, theme),
    label: theme,
  }));

  return batch(items, opts);
}
