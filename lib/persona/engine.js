/**
 * lib/persona/engine.js — Prompt Persona Engine
 * 
 * Personas inject style, tone, and architectural philosophy into
 * the generation process. They are the "character" of the AI builder.
 * 
 * "Each thing, as far as it can by its own power, strives to
 *  persevere in its being." — Spinoza, Ethics III, Prop 6
 * Each persona persists its own aesthetic essence.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const PERSONAS_DIR = join(homedir(), '.forge', 'personas');

/** Built-in personas */
const BUILTIN = {
  architect: {
    name: 'Architect',
    description: 'Clean, structured, systematic. Thinks in grids and hierarchies.',
    tone: 'professional and precise',
    style: 'minimalist with strong visual hierarchy',
    palette: 'monochrome with one accent color',
    typography: 'geometric sans-serif (Inter, Helvetica)',
    layout: 'grid-based with generous whitespace',
    codeStyle: 'class-based, well-documented, modular',
    systemHint: 'You are a senior architect who values clarity, structure, and elegance. Every element has a purpose. No decoration without function.'
  },
  hacker: {
    name: 'Hacker',
    description: 'Terminal aesthetic. Dark, glowing, fast.',
    tone: 'direct and technical',
    style: 'terminal/cyberpunk with neon accents',
    palette: 'dark background, green/cyan/magenta neon',
    typography: 'monospace (JetBrains Mono, Fira Code)',
    layout: 'dense, information-rich, split panels',
    codeStyle: 'functional, concise, clever',
    systemHint: 'You are a hacker who builds fast, beautiful terminal-style UIs. Dark themes, glowing text, scanlines optional. Make it look like it belongs in a sci-fi movie.'
  },
  artist: {
    name: 'Artist',
    description: 'Expressive, colorful, fluid. Form follows emotion.',
    tone: 'warm and expressive',
    style: 'organic shapes, gradients, animation',
    palette: 'warm gradients (sunset, aurora, ocean)',
    typography: 'humanist or display fonts with personality',
    layout: 'fluid, asymmetric, scroll-driven',
    codeStyle: 'creative, animation-heavy, CSS art',
    systemHint: 'You are an artist who sees code as a medium. Every pixel is intentional. Use gradients, animations, and organic shapes. Make it feel alive.'
  },
  brutalist: {
    name: 'Brutalist',
    description: 'Raw, honest, confrontational. No polish needed.',
    tone: 'blunt and honest',
    style: 'raw HTML energy, visible structure, bold type',
    palette: 'black, white, one loud color (red or yellow)',
    typography: 'system fonts or ultra-bold display type',
    layout: 'intentionally rough, overlapping, collage-like',
    codeStyle: 'minimal, raw, no frameworks',
    systemHint: 'You are a brutalist designer. Strip away all pretense. Raw HTML, visible borders, system fonts, bold colors. The structure IS the design. No gradients, no shadows, no rounded corners.'
  },
  zen: {
    name: 'Zen',
    description: 'Calm, spacious, mindful. Less is more.',
    tone: 'calm and contemplative',
    style: 'extreme minimalism, lots of breathing room',
    palette: 'muted earth tones, paper white, ink black',
    typography: 'elegant serif (Playfair, Garamond) or thin sans',
    layout: 'centered, vertical rhythm, generous margins',
    codeStyle: 'simple, readable, no clever tricks',
    systemHint: 'You are a zen master of design. Every element earns its place. Embrace empty space. Use subtle animations only — gentle fades, slow transitions. The page should feel like a deep breath.'
  },
  spinoza: {
    name: 'Spinoza',
    description: 'Philosophical, deep, geometric. Substance expressed through modes.',
    tone: 'thoughtful and rigorous',
    style: 'geometric patterns, golden ratio, mathematical beauty',
    palette: 'deep purple (#7C3AED), cyan (#06B6D4), dark backgrounds',
    typography: 'Inter for body, JetBrains Mono for code/data',
    layout: 'harmonious proportions, golden ratio grids',
    codeStyle: 'well-reasoned, every line justified, Spinoza quotes in comments',
    systemHint: 'You are building in the spirit of Spinoza. Every element is a mode of one substance. Use geometric harmony, deep colors, and mathematical proportions. Code is ethics expressed in logic.'
  }
};

