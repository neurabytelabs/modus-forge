/**
 * Versioning & Diff — Track prompt evolution across iterations.
 * Semantic diff shows what changed between versions at the sentence level.
 * 
 * "The order and connection of ideas is the same as the order
 *  and connection of things." — Spinoza, Ethics II, Prop. 7
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const VERSIONS_DIR = join(process.env.HOME || '/tmp', '.forge', 'versions');

function ensureDir() {
  if (!existsSync(VERSIONS_DIR)) mkdirSync(VERSIONS_DIR, { recursive: true });
}

function hashContent(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

/**
 * Save a new version of a prompt.
 * @param {string} promptId - Unique identifier for the prompt
 * @param {string} content - The prompt text
 * @param {object} meta - Optional metadata (provider, score, etc.)
 * @returns {object} Version record
 */
export function saveVersion(promptId, content, meta = {}) {
  ensureDir();
  const filePath = join(VERSIONS_DIR, `${promptId}.json`);
  const versions = existsSync(filePath) ? JSON.parse(readFileSync(filePath, 'utf8')) : [];
  
  const hash = hashContent(content);
  // Skip if identical to latest
  if (versions.length > 0 && versions[versions.length - 1].hash === hash) {
    return versions[versions.length - 1];
  }

  const version = {
    v: versions.length + 1,
    hash,
    timestamp: new Date().toISOString(),
    content,
    meta,
    parentHash: versions.length > 0 ? versions[versions.length - 1].hash : null
  };

  versions.push(version);
  writeFileSync(filePath, JSON.stringify(versions, null, 2));
  return version;
}

/**
 * Get all versions of a prompt.
 */
export function getVersions(promptId) {
  ensureDir();
  const filePath = join(VERSIONS_DIR, `${promptId}.json`);
  return existsSync(filePath) ? JSON.parse(readFileSync(filePath, 'utf8')) : [];
}

/**
 * Sentence-level semantic diff between two texts.
 * Returns added, removed, and unchanged sentences.
 */
export function semanticDiff(oldText, newText) {
  const splitSentences = (text) => text
    .split(/(?<=[.!?])\s+|(?<=\n)/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const oldSentences = splitSentences(oldText);
  const newSentences = splitSentences(newText);
  const oldSet = new Set(oldSentences);
  const newSet = new Set(newSentences);

  const added = newSentences.filter(s => !oldSet.has(s));
  const removed = oldSentences.filter(s => !newSet.has(s));
  const unchanged = oldSentences.filter(s => newSet.has(s));

  const similarity = unchanged.length / Math.max(oldSentences.length, newSentences.length, 1);

  return { added, removed, unchanged, similarity: Math.round(similarity * 100) };
}

/**
 * Diff between two versions of a prompt.
 */
export function diffVersions(promptId, v1, v2) {
  const versions = getVersions(promptId);
  const ver1 = versions.find(v => v.v === v1);
  const ver2 = versions.find(v => v.v === v2);
  if (!ver1 || !ver2) return null;
  return {
    from: v1,
    to: v2,
    ...semanticDiff(ver1.content, ver2.content),
    timeDelta: new Date(ver2.timestamp) - new Date(ver1.timestamp)
  };
}

/**
 * Get evolution summary: how a prompt changed over all versions.
 */
export function evolutionSummary(promptId) {
  const versions = getVersions(promptId);
  if (versions.length < 2) return { versions: versions.length, diffs: [] };

  const diffs = [];
  for (let i = 1; i < versions.length; i++) {
    const d = semanticDiff(versions[i - 1].content, versions[i].content);
    diffs.push({
      from: versions[i - 1].v,
      to: versions[i].v,
      added: d.added.length,
      removed: d.removed.length,
      similarity: d.similarity,
      scoreDelta: (versions[i].meta?.score || 0) - (versions[i - 1].meta?.score || 0)
    });
  }

  return { versions: versions.length, diffs };
}
