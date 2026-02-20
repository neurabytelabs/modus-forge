/**
 * Gallery — Browse and curate Forge creations.
 * 
 * IT-16: A local gallery that serves spell packs as a beautiful
 * browseable web page. Each creation is a card with preview,
 * scores, prompt, and remix button.
 * 
 * "Beauty is not a quality in things themselves; it exists merely
 *  in the mind which contemplates them." — But Spinoza would add:
 *  beauty IS the adequate idea expressing itself. Display it.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { importSpell, spellToText } from './share.js';

/**
 * Scan a directory for spell packs
 */
export function scanSpells(dir) {
  if (!existsSync(dir)) return [];
  
  return readdirSync(dir)
    .filter(f => f.endsWith('.spell.json'))
    .map(f => {
      try {
        return { file: f, ...importSpell(join(dir, f)) };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (b.created || '').localeCompare(a.created || ''));
}

/**
 * Generate a gallery HTML page from spell packs
 */
export function renderGallery(spells, opts = {}) {
  const title = opts.title || 'Forge Gallery';
  
  const cards = spells.map((s, i) => {
    const total = s.scores?.total ?? s.scores?.spinozaTotal ?? '?';
    const tags = (s.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
    
    return `
    <div class="card" data-index="${i}">
      <div class="card-header">
        <span class="card-score">${total}/40</span>
        <span class="card-provider">${s.config?.provider || '?'}</span>
      </div>
      <h3 class="card-prompt">${escapeHtml(s.prompt || 'Untitled')}</h3>
      <div class="card-meta">
        <span>${s.created?.split('T')[0] || ''}</span>
        <span>${s.author || 'anonymous'}</span>
      </div>
      ${tags ? `<div class="card-tags">${tags}</div>` : ''}
      ${s.notes ? `<p class="card-notes">${escapeHtml(s.notes)}</p>` : ''}
      <div class="card-scores">
        <span title="Conatus">C:${s.scores?.conatus ?? '?'}</span>
        <span title="Ratio">R:${s.scores?.ratio ?? '?'}</span>
        <span title="Laetitia">L:${s.scores?.laetitia ?? '?'}</span>
        <span title="Natura">N:${s.scores?.natura ?? '?'}</span>
      </div>
    </div>`;
  }).join('\n');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root { --bg: #0a0a0f; --surface: #12121a; --border: #1e1e2e; --text: #e0e0e0; --dim: #888; --purple: #7C3AED; --cyan: #06B6D4; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', system-ui, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; padding: 2rem; }
  h1 { font-size: 2rem; margin-bottom: 0.5rem; background: linear-gradient(135deg, var(--purple), var(--cyan)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .subtitle { color: var(--dim); margin-bottom: 2rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; transition: border-color 0.2s; }
  .card:hover { border-color: var(--purple); }
  .card-header { display: flex; justify-content: space-between; margin-bottom: 0.75rem; }
  .card-score { font-size: 1.25rem; font-weight: 700; color: var(--cyan); }
  .card-provider { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--dim); padding: 2px 8px; background: var(--border); border-radius: 4px; }
  .card-prompt { font-size: 1rem; margin-bottom: 0.75rem; line-height: 1.4; }
  .card-meta { font-size: 0.8rem; color: var(--dim); display: flex; gap: 1rem; margin-bottom: 0.5rem; }
  .card-tags { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
  .tag { font-size: 0.75rem; padding: 2px 8px; background: rgba(124, 58, 237, 0.15); color: var(--purple); border-radius: 4px; }
  .card-notes { font-size: 0.85rem; color: var(--dim); font-style: italic; margin-bottom: 0.5rem; }
  .card-scores { display: flex; gap: 1rem; font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--dim); }
  .empty { text-align: center; padding: 4rem 2rem; color: var(--dim); }
</style>
</head>
<body>
  <h1>🔮 ${title}</h1>
  <p class="subtitle">${spells.length} spell${spells.length !== 1 ? 's' : ''} in collection</p>
  ${spells.length ? `<div class="grid">${cards}</div>` : '<div class="empty"><p>No spells yet. Create your first with <code>forge "your idea"</code></p></div>'}
</body>
</html>`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
