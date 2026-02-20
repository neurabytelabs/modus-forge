/**
 * Spotify Context Skill — Enrich forge prompts with music/mood data.
 *
 * Reads currently playing or recent tracks from Spotify (via AppleScript
 * for local Spotify app, or optional Web API for richer data).
 *
 * Philosophy: "Music is not less rational than philosophy." — Spinoza
 *
 * Music context makes generated apps emotionally aligned with the user's
 * current state — a lo-fi listener gets calm UIs, metal fan gets bold ones.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CACHE_DIR = join(homedir(), '.modus-forge', 'music');
const CACHE_FILE = join(CACHE_DIR, 'spotify-cache.json');
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * @typedef {Object} SpotifyTrack
 * @property {string} name - Track name
 * @property {string} artist - Artist name
 * @property {string} album - Album name
 * @property {number|null} durationMs - Track duration
 * @property {number|null} positionMs - Current position
 * @property {string} state - 'playing' | 'paused' | 'stopped'
 */

/**
 * @typedef {Object} MusicMood
 * @property {string} energy - 'low' | 'medium' | 'high'
 * @property {string} palette - Suggested color palette
 * @property {string} vibe - Short mood descriptor
 * @property {string} fontHint - Typography suggestion
 */

// Genre/artist → mood mapping (heuristic, no API needed)
const MOOD_PATTERNS = [
  { pattern: /lo-?fi|chill|ambient|jazz|bossa/i, mood: { energy: 'low', palette: 'muted earth tones, soft pastels', vibe: 'calm, contemplative', fontHint: 'rounded sans-serif, generous spacing' } },
  { pattern: /metal|punk|hardcore|industrial/i, mood: { energy: 'high', palette: 'black, red, stark contrast', vibe: 'intense, bold', fontHint: 'condensed, angular, heavy weight' } },
  { pattern: /electronic|techno|house|edm|synth/i, mood: { energy: 'high', palette: 'neon cyan, magenta, dark backgrounds', vibe: 'futuristic, kinetic', fontHint: 'monospace or geometric sans' } },
  { pattern: /classical|orchestr|piano|beethoven|bach|mozart/i, mood: { energy: 'medium', palette: 'ivory, gold, deep navy', vibe: 'elegant, structured', fontHint: 'serif, classical proportions' } },
  { pattern: /hip.?hop|rap|trap|drill/i, mood: { energy: 'high', palette: 'bold primaries, black, gold', vibe: 'confident, dynamic', fontHint: 'display, heavy, tight tracking' } },
  { pattern: /pop|dance|disco/i, mood: { energy: 'high', palette: 'bright, playful, gradient-heavy', vibe: 'upbeat, accessible', fontHint: 'friendly rounded sans' } },
  { pattern: /folk|acoustic|country|indie.?folk/i, mood: { energy: 'low', palette: 'warm browns, forest greens, cream', vibe: 'organic, grounded', fontHint: 'humanist serif or handwritten feel' } },
  { pattern: /rock|alternative|grunge/i, mood: { energy: 'medium', palette: 'denim blues, warm grays, red accents', vibe: 'raw, authentic', fontHint: 'sturdy sans-serif, slight roughness' } },
];

const DEFAULT_MOOD = { energy: 'medium', palette: 'balanced, neutral with accent color', vibe: 'focused', fontHint: 'clean sans-serif' };

/**
 * Get currently playing track from Spotify via AppleScript (macOS only).
 * @returns {SpotifyTrack|null}
 */
export function getNowPlaying() {
  try {
    const script = `
      if application "Spotify" is running then
        tell application "Spotify"
          set trackName to name of current track
          set trackArtist to artist of current track
          set trackAlbum to album of current track
          set trackDuration to duration of current track
          set trackPosition to player position
          set playerState to player state as string
          return trackName & "|||" & trackArtist & "|||" & trackAlbum & "|||" & trackDuration & "|||" & (trackPosition * 1000 as integer) & "|||" & playerState
        end tell
      else
        return "NOT_RUNNING"
      end if
    `;
    const result = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
      timeout: 3000,
      encoding: 'utf-8',
    }).trim();

    if (result === 'NOT_RUNNING' || !result) return null;

    const [name, artist, album, durationMs, positionMs, state] = result.split('|||');
    const track = {
      name: name || 'Unknown',
      artist: artist || 'Unknown',
      album: album || 'Unknown',
      durationMs: parseInt(durationMs) || null,
      positionMs: parseInt(positionMs) || null,
      state: state?.toLowerCase()?.includes('playing') ? 'playing' : 'paused',
    };

    // Cache it
    try {
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(CACHE_FILE, JSON.stringify({ ...track, timestamp: Date.now() }));
    } catch {}

    return track;
  } catch {
    return getCachedTrack();
  }
}

/**
 * Read cached track data (fallback when Spotify isn't responding).
 * @returns {SpotifyTrack|null}
 */
function getCachedTrack() {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const data = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
    if (Date.now() - data.timestamp > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Map a track to a mood profile using genre/artist heuristics.
 * @param {SpotifyTrack} track
 * @returns {MusicMood}
 */
export function inferMood(track) {
  if (!track) return DEFAULT_MOOD;
  const searchStr = `${track.name} ${track.artist} ${track.album}`;
  for (const { pattern, mood } of MOOD_PATTERNS) {
    if (pattern.test(searchStr)) return mood;
  }
  return DEFAULT_MOOD;
}

/**
 * Generate a context line for RUNE L1 injection.
 * @returns {string} Context line or empty string
 */
export function spotifyContext() {
  const track = getNowPlaying();
  if (!track) return '';

  const mood = inferMood(track);
  const stateEmoji = track.state === 'playing' ? '🎵' : '⏸️';

  return `${stateEmoji} Music: "${track.name}" by ${track.artist} [${mood.vibe}] — suggest ${mood.palette} palette, ${mood.fontHint}`;
}

/**
 * Get full music context object (for templates/dashboards).
 * @returns {{ track: SpotifyTrack|null, mood: MusicMood, context: string }}
 */
export function getMusicContext() {
  const track = getNowPlaying();
  const mood = inferMood(track);
  const context = spotifyContext();
  return { track, mood, context };
}
