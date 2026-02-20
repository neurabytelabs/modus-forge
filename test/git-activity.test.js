import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getGitActivity, getGitContextLine } from '../lib/context/git-activity.js';

describe('git-activity', () => {
  it('returns valid context for current repo', () => {
    const ctx = getGitActivity(process.cwd());
    assert.equal(typeof ctx.isRepo, 'boolean');
    assert.equal(typeof ctx.summary, 'string');
    assert.ok(ctx.summary.length > 0);
    if (ctx.isRepo) {
      assert.ok(ctx.branch.length > 0);
      assert.ok(Array.isArray(ctx.recentCommits));
      assert.ok(Array.isArray(ctx.activeBranches));
      assert.equal(typeof ctx.commitFrequency, 'number');
    }
  });

  it('returns isRepo=false for non-repo path', () => {
    const ctx = getGitActivity('/tmp');
    assert.equal(ctx.isRepo, false);
    assert.equal(ctx.summary, 'Not a git repository.');
  });

  it('getGitContextLine returns a string', () => {
    const line = getGitContextLine(process.cwd());
    assert.equal(typeof line, 'string');
    assert.ok(line.length > 0);
  });
});
