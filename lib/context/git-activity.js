/**
 * Git Activity Context — Extracts recent git activity to enrich prompts.
 * 
 * Adds signals like: what the user has been working on, commit frequency,
 * active branches, languages touched. This helps the enhancer produce
 * contextually relevant outputs (e.g., if user is working on a dashboard,
 * the generated app might lean toward data-viz patterns).
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/**
 * @typedef {object} GitContext
 * @property {boolean} isRepo - Whether the path is a git repo
 * @property {string} branch - Current branch name
 * @property {string[]} recentCommits - Last N commit messages
 * @property {string[]} changedFiles - Files changed in last N commits
 * @property {string[]} activeBranches - Recently active branches
 * @property {number} commitFrequency - Commits in last 7 days
 * @property {string} summary - Human-readable summary for prompt injection
 */

/**
 * Run a git command safely, returning stdout or fallback.
 * @param {string} cmd
 * @param {string} cwd
 * @param {string} [fallback='']
 * @returns {string}
 */
function git(cmd, cwd, fallback = '') {
  try {
    return execSync(`git ${cmd}`, { cwd, encoding: 'utf-8', timeout: 5000 }).trim();
  } catch {
    return fallback;
  }
}

/**
 * Gather git activity context from a repository path.
 * @param {string} [repoPath=process.cwd()] - Path to git repo
 * @param {object} [opts]
 * @param {number} [opts.commitCount=10] - Number of recent commits to fetch
 * @param {number} [opts.branchCount=5] - Number of active branches to list
 * @returns {GitContext}
 */
export function getGitActivity(repoPath = process.cwd(), opts = {}) {
  const { commitCount = 10, branchCount = 5 } = opts;

  const gitDir = existsSync(`${repoPath}/.git`);
  if (!gitDir) {
    return {
      isRepo: false,
      branch: '',
      recentCommits: [],
      changedFiles: [],
      activeBranches: [],
      commitFrequency: 0,
      summary: 'Not a git repository.',
    };
  }

  const branch = git('rev-parse --abbrev-ref HEAD', repoPath, 'unknown');

  const commitLog = git(`log --oneline -${commitCount} --no-decorate`, repoPath);
  const recentCommits = commitLog ? commitLog.split('\n').map(l => l.replace(/^[a-f0-9]+ /, '')) : [];

  const diffStat = git(`diff --stat HEAD~${Math.min(commitCount, 5)} HEAD --name-only`, repoPath);
  const changedFiles = diffStat ? [...new Set(diffStat.split('\n').filter(Boolean))] : [];

  const branchesRaw = git(
    `for-each-ref --sort=-committerdate refs/heads/ --format='%(refname:short)' --count=${branchCount}`,
    repoPath
  );
  const activeBranches = branchesRaw ? branchesRaw.split('\n').filter(Boolean) : [];

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const weekCommits = git(`rev-list --count --since="${weekAgo}" HEAD`, repoPath, '0');
  const commitFrequency = parseInt(weekCommits, 10) || 0;

  // Detect primary languages from changed files
  const extCounts = {};
  for (const f of changedFiles) {
    const ext = f.split('.').pop()?.toLowerCase();
    if (ext && ext.length < 8) extCounts[ext] = (extCounts[ext] || 0) + 1;
  }
  const topExts = Object.entries(extCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([ext]) => ext);

  const themes = recentCommits.slice(0, 5).join(', ');
  const summary = [
    `Git: branch "${branch}", ${commitFrequency} commits this week.`,
    topExts.length ? `Languages: ${topExts.join(', ')}.` : '',
    themes ? `Recent work: ${themes}.` : '',
  ].filter(Boolean).join(' ');

  return {
    isRepo: true,
    branch,
    recentCommits,
    changedFiles,
    activeBranches,
    commitFrequency,
    summary,
  };
}

/**
 * Get a compact context string suitable for prompt L1 injection.
 * @param {string} [repoPath]
 * @returns {string}
 */
export function getGitContextLine(repoPath) {
  const ctx = getGitActivity(repoPath);
  return ctx.summary;
}
