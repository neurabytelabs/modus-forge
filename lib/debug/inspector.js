/**
 * Pipeline Inspector — Debug and trace pipeline execution.
 * Records timing, inputs/outputs, and decisions at each stage.
 * 
 * @module debug/inspector
 * @since IT-18
 */

class PipelineInspector {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.verbose = options.verbose || false;
    this.traces = [];
    this.startTime = null;
  }

  /**
   * Start a new pipeline trace.
   * @param {string} name - Pipeline name
   * @param {object} [input] - Initial input
   */
  start(name, input) {
    if (!this.enabled) return;
    this.startTime = Date.now();
    this.traces = [];
    this.traces.push({
      stage: '__start',
      name,
      timestamp: this.startTime,
      input: this.verbose ? input : summarize(input),
    });
  }

  /**
   * Record a pipeline stage.
   * @param {string} stage - Stage name (e.g., 'enhance', 'generate', 'validate')
   * @param {object} data - Stage data
   * @param {*} [data.input] - Stage input
   * @param {*} [data.output] - Stage output
   * @param {string} [data.provider] - LLM provider used
   * @param {string} [data.model] - Model used
   * @param {number} [data.tokens] - Approximate tokens used
   * @param {string} [data.decision] - Why this path was chosen
   * @param {Error} [data.error] - Error if stage failed
   */
  record(stage, data = {}) {
    if (!this.enabled) return;
    const now = Date.now();
    const prev = this.traces[this.traces.length - 1];
    this.traces.push({
      stage,
      timestamp: now,
      durationMs: prev ? now - prev.timestamp : 0,
      ...data,
      input: this.verbose ? data.input : summarize(data.input),
      output: this.verbose ? data.output : summarize(data.output),
    });
  }

  /**
   * End the trace and return the full report.
   * @param {*} [finalOutput] - Final pipeline output
   * @returns {{ stages: Array, totalMs: number, stageCount: number, slowest: string }}
   */
  end(finalOutput) {
    if (!this.enabled) return null;
    const now = Date.now();
    const totalMs = this.startTime ? now - this.startTime : 0;

    this.traces.push({
      stage: '__end',
      timestamp: now,
      durationMs: this.traces.length > 0 ? now - this.traces[this.traces.length - 1].timestamp : 0,
      output: this.verbose ? finalOutput : summarize(finalOutput),
    });

    // Find slowest stage (excluding __start and __end)
    const stages = this.traces.filter(t => !t.stage.startsWith('__'));
    const slowest = stages.length > 0
      ? stages.reduce((a, b) => (a.durationMs || 0) > (b.durationMs || 0) ? a : b)
      : null;

    return {
      stages: this.traces,
      totalMs,
      stageCount: stages.length,
      slowest: slowest ? `${slowest.stage} (${slowest.durationMs}ms)` : 'none',
      errors: stages.filter(s => s.error).map(s => ({ stage: s.stage, error: s.error?.message || s.error })),
      providers: [...new Set(stages.filter(s => s.provider).map(s => s.provider))],
    };
  }

  /**
   * Format trace as a readable string.
   * @returns {string}
   */
  toString() {
    const report = this.end();
    if (!report) return '[inspector disabled]';

    const lines = [
      `🔍 Pipeline Trace — ${report.stageCount} stages, ${report.totalMs}ms total`,
      `   Slowest: ${report.slowest}`,
      report.providers.length > 0 ? `   Providers: ${report.providers.join(', ')}` : null,
      report.errors.length > 0 ? `   ⚠️ Errors: ${report.errors.map(e => `${e.stage}: ${e.error}`).join('; ')}` : null,
      '',
      ...this.traces.map(t => {
        if (t.stage === '__start') return `  ▶ START: ${t.name}`;
        if (t.stage === '__end') return `  ■ END (${t.durationMs}ms)`;
        const dur = t.durationMs ? ` [${t.durationMs}ms]` : '';
        const provider = t.provider ? ` via ${t.provider}` : '';
        const decision = t.decision ? ` — ${t.decision}` : '';
        const err = t.error ? ` ❌ ${t.error?.message || t.error}` : '';
        return `  → ${t.stage}${dur}${provider}${decision}${err}`;
      })
    ].filter(Boolean);

    return lines.join('\n');
  }

  /**
   * Export trace as JSON for dashboards/templates.
   */
  toJSON() {
    return {
      traces: this.traces,
      summary: this.end(),
    };
  }
}

/**
 * Summarize a value for non-verbose mode.
 */
function summarize(val) {
  if (val === undefined || val === null) return val;
  if (typeof val === 'string') {
    return val.length > 100 ? `${val.substring(0, 100)}... (${val.length} chars)` : val;
  }
  if (typeof val === 'object') {
    const keys = Object.keys(val);
    return `{${keys.slice(0, 5).join(', ')}${keys.length > 5 ? `, +${keys.length - 5} more` : ''}}`;
  }
  return val;
}

/**
 * Create a quick inspector for one-off tracing.
 */
function createInspector(options) {
  return new PipelineInspector(options);
}

export { PipelineInspector, createInspector };
export default PipelineInspector;
