import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getPersona, applyPersona, personaSystemInstruction, BUILTIN } from '../lib/persona/engine.js';

describe('Persona Engine', () => {
  it('returns architect as default persona', () => {
    const p = getPersona(null);
    assert.equal(p.name, 'Architect');
    assert.ok(p.systemHint.length > 0);
  });

  it('returns all 6 built-in personas', () => {
    const names = ['architect', 'hacker', 'artist', 'brutalist', 'zen', 'spinoza'];
    for (const name of names) {
      const p = getPersona(name);
      assert.ok(p, `Missing persona: ${name}`);
      assert.ok(p.name, `Persona ${name} has no name`);
      assert.ok(p.tone, `Persona ${name} has no tone`);
      assert.ok(p.style, `Persona ${name} has no style`);
      assert.ok(p.palette, `Persona ${name} has no palette`);
      assert.ok(p.systemHint, `Persona ${name} has no systemHint`);
    }
  });

  it('returns null for unknown persona', () => {
    assert.equal(getPersona('nonexistent-persona-xyz'), null);
  });

  it('applyPersona prepends context to prompt', () => {
    const result = applyPersona('Build a todo app', 'hacker');
    assert.ok(result.includes('[Persona: Hacker]'));
    assert.ok(result.includes('Build a todo app'));
    assert.ok(result.includes('Tone: direct and technical'));
  });

  it('applyPersona handles unknown persona gracefully', () => {
    const result = applyPersona('Build a todo app', 'nonexistent-xyz');
    assert.equal(result, 'Build a todo app');
  });

  it('personaSystemInstruction generates valid text', () => {
    const inst = personaSystemInstruction('spinoza');
    assert.ok(inst.includes('Spinoza'));
    assert.ok(inst.includes('purple'));
    assert.ok(inst.length > 50);
  });

  it('personaSystemInstruction handles null', () => {
    assert.equal(personaSystemInstruction(null), '');
  });

  it('BUILTIN has consistent shape', () => {
    const requiredKeys = ['name', 'description', 'tone', 'style', 'palette', 'typography', 'layout', 'codeStyle', 'systemHint'];
    for (const [key, persona] of Object.entries(BUILTIN)) {
      for (const rk of requiredKeys) {
        assert.ok(rk in persona, `${key} missing ${rk}`);
      }
    }
  });
});