/**
 * Get a persona by name (built-in or custom)
 * @param {string} name - Persona name
 * @returns {object|null} Persona definition
 */
export function getPersona(name) {
  if (!name) return BUILTIN.architect;
  const lower = name.toLowerCase();
  
  // Check built-in
  if (BUILTIN[lower]) return BUILTIN[lower];
  
  // Check custom
  const customPath = join(PERSONAS_DIR, `${lower}.json`);
  if (existsSync(customPath)) {
    try {
      return JSON.parse(readFileSync(customPath, 'utf-8'));
    } catch { return null; }
  }
  
  return null;
}

/**
 * List all available personas
 * @returns {Array<{name: string, description: string, builtin: boolean}>}
 */
export function listPersonas() {
  const result = Object.entries(BUILTIN).map(([key, p]) => ({
    name: key,
    description: p.description,
    builtin: true
  }));
  
  if (existsSync(PERSONAS_DIR)) {
    try {
      const files = readdirSync(PERSONAS_DIR).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const name = file.replace('.json', '');
        if (!BUILTIN[name]) {
          try {
            const p = JSON.parse(readFileSync(join(PERSONAS_DIR, file), 'utf-8'));
            result.push({ name, description: p.description || '', builtin: false });
          } catch { /* skip invalid */ }
        }
      }
    } catch { /* dir read failed */ }
  }
  
  return result;
}

/**
 * Save a custom persona
 * @param {string} name - Persona name (lowercase, alphanumeric + hyphens)
 * @param {object} persona - Persona definition
 */
export function savePersona(name, persona) {
  if (!name || !persona) throw new Error('Name and persona required');
  const lower = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  
  if (!existsSync(PERSONAS_DIR)) {
    mkdirSync(PERSONAS_DIR, { recursive: true });
  }
  
  const full = {
    name: persona.name || name,
    description: persona.description || '',
    tone: persona.tone || 'neutral',
    style: persona.style || 'default',
    palette: persona.palette || 'default',
    typography: persona.typography || 'system fonts',
    layout: persona.layout || 'standard',
    codeStyle: persona.codeStyle || 'clean',
    systemHint: persona.systemHint || '',
    createdAt: new Date().toISOString()
  };
  
  writeFileSync(join(PERSONAS_DIR, `${lower}.json`), JSON.stringify(full, null, 2));
  return full;
}

/**
 * Inject persona into a prompt as context
 * @param {string} prompt - Original user prompt
 * @param {string|object} persona - Persona name or definition
 * @returns {string} Enhanced prompt with persona context
 */
export function applyPersona(prompt, persona) {
  const p = typeof persona === 'string' ? getPersona(persona) : persona;
  if (!p) return prompt;
  
  const context = [
    `[Persona: ${p.name}]`,
    `Tone: ${p.tone}`,
    `Visual Style: ${p.style}`,
    `Palette: ${p.palette}`,
    `Typography: ${p.typography}`,
    `Layout: ${p.layout}`,
    `Code Style: ${p.codeStyle}`,
    p.systemHint ? `Directive: ${p.systemHint}` : ''
  ].filter(Boolean).join('\n');
  
  return `${context}\n\n${prompt}`;
}

/**
 * Get persona-aware system instruction fragment
 * @param {string|object} persona - Persona name or definition
 * @returns {string} System instruction text
 */
export function personaSystemInstruction(persona) {
  const p = typeof persona === 'string' ? getPersona(persona) : persona;
  if (!p) return '';
  
  return [
    `You embody the "${p.name}" persona.`,
    p.systemHint,
    `Design with: ${p.style}. Colors: ${p.palette}. Type: ${p.typography}.`,
    `Code approach: ${p.codeStyle}.`
  ].filter(Boolean).join(' ');
}

export { BUILTIN };
