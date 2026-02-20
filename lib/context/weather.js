/**
 * Weather Context Sensor — Injects weather mood into RUNE L1 context.
 * Uses wttr.in (no API key needed). Graceful fallback on failure.
 */

import { execSync } from 'node:child_process';

const CITY = 'Cologne';
const TTL_MS = 30 * 60 * 1000; // cache 30 min

let cache = { data: null, ts: 0 };

const WEATHER_MOODS = {
  sunny:  { mood: 'bright', palette: 'warm yellows, soft whites', vibe: 'energetic and optimistic' },
  cloudy: { mood: 'muted', palette: 'soft grays, muted blues', vibe: 'thoughtful and calm' },
  rainy:  { mood: 'cozy', palette: 'deep blues, warm amber accents', vibe: 'introspective and warm' },
  snowy:  { mood: 'crisp', palette: 'icy whites, cool blues', vibe: 'clean and minimal' },
  stormy: { mood: 'dramatic', palette: 'dark purples, electric cyan', vibe: 'bold and intense' },
  default:{ mood: 'neutral', palette: 'balanced grays and accents', vibe: 'versatile' },
};

/**
 * Classify wttr condition text into a mood category.
 */
function classifyWeather(condition) {
  const c = (condition || '').toLowerCase();
  if (/thunder|storm/.test(c)) return 'stormy';
  if (/snow|sleet|blizzard/.test(c)) return 'snowy';
  if (/rain|drizzle|shower/.test(c)) return 'rainy';
  if (/cloud|overcast|fog|mist/.test(c)) return 'cloudy';
  if (/sun|clear/.test(c)) return 'sunny';
  return 'default';
}

/**
 * Fetch current weather from wttr.in.
 * @param {string} [city] - City name
 * @returns {{ condition: string, temp: string, mood: object } | null}
 */
export function getWeather(city = CITY) {
  const now = Date.now();
  if (cache.data && (now - cache.ts) < TTL_MS) return cache.data;

  try {
    const raw = execSync(`curl -sf "wttr.in/${encodeURIComponent(city)}?format=%C|%t" 2>/dev/null`, {
      timeout: 5000,
      encoding: 'utf-8',
    }).trim();

    const [condition, temp] = raw.split('|');
    const category = classifyWeather(condition);
    const result = {
      condition: condition?.trim() || 'unknown',
      temp: temp?.trim() || '?',
      category,
      mood: WEATHER_MOODS[category],
      city,
    };
    cache = { data: result, ts: now };
    return result;
  } catch {
    return null;
  }
}

/**
 * Format weather as a RUNE L1 context line.
 */
export function weatherContext(city = CITY) {
  const w = getWeather(city);
  if (!w) return '';
  return `Weather: ${w.condition} ${w.temp} in ${w.city} — mood: ${w.mood.mood}, suggested palette: ${w.mood.palette}, vibe: ${w.mood.vibe}`;
}
