/**
 * Genetic Evolution — Evolve prompts through selection, crossover, and mutation.
 * 
 * Treats prompt fragments as genes. A population of prompt variants compete
 * based on Spinoza fitness scores. The fittest reproduce; the weakest die.
 * 
 * Philosophy: "By perfection I understand the same as reality."
 * — Spinoza, Ethics II, Def 6
 * The most real (highest-scoring) variants survive and propagate.
 */

import { validate } from '../rune/validator.js';
import { route } from '../generators/router.js';

/**
 * @typedef {Object} Individual
 * @property {string} prompt - The prompt variant
 * @property {string} [code] - Generated code (filled after evaluation)
 * @property {{ conatus: number, ratio: number, laetitia: number, natura: number, total: number }} [fitness]
 * @property {number} generation
 */

/**
 * Split a prompt into gene segments (sentences/clauses).
 * @param {string} prompt
 * @returns {string[]}
 */
function toGenes(prompt) {
  return prompt.split(/(?<=[.!?\n])\s+/).filter(g => g.trim().length > 5);
}

/**
 * Recombine genes from two parents (single-point crossover).
 * @param {string[]} genesA
 * @param {string[]} genesB
 * @returns {string}
 */
function crossover(genesA, genesB) {
  const point = Math.floor(Math.random() * Math.min(genesA.length, genesB.length));
  const child = [...genesA.slice(0, point), ...genesB.slice(point)];
  return child.join(' ');
}

/**
 * Mutate a prompt by randomly tweaking one gene.
 * @param {string} prompt
 * @param {number} rate - Mutation probability per gene (0-1)
 * @returns {string}
 */
function mutate(prompt, rate = 0.2) {
  const genes = toGenes(prompt);
  const mutations = [
    g => g.replace(/simple/gi, 'elegant'),
    g => g.replace(/dark/gi, 'vibrant'),
    g => g.replace(/minimal/gi, 'rich'),
    g => g + ' with smooth animations',
    g => g + ' using glassmorphism effects',
    g => g.replace(/clean/gi, 'bold'),
    g => g + ' with micro-interactions on hover',
    g => g.replace(/professional/gi, 'creative'),
    g => g + ' featuring gradient accents',
    g => g.replace(/standard/gi, 'innovative'),
  ];
  const mutated = genes.map(g => {
    if (Math.random() < rate) {
      const fn = mutations[Math.floor(Math.random() * mutations.length)];
      return fn(g);
    }
    return g;
  });
  return mutated.join(' ');
}

/**
 * Tournament selection — pick the fittest from a random subset.
 * @param {Individual[]} population
 * @param {number} tournamentSize
 * @returns {Individual}
 */
function tournamentSelect(population, tournamentSize = 3) {
  const candidates = [];
  for (let i = 0; i < tournamentSize; i++) {
    candidates.push(population[Math.floor(Math.random() * population.length)]);
  }
  return candidates.sort((a, b) => (b.fitness?.total || 0) - (a.fitness?.total || 0))[0];
}

/**
 * Evaluate an individual by generating code and scoring it.
 * @param {Individual} ind
 * @param {string} model
 * @returns {Promise<Individual>}
 */
async function evaluate(ind, model) {
  try {
    const code = await route(ind.prompt, model);
    const rawScore = validate(code);
    const fitness = {
      conatus: rawScore.conatus,
      ratio: rawScore.ratio,
      laetitia: rawScore.laetitia,
      natura: rawScore.natura,
      total: (rawScore.conatus + rawScore.ratio + rawScore.laetitia + rawScore.natura) / 4
    };
    return { ...ind, code, fitness };
  } catch {
    return { ...ind, code: '', fitness: { conatus: 0, ratio: 0, laetitia: 0, natura: 0, total: 0 } };
  }
}

/**
 * Run genetic evolution on a base prompt.
 * @param {string} basePrompt - The seed prompt
 * @param {Object} [opts]
 * @param {string} [opts.model='gemini'] - LLM model
 * @param {number} [opts.populationSize=6] - Individuals per generation
 * @param {number} [opts.generations=3] - Number of generations
 * @param {number} [opts.mutationRate=0.2] - Mutation probability per gene
 * @param {number} [opts.eliteCount=2] - Top N carried forward unchanged
 * @param {number} [opts.threshold=0.9] - Stop if fitness >= this
 * @returns {Promise<{
 *   best: Individual,
 *   history: Array<{ generation: number, bestFitness: number, avgFitness: number, populationSize: number }>,
 *   totalEvaluations: number
 * }>}
 */
export async function evolve(basePrompt, opts = {}) {
  const {
    model = 'gemini',
    populationSize = 6,
    generations = 3,
    mutationRate = 0.2,
    eliteCount = 2,
    threshold = 0.9
  } = opts;

  const history = [];
  let totalEvaluations = 0;

  // Initialize population with mutations of the base prompt
  let population = [];
  for (let i = 0; i < populationSize; i++) {
    const prompt = i === 0 ? basePrompt : mutate(basePrompt, mutationRate);
    population.push({ prompt, generation: 0 });
  }

  for (let gen = 0; gen < generations; gen++) {
    // Evaluate all individuals
    population = await Promise.all(population.map(ind => evaluate(ind, model)));
    totalEvaluations += population.length;

    // Sort by fitness (descending)
    population.sort((a, b) => (b.fitness?.total || 0) - (a.fitness?.total || 0));

    const bestFitness = population[0]?.fitness?.total || 0;
    const avgFitness = population.reduce((s, p) => s + (p.fitness?.total || 0), 0) / population.length;
    history.push({ generation: gen, bestFitness: +bestFitness.toFixed(3), avgFitness: +avgFitness.toFixed(3), populationSize: population.length });

    // Early stopping
    if (bestFitness >= threshold) break;

    // Next generation
    const elite = population.slice(0, eliteCount).map(e => ({ ...e, generation: gen + 1 }));
    const offspring = [];
    while (offspring.length < populationSize - eliteCount) {
      const parentA = tournamentSelect(population);
      const parentB = tournamentSelect(population);
      const genesA = toGenes(parentA.prompt);
      const genesB = toGenes(parentB.prompt);
      const childPrompt = mutate(crossover(genesA, genesB), mutationRate);
      offspring.push({ prompt: childPrompt, generation: gen + 1 });
    }
    population = [...elite, ...offspring];
  }

  // Final sort
  population.sort((a, b) => (b.fitness?.total || 0) - (a.fitness?.total || 0));

  return {
    best: population[0],
    history,
    totalEvaluations
  };
}

// Named exports for testing
export { toGenes, crossover, mutate, tournamentSelect };
