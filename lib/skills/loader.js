/**
 * Skill Loader — IT-15 Reflection Sprint
 * 
 * Dynamically discovers and loads skills from the skills/ directory.
 * Each skill exports: { name, emoji, description, context(opts) }
 * context() returns a string to inject into L1 sensor context.
 */

import { readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, '..', '..', 'skills');

// Cache loaded skills
const _cache = new Map();

/**
 * List all installed skills by scanning skills/ subdirectories
 */
export async function listSkills() {
  if (!existsSync(SKILLS_DIR)) return [];
  
  const skills = [];
  const categories = readdirSync(SKILLS_DIR).filter(d => 
    statSync(join(SKILLS_DIR, d)).isDirectory()
  );
  
  for (const cat of categories) {
    const catDir = join(SKILLS_DIR, cat);
    const files = readdirSync(catDir).filter(f => f.endsWith('.js'));
    
    for (const file of files) {
      try {
        const mod = await loadSkillModule(join(catDir, file));
        skills.push({
          category: cat,
          file,
          name: mod.name || file.replace('.js', ''),
          emoji: mod.emoji || '📦',
          description: mod.description || 'No description',
          hasContext: typeof mod.context === 'function',
          hasRun: typeof mod.run === 'function',
        });
      } catch {
        skills.push({
          category: cat,
          file,
          name: file.replace('.js', ''),
          emoji: '⚠️',
          description: 'Failed to load',
          hasContext: false,
          hasRun: false,
        });
      }
    }
  }
  
  return skills;
}

/**
 * Load a skill module (cached)
 */
async function loadSkillModule(path) {
  if (_cache.has(path)) return _cache.get(path);
  const mod = await import(path);
  _cache.set(path, mod);
  return mod;
}

/**
 * Get context strings from all skills that provide context()
 * Used by sensors.js to enrich L1 context
 */
export async function gatherSkillContexts(opts = {}) {
  const skills = await listSkills();
  const contexts = [];
  
  for (const skill of skills) {
    if (!skill.hasContext) continue;
    try {
      const mod = await loadSkillModule(join(SKILLS_DIR, skill.category, skill.file));
      const ctx = await mod.context(opts);
      if (ctx) contexts.push({ skill: skill.name, context: ctx });
    } catch {
      // Skill context failed — graceful skip
    }
  }
  
  return contexts;
}

/**
 * Run a skill by name
 */
export async function runSkill(name, args = []) {
  const skills = await listSkills();
  const skill = skills.find(s => s.name === name || s.file === `${name}.js`);
  
  if (!skill) return `❌ Skill "${name}" not found. Run 'forge skills list' to see available skills.`;
  if (!skill.hasRun) return `❌ Skill "${name}" has no run() function.`;
  
  const mod = await loadSkillModule(join(SKILLS_DIR, skill.category, skill.file));
  return await mod.run(args);
}

/**
 * Get skill count (cheap, no module loading)
 */
export function skillCount() {
  if (!existsSync(SKILLS_DIR)) return 0;
  let count = 0;
  try {
    const categories = readdirSync(SKILLS_DIR).filter(d => 
      statSync(join(SKILLS_DIR, d)).isDirectory()
    );
    for (const cat of categories) {
      count += readdirSync(join(SKILLS_DIR, cat)).filter(f => f.endsWith('.js')).length;
    }
  } catch { /* */ }
  return count;
}
