/**
 * RUNE Enhancer — 8-layer prompt enhancement for MODUS Forge
 * Transforms a raw user intent into a rich, structured LLM prompt.
 */

const STYLES = {
  cyberpunk: {
    palette: ['#0ff', '#f0f', '#ff0', '#0f0', '#1a1a2e'],
    font: 'JetBrains Mono, monospace',
    vibe: 'neon glow, dark background, terminal aesthetic, scanlines',
  },
  minimal: {
    palette: ['#111', '#fff', '#666', '#ddd', '#f5f5f5'],
    font: 'Inter, system-ui, sans-serif',
    vibe: 'clean whitespace, subtle shadows, light mode, elegant',
  },
  terminal: {
    palette: ['#0f0', '#000', '#333', '#0a0', '#001100'],
    font: 'IBM Plex Mono, monospace',
    vibe: 'green-on-black, retro CRT, phosphor glow, ASCII art',
  },
};

/**
 * Enhance a raw user intent through RUNE's 8 layers.
 * @param {string} intent - Raw user sentence
 * @param {object} opts - { style, lang }
 * @returns {string} Enhanced prompt for LLM
 */
export function enhance(intent, opts = {}) {
  const style = STYLES[opts.style] || STYLES.cyberpunk;
  const lang = opts.lang || 'en';

  const prompt = `You are an expert frontend developer and designer.
Generate a SINGLE, COMPLETE, self-contained HTML file that works as a fully functional web app.

## USER INTENT
"${intent}"

## REQUIREMENTS (L0: Principal Engineer)
- Single HTML file with embedded CSS and JavaScript
- NO external dependencies (no CDN links, no frameworks)
- Must work offline when opened in a browser
- All data stored in localStorage for persistence
- Responsive design (mobile + desktop)

## CONTEXT (L1)
- Language: ${lang}
- This is a personal productivity/tracking tool
- User expects it to work immediately upon opening

## INTENT ANALYSIS (L2)
Interpret the user's intent generously. If they say "track cardio", build a full tracker with:
- Input forms for logging data
- Visual charts/graphs (canvas-based)
- History view
- Statistics/summaries
- Export capability

## SAFETY (L3)
- Sanitize all user inputs
- Use localStorage safely (try/catch)
- Graceful degradation if features unavailable

## ARCHITECTURE (L4)
Structure the app as:
1. HTML structure with semantic elements
2. CSS in a <style> block — use CSS custom properties for theming
3. JavaScript in a <script type="module"> block
4. Use class-based or module pattern for organization
5. Event delegation where appropriate

## VISUAL DESIGN (L5)
Style: ${style.vibe}
Color palette: ${style.palette.join(', ')}
Font: ${style.font}
- Smooth transitions and micro-interactions
- Consistent spacing (8px grid)
- Clear visual hierarchy

## VALIDATION (L6 — Spinoza)
Before outputting, verify:
- Conatus: Does it actively help the user? Is it functional?
- Ratio: Is the logic sound? No dead code?
- Laetitia: Is it beautiful? Does using it spark joy?
- Natura: Does it feel natural and intuitive?

## OUTPUT FORMAT (L7)
Return ONLY the complete HTML file content.
No markdown fences. No explanation. Just the HTML.
Start with <!DOCTYPE html> and end with </html>.`;

  return prompt;
}
