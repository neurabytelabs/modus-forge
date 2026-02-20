import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand, SUBCOMMANDS } from '../lib/cli/commands.js';

describe('CLI Commands', () => {
  it('should detect subcommands', () => {
    const { command, args } = parseCommand(['grimoire', 'list']);
    assert.equal(command, 'grimoire');
    assert.deepEqual(args, ['list']);
  });

  it('should default to forge for prompts', () => {
    const { command, args } = parseCommand(['Track my sleep']);
    assert.equal(command, 'forge');
    assert.deepEqual(args, ['Track my sleep']);
  });

  it('should detect all registered subcommands', () => {
    for (const name of Object.keys(SUBCOMMANDS)) {
      const { command } = parseCommand([name]);
      assert.equal(command, name);
    }
  });

  it('should pass remaining args to subcommand', () => {
    const { command, args } = parseCommand(['evolve', 'make a dashboard', '--generations', '5']);
    assert.equal(command, 'evolve');
    assert.deepEqual(args, ['make a dashboard', '--generations', '5']);
  });
});
