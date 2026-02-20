/**
 * lib/themes/manager.js — Visual Theme Manager
 * 
 * Themes are CSS variable sets that can be injected into generated HTML.
 * They separate content generation from visual presentation.
 * 
 * "By reality and perfection I understand the same thing."
 * — Spinoza, Ethics II, Def 6
 */

const THEMES = {
  cyberpunk: {
    name: 'Cyberpunk',
    description: 'Neon on dark. Terminal meets Tokyo nightlife.',
    vars: {
      '--bg': '#0a0a0f',
      '--surface': '#12121a',
      '--surface-2': '#1a1a2e',
      '--border': '#2a2a3e',
      '--text': '#e0e0e0',
      '--text-muted': '#888',
      '--accent': '#06b6d4',
      '--accent-2': '#7c3aed',
      '--success': '#10b981',
      '--warning': '#f59e0b',
      '--error': '#ef4444',
      '--font-body': "'Inter', system-ui, sans-serif",
      '--font-mono': "'JetBrains Mono', 'Fira Code', monospace",
      '--font-display': "'Inter', system-ui, sans-serif",
      '--radius': '8px',
      '--shadow': '0 4px 24px rgba(6, 182, 212, 0.1)',
      '--glow': '0 0 20px rgba(6, 182, 212, 0.3)'
    }
  },
  
  paper: {
    name: 'Paper',
    description: 'Clean, warm, readable. Like a well-printed book.',
    vars: {
      '--bg': '#faf8f5',
      '--surface': '#ffffff',
      '--surface-2': '#f5f2ed',
      '--border': '#e0dcd4',
      '--text': '#2c2c2c',
      '--text-muted': '#6b6b6b',
      '--accent': '#c0392b',
      '--accent-2': '#2c3e50',
      '--success': '#27ae60',
      '--warning': '#f39c12',
      '--error': '#e74c3c',
      '--font-body': "'Georgia', 'Times New Roman', serif",
      '--font-mono': "'Courier New', monospace",
      '--font-display': "'Playfair Display', Georgia, serif",
      '--radius': '2px',
      '--shadow': '0 1px 3px rgba(0,0,0,0.08)',
      '--glow': 'none'
    }
  },
  
  forest: {
    name: 'Forest',
    description: 'Deep greens and earth tones. Calm and grounded.',
    vars: {
      '--bg': '#1a2318',
      '--surface': '#222d20',
      '--surface-2': '#2a3828',
      '--border': '#3a4a38',
      '--text': '#d4ddd2',
      '--text-muted': '#8a9a88',
      '--accent': '#4ade80',
      '--accent-2': '#a3e635',
      '--success': '#4ade80',
      '--warning': '#fbbf24',
      '--error': '#f87171',
      '--font-body': "'Inter', system-ui, sans-serif",
      '--font-mono': "'Fira Code', monospace",
      '--font-display': "'Inter', system-ui, sans-serif",
      '--radius': '6px',
      '--shadow': '0 4px 16px rgba(74, 222, 128, 0.08)',
      '--glow': '0 0 12px rgba(74, 222, 128, 0.15)'
    }
  },
  
  sunset: {
    name: 'Sunset',
    description: 'Warm gradients. Golden hour energy.',
    vars: {
      '--bg': '#1a1014',
      '--surface': '#221820',
      '--surface-2': '#2e1e28',
      '--border': '#4a3040',
      '--text': '#f0e0e8',
      '--text-muted': '#b090a0',
      '--accent': '#f97316',
      '--accent-2': '#ec4899',
      '--success': '#34d399',
      '--warning': '#fbbf24',
      '--error': '#f87171',
      '--font-body': "'Inter', system-ui, sans-serif",
      '--font-mono': "'JetBrains Mono', monospace",
      '--font-display': "'Inter', system-ui, sans-serif",
      '--radius': '12px',
      '--shadow': '0 8px 32px rgba(249, 115, 22, 0.12)',
      '--glow': '0 0 24px rgba(236, 72, 153, 0.2)'
    }
  },
  
  arctic: {
    name: 'Arctic',
    description: 'Ice blue on white. Clean and crisp.',
    vars: {
      '--bg': '#f0f4f8',
      '--surface': '#ffffff',
      '--surface-2': '#e8eef4',
      '--border': '#d0d8e0',
      '--text': '#1e293b',
      '--text-muted': '#64748b',
      '--accent': '#3b82f6',
      '--accent-2': '#06b6d4',
      '--success': '#22c55e',
      '--warning': '#eab308',
      '--error': '#ef4444',
      '--font-body': "'Inter', system-ui, sans-serif",
      '--font-mono': "'SF Mono', 'Fira Code', monospace",
      '--font-display': "'Inter', system-ui, sans-serif",
      '--radius': '8px',
      '--shadow': '0 2px 12px rgba(59, 130, 246, 0.08)',
      '--glow': 'none'
    }
  },
  
  noir: {
    name: 'Noir',
    description: 'Pure black and white. Maximum contrast.',
    vars: {
      '--bg': '#000000',
      '--surface': '#0a0a0a',
      '--surface-2': '#141414',
      '--border': '#2a2a2a',
      '--text': '#ffffff',
      '--text-muted': '#888888',
      '--accent': '#ffffff',
      '--accent-2': '#cccccc',
      '--success': '#00ff00',
      '--warning': '#ffff00',
      '--error': '#ff0000',
      '--font-body': "'Helvetica Neue', Arial, sans-serif",
      '--font-mono': "'SF Mono', 'Monaco', monospace",
      '--font-display': "'Helvetica Neue', Arial, sans-serif",
      '--radius': '0px',
      '--shadow': 'none',
      '--glow': 'none'
    }
  }
};

