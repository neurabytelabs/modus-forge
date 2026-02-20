/**
 * Calendar Context — Inject upcoming events into prompt context.
 * 
 * Reads from system calendar (macOS `icalBuddy`) or Google Calendar API
 * to provide time-aware context for generated apps.
 * 
 * "We are driven by desire to persist in our being,
 * and time is the medium of that persistence." — Spinoza-inspired
 */

import { execSync } from 'node:child_process';

/**
 * @typedef {Object} CalendarEvent
 * @property {string} title
 * @property {string} start - ISO timestamp
 * @property {string} [end] - ISO timestamp
 * @property {string} [location]
 * @property {boolean} isNow - Currently happening
 * @property {boolean} isSoon - Within next 2 hours
 */

/**
 * Get upcoming calendar events using icalBuddy (macOS).
 * Falls back gracefully if not available.
 * @param {Object} options
 * @param {number} [options.hours=24] - Hours to look ahead
 * @param {number} [options.limit=10] - Max events
 * @returns {CalendarEvent[]}
 */
export function getEvents(options = {}) {
  const hours = options.hours || 24;
  const limit = options.limit || 10;

  try {
    // Try icalBuddy first (macOS native)
    const raw = execSync(
      `icalBuddy -n -nc -nrd -ea -df "%Y-%m-%dT%H:%M" -tf "%H:%M" -li ${limit} -ps "| — |" eventsFrom:today to:today+${Math.ceil(hours / 24)}d 2>/dev/null`,
      { encoding: 'utf-8', timeout: 5000 }
    ).trim();

    if (!raw) return [];

    return parseIcalBuddyOutput(raw);
  } catch {
    // icalBuddy not installed or failed
    return [];
  }
}

/**
 * Parse icalBuddy output into structured events.
 * @param {string} raw
 * @returns {CalendarEvent[]}
 */
function parseIcalBuddyOutput(raw) {
  const now = new Date();
  const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const events = [];

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;

    // icalBuddy format: "title — start - end (calendar)"
    const parts = line.split(' — ');
    if (parts.length < 2) continue;

    const title = parts[0].trim().replace(/^[•●]\s*/, '');
    const timePart = parts.slice(1).join(' — ').trim();

    // Extract time range
    const timeMatch = timePart.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
    const startStr = timeMatch ? timeMatch[1] : null;

    let start = startStr ? new Date(startStr) : null;
    let isNow = false;
    let isSoon = false;

    if (start) {
      isNow = start <= now;
      isSoon = !isNow && start <= twoHoursLater;
    }

    events.push({
      title,
      start: start ? start.toISOString() : new Date().toISOString(),
      isNow,
      isSoon,
    });
  }

  return events;
}

/**
 * Generate a context string for prompt injection.
 * @param {CalendarEvent[]} [events] - Pre-fetched events, or auto-fetch
 * @returns {string} Human-readable calendar context line
 */
export function calendarContext(events) {
  const evts = events || getEvents({ hours: 8, limit: 5 });

  if (evts.length === 0) {
    return 'Calendar: No upcoming events.';
  }

  const parts = evts.map(e => {
    const prefix = e.isNow ? '🔴 NOW' : e.isSoon ? '🟡 SOON' : '⚪';
    const time = new Date(e.start).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${prefix} ${time} ${e.title}`;
  });

  return `Calendar:\n${parts.join('\n')}`;
}
