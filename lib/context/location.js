/**
 * Location Context Sensor — Enriches prompts with geographic awareness.
 * 
 * Detects location via:
 * 1. Explicit env vars (FORGE_LATITUDE, FORGE_LONGITUDE, FORGE_CITY)
 * 2. CoreLocation on macOS (via swift CLI)
 * 3. IP-based geolocation (ip-api.com, free, no key)
 * 
 * Provides: city, country, timezone, lat/lon, cultural context hints.
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CACHE_FILE = join(homedir(), '.forge-location-cache.json');
const CACHE_TTL = 3600_000; // 1 hour — location changes slowly

/**
 * Cultural context mapping — maps regions to design hints.
 */
const CULTURAL_HINTS = {
  'DE': { style: 'clean, structured, efficient', colors: 'muted, professional', typography: 'sans-serif, clear hierarchy' },
  'JP': { style: 'minimal, precise, harmonious', colors: 'subtle, natural', typography: 'balanced whitespace' },
  'US': { style: 'bold, direct, accessible', colors: 'vibrant, high contrast', typography: 'large, readable' },
  'TR': { style: 'warm, ornamental, inviting', colors: 'rich, warm tones', typography: 'elegant, welcoming' },
  'FR': { style: 'elegant, refined, artistic', colors: 'sophisticated, muted', typography: 'serif accents, classic' },
  'default': { style: 'modern, universal', colors: 'balanced', typography: 'clean sans-serif' },
};

/**
 * Read cached location if still fresh.
 */
function readCache() {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const data = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
    if (Date.now() - data.timestamp < CACHE_TTL) return data.location;
  } catch {}
  return null;
}

/**
 * Write location to cache.
 */
function writeCache(location) {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify({ timestamp: Date.now(), location }));
  } catch {}
}

/**
 * Try env vars first (most reliable, user-configured).
 */
function fromEnv() {
  const city = process.env.FORGE_CITY;
  const country = process.env.FORGE_COUNTRY;
  const lat = parseFloat(process.env.FORGE_LATITUDE);
  const lon = parseFloat(process.env.FORGE_LONGITUDE);

  if (city && country) {
    return { city, country, lat: lat || null, lon: lon || null, source: 'env' };
  }
  return null;
}

/**
 * Try IP-based geolocation (free, no key required).
 */
function fromIpApi() {
  try {
    const result = execSync(
      'curl -sf --max-time 5 "http://ip-api.com/json/?fields=city,country,countryCode,lat,lon,timezone"',
      { encoding: 'utf-8', timeout: 8_000 }
    );
    const data = JSON.parse(result);
    if (data.city) {
      return {
        city: data.city,
        country: data.countryCode || data.country,
        lat: data.lat,
        lon: data.lon,
        timezone: data.timezone,
        source: 'ip-api',
      };
    }
  } catch {}
  return null;
}

/**
 * Detect current location with graceful fallback chain.
 * @returns {Promise<object|null>} Location data or null
 */
export async function detectLocation() {
  // Check cache first
  const cached = readCache();
  if (cached) return cached;

  // Try sources in order of reliability
  const location = fromEnv() || fromIpApi();

  if (location) {
    writeCache(location);
  }

  return location;
}

/**
 * Build location context string for prompt enrichment.
 * @returns {Promise<string>} Context line for L1 injection
 */
export async function locationContext() {
  const loc = await detectLocation();
  if (!loc) return '';

  const cultural = CULTURAL_HINTS[loc.country] || CULTURAL_HINTS['default'];
  const parts = [
    `📍 Location: ${loc.city}, ${loc.country}`,
  ];

  if (loc.timezone) parts.push(`Timezone: ${loc.timezone}`);
  parts.push(`Cultural design affinity: ${cultural.style}`);
  parts.push(`Color tendency: ${cultural.colors}`);

  return parts.join(' | ');
}

/**
 * Get raw location data (for other modules).
 */
export async function getLocation() {
  return detectLocation();
}
