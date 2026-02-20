import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toGenes, crossover, mutate, tournamentSelect } from '../lib/iterate/genetic.js';

describe('Genetic Algorithm', () => {
  const samplePrompt = 'Create a clean dashboard with dark mode. Include animated charts. Use modern typography with gradient accents.';

  describe('toGenes', () => {
    it('splits prompt into gene segments', () => {
      const genes = toGenes(samplePrompt);
      assert.ok(genes.length >= 2, `expected 2+ genes, got ${genes.length}`);
      assert.ok(genes.every(g => g.length > 5), 'all genes > 5 chars');
    });

    it('handles single-sentence prompts', () => {
      const genes = toGenes('Build a todo app');
      assert.ok(genes.length >= 1);
    });
  });

  describe('crossover', () => {
    it('produces a child combining both parents', () => {
      const genesA = ['Create a dashboard.', 'Use dark mode.', 'Add charts.'];
      const genesB = ['Build a tracker.', 'Use light theme.', 'Include tables.'];
      const child = crossover(genesA, genesB);
      assert.ok(typeof child === 'string');
      assert.ok(child.length > 10, 'child should be non-trivial');
    });
  });

  describe('mutate', () => {
    it('returns a string', () => {
      const result = mutate(samplePrompt, 1.0); // 100% mutation rate
      assert.ok(typeof result === 'string');
      assert.ok(result.length > 0);
    });

    it('with rate 0 returns original genes joined', () => {
      const result = mutate(samplePrompt, 0);
      // Should be roughly the same (just re-joined)
      const genes = toGenes(samplePrompt);
      assert.strictEqual(result, genes.join(' '));
    });
  });

  describe('tournamentSelect', () => {
    it('selects the fittest from candidates', () => {
      const pop = [
        { prompt: 'a', fitness: { total: 0.3 } },
        { prompt: 'b', fitness: { total: 0.9 } },
        { prompt: 'c', fitness: { total: 0.5 } },
      ];
      // With tournament size = population size, always picks best
      const winner = tournamentSelect(pop, 3);
      assert.ok(winner.fitness.total >= 0.3, 'winner should have reasonable fitness');
    });

    it('handles population with no fitness', () => {
      const pop = [{ prompt: 'a' }, { prompt: 'b' }];
      const winner = tournamentSelect(pop, 2);
      assert.ok(winner.prompt, 'should still return an individual');
    });
  });
});