/**
 * Get a theme by name
 * @param {string} name - Theme name
 * @returns {object|null}
 */
export function getTheme(name) {
  return THEMES[name?.toLowerCase()] || null;
}

/**
 * List all available themes
 * @returns {Array<{name: string, key: string, description: string}>}
 */
export function listThemes() {
  return Object.entries(THEMES).map(([key, t]) => ({
    key,
    name: t.name,
    description: t.description
  }));
}

/**
 * Generate CSS custom properties block from a theme
 * @param {string|object} theme - Theme name or vars object
 * @returns {string} CSS :root block
 */
export function themeToCSS(theme) {
  const t = typeof theme === 'string' ? getTheme(theme) : theme;
  if (!t) return '';
  
  const vars = t.vars || t;
  const lines = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  
  return `:root {\n${lines}\n}`;
}

/**
 * Inject theme CSS into an HTML string
 * Adds/replaces :root vars in existing <style> or adds new <style> in <head>
 * @param {string} html - HTML content
 * @param {string} themeName - Theme name
 * @returns {string} HTML with theme applied
 */
export function applyTheme(html, themeName) {
  const css = themeToCSS(themeName);
  if (!css) return html;
  
  const styleBlock = `<style id="forge-theme">\n${css}\n</style>`;
  
  // Replace existing forge-theme
  if (html.includes('id="forge-theme"')) {
    return html.replace(/<style id="forge-theme">[\s\S]*?<\/style>/, styleBlock);
  }
  
  // Insert before </head> or at start
  if (html.includes('</head>')) {
    return html.replace('</head>', `${styleBlock}\n</head>`);
  }
  
  return `${styleBlock}\n${html}`;
}

/**
 * Create a custom theme from partial vars (extends cyberpunk defaults)
 * @param {string} name - Theme name
 * @param {object} vars - CSS variable overrides
 * @param {string} [description] - Theme description
 * @returns {object} Complete theme object
 */
export function createTheme(name, vars, description = '') {
  return {
    name,
    description,
    vars: { ...THEMES.cyberpunk.vars, ...vars }
  };
}

/**
 * Get theme suggestion based on time of day
 * @param {number} [hour] - Hour (0-23), defaults to current
 * @returns {string} Theme name
 */
export function suggestTheme(hour = new Date().getHours()) {
  if (hour >= 6 && hour < 10) return 'paper';      // Morning: warm, readable
  if (hour >= 10 && hour < 16) return 'arctic';     // Midday: bright, crisp
  if (hour >= 16 && hour < 19) return 'sunset';     // Late afternoon: warm glow
  if (hour >= 19 && hour < 22) return 'cyberpunk';  // Evening: dark, neon
  return 'noir';                                      // Night: pure dark
}

export { THEMES };
