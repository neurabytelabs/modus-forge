/**
 * Context Sensors — Gather environment signals to enrich prompt context.
 * 
 * Detects: time of day, platform, locale, screen hints, recent forge history.
 * These signals help the enhancer produce contextually-appropriate apps.
 */

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { newsContext } from './news.js';

/**
 * Time-of-day mood mapping.
 * Apps generated at night get darker palettes; morning gets energetic ones.
 */
const TIME_MOODS = {
  dawn:    { hours: [5, 8],   mood: 'calm, warm',        palette: 'warm sunrise tones' },
  morning: { hours: [8, 12],  mood: 'energetic, focused', palette: 'bright, clean' },
  afternoon: { hours: [12, 17], mood: 'productive, steady', palette: 'balanced, professional' },
  evening: { hours: [17, 21], mood: 'relaxed, creative',  palette: 'warm, muted' },
  night:   { hours: [21, 5],  mood: 'dark, focused',      palette: 'dark mode, neon accents' },
};

/**
 * Detect current time-of-day mood.
 * @returns {{ period: string, mood: string, palette: string }}
 */
function detectTimeMood() {
  const hour = new Date().getHours();
  for (const [period, { hours, mood, palette }] of Object.entries(TIME_MOODS)) {
    const [start, end] = hours;
    if (period === 'night') {
      if (hour >= start || hour < end) return { period, mood, palette };
    } else {
      if (hour >= start && hour < end) return { period, mood, palette };
    }
  }
  return { period: 'unknown', mood: 'neutral', palette: 'balanced' };
}

/**
 * Detect platform signals.
 * @returns {{ os: string, locale: string, timezone: string }}
 */
function detectPlatform() {
  return {
    os: process.platform,
    locale: process.env.LANG || process.env.LC_ALL || 'en-US',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };
}

/**
 * Scan recent forge outputs to understand usage patterns.
 * @param {string} outputDir
 * @returns {{ recentApps: string[], totalForged: number }}
 */
function detectHistory(outputDir = 'output') {
  try {
    const files = readdirSync(outputDir)
      .filter(f => f.endsWith('.html'))
      .map(f => ({
        name: f.replace('.html', ''),
        mtime: statSync(join(outputDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    return {
      recentApps: files.slice(0, 5).map(f => f.name),
      totalForged: files.length,
    };
  } catch {
    return { recentApps: [], totalForged: 0 };
  }
}

/**
 * Gather all context signals.
 * @param {object} opts - { outputDir }
 * @returns {{ time: object, platform: object, history: object, contextHint: string }}
 */
export function sense(opts = {}) {
  const time = detectTimeMood();
  const platform = detectPlatform();
  const history = detectHistory(opts.outputDir);

  // Build a natural-language context hint for the enhancer
  const hints = [];
  hints.push(`It's ${time.period} — mood: ${time.mood}`);
  if (history.totalForged > 0) {
    hints.push(`User has forged ${history.totalForged} apps before`);
    if (history.recentApps.length > 0) {
      hints.push(`Recent: ${history.recentApps.slice(0, 3).join(', ')}`);
    }
  }

  // News context (tech trends from HN)
  const news = newsContext();
  if (news) hints.push(news);

  return {
    time,
    platform,
    history,
    news: news || null,
    contextHint: hints.join('. ') + '.',
  };
}
