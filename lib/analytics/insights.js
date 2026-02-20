/**
 * Analytics Insights — IT-15 Reflection Sprint
 * 
 * Analyzes forge history to extract quality trends,
 * provider performance, and actionable recommendations.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(homedir(), '.modus-forge');
const HISTORY_FILE = join(DATA_DIR, 'history.json');

/**
 * Analyze all forge history and return insights
 */
export function analyzeHistory() {
  const entries = loadHistory();
  
  if (entries.length === 0) {
    return {
      totalForges: 0,
      avgScore: 0,
      bestProvider: null,
      trend: 'no data',
      topPrompts: [],
      recommendations: ['Start forging! Run: forge "your idea here"'],
      providerStats: {},
      timeDistribution: {},
    };
  }
  
  const totalForges = entries.length;
  const avgScore = entries.reduce((s, e) => s + (e.score || 0), 0) / totalForges;
  
  // Provider analysis
  const providerStats = {};
  for (const e of entries) {
    const p = e.model || e.provider || 'unknown';
    if (!providerStats[p]) providerStats[p] = { count: 0, totalScore: 0, scores: [] };
    providerStats[p].count++;
    if (e.score) {
      providerStats[p].totalScore += e.score;
      providerStats[p].scores.push(e.score);
    }
  }
  
  for (const p of Object.values(providerStats)) {
    p.avgScore = p.scores.length > 0 ? p.totalScore / p.scores.length : 0;
  }
  
  const bestProvider = Object.entries(providerStats)
    .filter(([, s]) => s.count >= 2)
    .sort(([, a], [, b]) => b.avgScore - a.avgScore)[0];
  
  // Quality trend (last 10 vs first 10)
  const trend = computeTrend(entries);
  
  // Top prompts by score
  const topPrompts = entries
    .filter(e => e.score)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(e => ({ intent: e.intent, score: e.score, model: e.model }));
  
  // Time distribution (hour of day)
  const timeDistribution = {};
  for (const e of entries) {
    if (e.timestamp) {
      const hour = new Date(e.timestamp).getHours();
      timeDistribution[hour] = (timeDistribution[hour] || 0) + 1;
    }
  }
  
  // Recommendations
  const recommendations = generateRecommendations({ providerStats, avgScore, totalForges, trend, entries });
  
  return {
    totalForges,
    avgScore,
    bestProvider: bestProvider ? { name: bestProvider[0], ...bestProvider[1] } : null,
    trend,
    topPrompts,
    recommendations,
    providerStats,
    timeDistribution,
  };
}

/**
 * Compute quality trend
 */
function computeTrend(entries) {
  const scored = entries.filter(e => e.score);
  if (scored.length < 4) return 'insufficient data';
  
  const half = Math.floor(scored.length / 2);
  const firstHalf = scored.slice(0, half);
  const secondHalf = scored.slice(half);
  
  const avgFirst = firstHalf.reduce((s, e) => s + e.score, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, e) => s + e.score, 0) / secondHalf.length;
  
  const diff = avgSecond - avgFirst;
  if (diff > 0.05) return '📈 improving';
  if (diff < -0.05) return '📉 declining';
  return '📊 stable';
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations({ providerStats, avgScore, totalForges, trend, entries }) {
  const recs = [];
  
  // Provider diversity
  const providerCount = Object.keys(providerStats).length;
  if (providerCount < 3) {
    recs.push(`Try more providers — you've only used ${providerCount}. Compare with: forge "prompt" --model claude`);
  }
  
  // Quality threshold
  if (avgScore < 0.6) {
    recs.push('Average quality is below 60% — try using --refine flag or --iterate 3 for best-of-N');
  }
  
  // Declining trend
  if (trend === '📉 declining') {
    recs.push('Quality is declining — review recent prompts for specificity. More detailed intents = better output');
  }
  
  // Underused features
  const hasIterated = entries.some(e => e.iterations > 1);
  if (!hasIterated && totalForges > 5) {
    recs.push('Try iteration: forge "prompt" --iterate 3 picks the best of 3 generations');
  }
  
  const hasRefined = entries.some(e => e.refined);
  if (!hasRefined && totalForges > 5) {
    recs.push('Enable auto-refinement: forge "prompt" --refine fixes quality issues automatically');
  }
  
  // Best time to forge
  if (totalForges > 10) {
    const bestHour = Object.entries(
      entries.filter(e => e.score && e.timestamp).reduce((acc, e) => {
        const h = new Date(e.timestamp).getHours();
        if (!acc[h]) acc[h] = { total: 0, count: 0 };
        acc[h].total += e.score;
        acc[h].count++;
        return acc;
      }, {})
    ).sort(([, a], [, b]) => (b.total / b.count) - (a.total / a.count))[0];
    
    if (bestHour) {
      recs.push(`Your best quality output happens around ${bestHour[0]}:00 — plan important forges then`);
    }
  }
  
  if (recs.length === 0) recs.push('Everything looks great! Keep forging 🔥');
  
  return recs;
}

/**
 * Load history from disk
 */
function loadHistory() {
  if (!existsSync(HISTORY_FILE)) return [];
  try {
    return JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

/**
 * Provider comparison report (for templates)
 */
export function providerReport() {
  const { providerStats } = analyzeHistory();
  return Object.entries(providerStats).map(([name, stats]) => ({
    name,
    count: stats.count,
    avgScore: stats.avgScore,
    scores: stats.scores,
  })).sort((a, b) => b.avgScore - a.avgScore);
}
