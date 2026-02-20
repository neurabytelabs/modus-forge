/**
 * Recipe Engine — Composable multi-step generation workflows.
 * A recipe is a sequence of steps, each producing output that feeds the next.
 * 
 * Recipe format:
 * {
 *   name: "Landing Page Suite",
 *   description: "Generate hero, features, and pricing sections",
 *   steps: [
 *     { id: "hero", prompt: "Create a hero section for {{product}}", provider: "gemini" },
 *     { id: "features", prompt: "Create features section matching this hero: {{hero.output}}", provider: "claude" },
 *     { id: "pricing", prompt: "Create pricing that completes: {{hero.output}} + {{features.output}}", provider: "gemini" },
 *     { id: "combine", type: "merge", sources: ["hero", "features", "pricing"] }
 *   ],
 *   variables: { product: "AI Dashboard Builder" }
 * }
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const RECIPE_DIR = join(homedir(), '.modus-forge', 'recipes');

function ensureDir() {
  if (!existsSync(RECIPE_DIR)) mkdirSync(RECIPE_DIR, { recursive: true });
}

/**
 * Interpolate {{variable}} and {{stepId.output}} references in a string
 */
function interpolate(template, variables = {}, stepOutputs = {}) {
  return template.replace(/\{\{(\w+(?:\.\w+)?)\}\}/g, (match, key) => {
    if (key.includes('.')) {
      const [stepId, field] = key.split('.');
      if (stepOutputs[stepId] && field === 'output') {
        const out = stepOutputs[stepId];
        return out.length > 2000 ? out.slice(0, 2000) + '\n<!-- truncated -->' : out;
      }
    }
    return variables[key] ?? match;
  });
}

/**
 * Merge multiple step outputs into a single HTML page
 */
function mergeOutputs(sources, stepOutputs) {
  const sections = sources.map(id => {
    const output = stepOutputs[id] || '';
    const bodyMatch = output.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return bodyMatch ? bodyMatch[1] : output;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Forge Recipe Output</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body>
${sections.join('\n\n<!-- Section Divider -->\n\n')}
</body>
</html>`;
}

/**
 * Execute a recipe step-by-step
 * @param {object} recipe - The recipe definition
 * @param {function} generateFn - async (prompt, provider) => outputString
 * @param {function} onStep - optional callback (stepId, status, output) for progress
 */
export async function execute(recipe, generateFn, onStep = null) {
  const outputs = {};
  const timing = {};
  const variables = recipe.variables || {};

  for (const step of recipe.steps) {
    const start = Date.now();

    if (step.type === 'merge') {
      outputs[step.id] = mergeOutputs(step.sources || [], outputs);
      if (onStep) onStep(step.id, 'merged', outputs[step.id]);
    } else {
      const resolvedPrompt = interpolate(step.prompt, variables, outputs);
      if (onStep) onStep(step.id, 'generating', resolvedPrompt);

      try {
        const output = await generateFn(resolvedPrompt, step.provider || 'gemini');
        outputs[step.id] = output;
        if (onStep) onStep(step.id, 'complete', output);
      } catch (err) {
        outputs[step.id] = `<!-- Error in step ${step.id}: ${err.message} -->`;
        if (onStep) onStep(step.id, 'error', err.message);
      }
    }

    timing[step.id] = Date.now() - start;
  }

  const lastStep = recipe.steps[recipe.steps.length - 1];
  return {
    outputs,
    finalOutput: outputs[lastStep.id] || '',
    timing,
    totalMs: Object.values(timing).reduce((a, b) => a + b, 0),
  };
}

/**
 * Save a recipe to disk
 */
export function saveRecipe(recipe) {
  ensureDir();
  const id = recipe.id || `recipe_${Date.now().toString(36)}`;
  const full = { ...recipe, id, savedAt: new Date().toISOString() };
  writeFileSync(join(RECIPE_DIR, `${id}.json`), JSON.stringify(full, null, 2));
  return full;
}

/**
 * Load a recipe from disk
 */
export function loadRecipe(id) {
  const path = join(RECIPE_DIR, `${id}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

/**
 * List all saved recipes
 */
export function listRecipes() {
  ensureDir();
  try {
    const files = readdirSync(RECIPE_DIR).filter(f => f.endsWith('.json'));
    return files.map(f => {
      try {
        const data = JSON.parse(readFileSync(join(RECIPE_DIR, f), 'utf-8'));
        return { id: data.id, name: data.name, description: data.description, steps: data.steps?.length || 0, savedAt: data.savedAt };
      } catch { return null; }
    }).filter(Boolean);
  } catch { return []; }
}

/**
 * Built-in recipe templates
 */
export const BUILT_IN_RECIPES = {
  'landing-page': {
    name: 'Landing Page Suite',
    description: 'Hero + Features + CTA in one flow',
    steps: [
      { id: 'hero', prompt: 'Create a stunning hero section for: {{product}}. Dark theme, gradient accent, bold typography.', provider: 'gemini' },
      { id: 'features', prompt: 'Create a 3-column features grid that matches this hero style:\n{{hero.output}}\nProduct: {{product}}', provider: 'claude' },
      { id: 'cta', prompt: 'Create a compelling CTA/footer section matching:\n{{hero.output}}\nProduct: {{product}}', provider: 'gemini' },
      { id: 'page', type: 'merge', sources: ['hero', 'features', 'cta'] },
    ],
    variables: { product: 'Your Product' },
  },
  'dashboard-suite': {
    name: 'Dashboard Suite',
    description: 'Stats + Chart + Table in one dashboard',
    steps: [
      { id: 'stats', prompt: 'Create a stats card row (4 KPI cards) for: {{domain}}. Dark theme with purple/cyan accents.', provider: 'gemini' },
      { id: 'chart', prompt: 'Create a canvas chart section for {{domain}} that matches this style:\n{{stats.output}}', provider: 'gemini' },
      { id: 'table', prompt: 'Create a data table section for {{domain}} matching:\n{{stats.output}}', provider: 'claude' },
      { id: 'dashboard', type: 'merge', sources: ['stats', 'chart', 'table'] },
    ],
    variables: { domain: 'Analytics' },
  },
};

/**
 * Delete a recipe
 */
export function deleteRecipe(id) {
  const path = join(RECIPE_DIR, `${id}.json`);
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}
