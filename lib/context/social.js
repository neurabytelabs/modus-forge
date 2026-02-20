/**
 * Social Context Sensor — Injects social media activity into RUNE L1 context.
 * Checks GitHub notifications and trending repos. No API key needed for trending.
 * Graceful fallback on failure.
 */

import { execSync } from 'node:child_process';

const GH_TRENDING = 'https://api.github.com/search/repositories?q=created:>DATE&sort=stars&order=desc&per_page=5';
const GH_NOTIFICATIONS = 'https://api.github.com/notifications?per_page=10';
const TTL_MS = 30 * 60 * 1000; // 30 min cache

let cache = { data: null, ts: 0 };

const TOPIC_VIBES = {
  ai:       { mood: 'inspired', vibe: 'the dev world is buzzing about AI' },
  web:      { mood: 'creative', vibe: 'new web tools and frameworks trending' },
  devtools: { mood: 'productive', vibe: 'developer tooling is evolving fast' },
  systems:  { mood: 'ambitious', vibe: 'infrastructure and systems innovation' },
  default:  { mood: 'connected', vibe: 'the open source community is active' },
};

/**
 * Classify repo topic.
 */
function classifyRepo(repo) {
  const desc = ((repo.description || '') + ' ' + (repo.language || '')).toLowerCase();
  if (/\bai\b|llm|machine.?learn|neural|model|agent|gpt|transformer/.test(desc)) return 'ai';
  if (/react|vue|svelte|css|frontend|web|next\.?js|tailwind/.test(desc)) return 'web';
  if (/cli|editor|terminal|tool|dev|debug|lint|format|build/.test(desc)) return 'devtools';
  if (/rust|go|kernel|database|distributed|infra|docker/.test(desc)) return 'systems';
  return 'default';
}

/**
 * Get yesterday's date for trending query.
 */
function yesterdayISO() {
  const d = new Date(Date.now() - 86400000);
  return d.toISOString().split('T')[0];
}

/**
 * Fetch GitHub trending repos (no auth needed).
 */
function fetchTrending() {
  try {
    const url = GH_TRENDING.replace('DATE', yesterdayISO());
    const raw = execSync(`curl -sf "${url}" -H "Accept: application/vnd.github+json"`, {
      timeout: 10000,
      encoding: 'utf-8',
    });
    const data = JSON.parse(raw);
    return (data.items || []).slice(0, 5);
  } catch {
    return [];
  }
}

/**
 * Fetch GitHub notifications (needs GITHUB_TOKEN or gh auth).
 */
function fetchNotifications() {
  try {
    // Try gh CLI first (uses stored auth)
    const raw = execSync('gh api /notifications --jq ".[0:5] | .[] | .subject.title"', {
      timeout: 10000,
      encoding: 'utf-8',
    });
    return raw.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Sense social context — returns context string for L1 injection.
 * @returns {{ context: string, mood: string, trending: object[] }}
 */
export function sense() {
  const now = Date.now();
  if (cache.data && (now - cache.ts) < TTL_MS) {
    return cache.data;
  }

  const trending = fetchTrending();
  const notifications = fetchNotifications();

  // Determine dominant topic
  const topics = trending.map(classifyRepo);
  const topicCounts = {};
  for (const t of topics) topicCounts[t] = (topicCounts[t] || 0) + 1;
  const dominantTopic = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'default';
  const vibeInfo = TOPIC_VIBES[dominantTopic];

  const trendingNames = trending.map(r => `${r.full_name} ⭐${r.stargazers_count}`).join(', ');
  const notifSummary = notifications.length > 0
    ? `You have ${notifications.length} GitHub notifications: ${notifications.slice(0, 3).join('; ')}`
    : 'No pending GitHub notifications';

  const context = [
    `Social context: ${vibeInfo.vibe}.`,
    trendingNames ? `Trending repos: ${trendingNames}.` : '',
    notifSummary,
  ].filter(Boolean).join(' ');

  const result = {
    context,
    mood: vibeInfo.mood,
    trending: trending.map(r => ({
      name: r.full_name,
      stars: r.stargazers_count,
      language: r.language,
      topic: classifyRepo(r),
    })),
    notifications: notifications.length,
  };

  cache = { data: result, ts: now };
  return result;
}
