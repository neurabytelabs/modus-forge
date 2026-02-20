import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { saveVersion, getVersions, semanticDiff, diffVersions, evolutionSummary } from '../lib/versioning/diff.js';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const VERSIONS_DIR = join(process.env.HOME || '/tmp', '.forge', 'versions');

describe('Versioning & Diff', () => {
  const testId = `test-prompt-${Date.now()}`;

  it('saves and retrieves versions', () => {
    const v1 = saveVersion(testId, 'Create a landing page with hero section.');
    assert.equal(v1.v, 1);
    assert.ok(v1.hash);
    
    const v2 = saveVersion(testId, 'Create a modern landing page with hero section and CTA.');
    assert.equal(v2.v, 2);
    
    const versions = getVersions(testId);
    assert.equal(versions.length, 2);
    assert.equal(versions[1].parentHash, versions[0].hash);
  });

  it('deduplicates identical content', () => {
    const id = `dedup-${Date.now()}`;
    saveVersion(id, 'Same content.');
    saveVersion(id, 'Same content.');
    assert.equal(getVersions(id).length, 1);
  });

  it('semantic diff detects changes', () => {
    const diff = semanticDiff(
      'The hero is blue. It has a CTA button. Footer is simple.',
      'The hero is red. It has a CTA button. New section added.'
    );
    assert.ok(diff.added.length > 0);
    assert.ok(diff.removed.length > 0);
    assert.ok(diff.unchanged.length > 0);
    assert.ok(diff.similarity >= 0 && diff.similarity <= 100);
  });

  it('diff between versions works', () => {
    const id = `diff-${Date.now()}`;
    saveVersion(id, 'Version one. Simple page.');
    saveVersion(id, 'Version two. Complex page with animations.');
    const diff = diffVersions(id, 1, 2);
    assert.ok(diff);
    assert.equal(diff.from, 1);
    assert.equal(diff.to, 2);
    assert.ok(diff.added.length > 0);
  });

  it('evolution summary tracks progression', () => {
    const id = `evo-${Date.now()}`;
    saveVersion(id, 'Basic page.', { score: 50 });
    saveVersion(id, 'Better page with style.', { score: 70 });
    saveVersion(id, 'Best page with animations and dark mode.', { score: 90 });
    const summary = evolutionSummary(id);
    assert.equal(summary.versions, 3);
    assert.equal(summary.diffs.length, 2);
    assert.ok(summary.diffs[0].scoreDelta > 0);
  });

  it('returns empty for nonexistent prompt', () => {
    assert.deepEqual(getVersions('nonexistent-xyz'), []);
  });
});
