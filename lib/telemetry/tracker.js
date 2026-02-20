/**
 * Telemetry Tracker — Usage & cost tracking across providers.
 * Know what you spend, where you spend it, and what you get for it.
 *
 * "Nothing in nature is contingent." — Spinoza
 * Neither should your LLM spend be.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const TELEMETRY_DIR = join(process.env.HOME || '/tmp', '.forge', 'telemetry');
const TELEMETRY_FILE = join(TELEMETRY_DIR, 'usage.json');

// Approximate costs per 1M tokens (USD) — input/output
const COST_TABLE = {
  'gemini-2.5-flash': { input: 0.15, output: 0.60 },
  'gemini-2.5-pro': { input: 1.25, output: 5.00 },
  'gemini-3-flash': { input: 0.15, output: 0.60 },
  'gemini-3-pro': { input: 1.25, output: 5.00 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-5': { input: 5.00, output: 15.00 },
  'claude-sonnet': { input: 3.00, output: 15.00 },
  'claude-opus': { input: 15.00, output: 75.00 },
  'grok-4-fast': { input: 0.20, output: 0.50 },
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'ollama': { input: 0, output: 0 },  // local = free
  'default': { input: 1.00, output: 3.00 }
};

function ensureDir() {
  if (!existsSync(TELEMETRY_DIR)) mkdirSync(TELEMETRY_DIR, { recursive: true });
}

function loadData() {
  ensureDir();
  if (!existsSync(TELEMETRY_FILE)) return { calls: [], daily: {} };
  return JSON.parse(readFileSync(TELEMETRY_FILE, 'utf8'));
}

function saveData(data) {
  ensureDir();
  writeFileSync(TELEMETRY_FILE, JSON.stringify(data, null, 2));
}

function estimateTokens(text) {
  // ~4 chars per token (rough approximation)
  return Math.ceil((text || '').length / 4);
}

function getCostRate(model) {
  const key = Object.keys(COST_TABLE).find(k => (model || '').toLowerCase().includes(k));
  return COST_TABLE[key] || COST_TABLE.default;
}

/**
 * Record an LLM call.
 * @param {object} params - { model, inputText, outputText, durationMs, success }
 * @returns {object} Call record with estimated cost
 */
export function recordCall({ model, inputText, outputText, durationMs, success = true }) {
  const data = loadData();
  const inputTokens = estimateTokens(inputText);
  const outputTokens = estimateTokens(outputText);
  const rate = getCostRate(model);
  const cost = (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;

  const record = {
    timestamp: new Date().toISOString(),
    model: model || 'unknown',
    inputTokens,
    outputTokens,
    cost: Math.round(cost * 1_000_000) / 1_000_000, // 6 decimal places
    durationMs: durationMs || 0,
    success
  };

  data.calls.push(record);

  // Aggregate daily
  const day = record.timestamp.slice(0, 10);
  if (!data.daily[day]) data.daily[day] = { calls: 0, cost: 0, tokens: 0, byModel: {} };
  data.daily[day].calls++;
  data.daily[day].cost += record.cost;
  data.daily[day].tokens += inputTokens + outputTokens;
  if (!data.daily[day].byModel[record.model]) {
    data.daily[day].byModel[record.model] = { calls: 0, cost: 0 };
  }
  data.daily[day].byModel[record.model].calls++;
  data.daily[day].byModel[record.model].cost += record.cost;

  // Keep last 1000 calls max
  if (data.calls.length > 1000) data.calls = data.calls.slice(-1000);

  saveData(data);
  return record;
}

/**
 * Get usage summary for a period.
 * @param {number} days - Number of days to look back (default 7)
 */
export function getSummary(days = 7) {
  const data = loadData();
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  const relevantDays = Object.entries(data.daily)
    .filter(([day]) => day >= cutoff)
    .sort(([a], [b]) => a.localeCompare(b));

  const totalCost = relevantDays.reduce((sum, [, d]) => sum + d.cost, 0);
  const totalCalls = relevantDays.reduce((sum, [, d]) => sum + d.calls, 0);
  const totalTokens = relevantDays.reduce((sum, [, d]) => sum + d.tokens, 0);

  // By model aggregate
  const byModel = {};
  for (const [, d] of relevantDays) {
    for (const [model, stats] of Object.entries(d.byModel)) {
      if (!byModel[model]) byModel[model] = { calls: 0, cost: 0 };
      byModel[model].calls += stats.calls;
      byModel[model].cost += stats.cost;
    }
  }

  return {
    period: `${days}d`,
    totalCalls,
    totalTokens,
    totalCost: Math.round(totalCost * 100) / 100,
    avgCostPerCall: totalCalls > 0 ? Math.round((totalCost / totalCalls) * 10000) / 10000 : 0,
    byModel,
    daily: Object.fromEntries(relevantDays)
  };
}

/**
 * Get the most cost-effective model based on historical data.
 */
export function bestValueModel(days = 30) {
  const summary = getSummary(days);
  const models = Object.entries(summary.byModel)
    .filter(([, s]) => s.calls >= 3) // min 3 calls
    .map(([model, s]) => ({ model, avgCost: s.cost / s.calls, calls: s.calls }))
    .sort((a, b) => a.avgCost - b.avgCost);
  return models[0] || null;
}
