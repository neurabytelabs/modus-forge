/**
 * News Context Sensor — Injects trending topics into RUNE L1 context.
 * Uses Hacker News API (free, no key). Maps top stories to tech mood.
 * Graceful fallback on failure.
 */

import { execSync } from 'node:child_process';

const HN_TOP = 'https://hacker-news.firebaseio.com/v0/topstories.json';
const HN_ITEM = 'https://hacker-news.firebaseio.com/v0/item';
const TTL_MS = 60 * 60 * 1000; // cache 1 hour
const MAX_STORIES = 5;

let cache = { data: null, ts: 0 };

const TOPIC_MOODS = {
  ai:       { mood: 'futuristic', theme: 'neural networks, intelligence', vibe: 'cutting-edge and ambitious' },
  security: { mood: 'cautious', theme: 'locks, shields, encryption', vibe: 'vigilant and precise' },
  startup:  { mood: 'energetic', theme: 'growth, disruption, launch', vibe: 'bold and scrappy' },
  systems:  { mood: 'architectural', theme: 'infrastructure, scaling', vibe: 'solid and methodical' },
  web:      { mood: 'creative', theme: 'design, interaction, browsers', vibe: 'playful and user-focused' },
  science:  { mood: 'curious', theme: 'discovery, research, data', vibe: 'analytical and wonder-filled' },
  default:  { mood: 'informed', theme: 'current events, technology', vibe: 'aware and adaptive' },
};

/**
 * Classify a title into a topic category.
 */
function classifyTopic(title) {
  const t = (title || '').toLowerCase();
  if (/\bai\b|llm|gpt|machine.?learn|neural|deep.?learn|model|transformer/.test(t)) return 'ai';
  if (/security|hack|breach|vuln|cve|encrypt|privacy|zero.?day/.test(t)) return 'security';
  if (/startup|launch|funding|yc|series [a-d]|ipo|valuation/.test(t)) return 'startup';
  if (/rust|linux|kernel|database|postgres|redis|infra|docker|k8s/.test(t)) return 'systems';
  if (/css|html|react|javascript|browser|web|frontend|design/.test(t)) return 'web';
  if (/science|research|paper|physics|math|biology|climate/.test(t)) return 'science';
  return 'default';
}

/**
 * Fetch a single HN item by ID.
 */
function fetchItem(id) {
  try {
    const raw = execSync(`curl -sf "${HN_ITEM}/${id}.json"`, {
      timeout: 5000,
      encoding: 'utf-8',
    });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Fetch top HN story IDs.
 */
function fetchTopIds() {
  try {
    const raw = execSync(`curl -sf "${HN_TOP}"`, {
      timeout: 5000,
      encoding: 'utf-8',
    });
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Get current tech news summary.
 * @returns {{ stories: Array, dominantTopic: string, mood: object } | null}
 */
export function getNews() {
  const now = Date.now();
  if (cache.data && (now - cache.ts) < TTL_MS) return cache.data;

  try {
    const ids = fetchTopIds();
    if (!ids.length) return null;

    const stories = ids.slice(0, MAX_STORIES)
      .map(fetchItem)
      .filter(Boolean)
      .map(item => ({
        title: item.title,
        url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
        score: item.score || 0,
        topic: classifyTopic(item.title),
      }));

    if (!stories.length) return null;

    // Find dominant topic by frequency
    const topicCounts = {};
    for (const s of stories) {
      topicCounts[s.topic] = (topicCounts[s.topic] || 0) + 1;
    }
    const dominantTopic = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])[0][0];

    const result = {
      stories,
      dominantTopic,
      mood: TOPIC_MOODS[dominantTopic] || TOPIC_MOODS.default,
      fetchedAt: new Date().toISOString(),
    };

    cache = { data: result, ts: now };
    return result;
  } catch {
    return null;
  }
}

/**
 * Format news as a RUNE L1 context line.
 */
export function newsContext() {
  const n = getNews();
  if (!n) return '';

  const headlines = n.stories.slice(0, 3).map(s => s.title).join('; ');
  return `Tech trends: ${headlines} — dominant topic: ${n.dominantTopic}, mood: ${n.mood.mood}, theme: ${n.mood.theme}, vibe: ${n.mood.vibe}`;
}

/**
 * Clear cache (for testing).
 */
export function clearCache() {
  cache = { data: null, ts: 0 };
}
