import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { listSkills, skillCount, gatherSkillContexts } from '../lib/skills/loader.js';

describe('Skill Loader', () => {
  it('should list installed skills', async () => {
    const skills = await listSkills();
    assert.ok(Array.isArray(skills));
    assert.ok(skills.length > 0, 'Should find at least one skill');
  });

  it('should return skill metadata', async () => {
    const skills = await listSkills();
    const first = skills[0];
    assert.ok(first.name);
    assert.ok(first.category);
    assert.ok(typeof first.hasContext === 'boolean');
  });

  it('should count skills without loading', () => {
    const count = skillCount();
    assert.ok(typeof count === 'number');
    assert.ok(count >= 0);
  });

  it('should gather skill contexts gracefully', async () => {
    const contexts = await gatherSkillContexts();
    assert.ok(Array.isArray(contexts));
  });
});
