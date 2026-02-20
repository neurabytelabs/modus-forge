/**
 * Security Sanitizer — Input/output sanitization for generated code.
 * Prevents XSS, script injection, and unsafe patterns in LLM outputs.
 * 
 * @module security/sanitizer
 * @since IT-18
 */

// Patterns that should never appear in generated HTML/JS
const DANGEROUS_PATTERNS = [
  { pattern: /on\w+\s*=\s*["'][^"']*eval\s*\(/gi, name: 'eval-in-handler', severity: 'high' },
  { pattern: /javascript\s*:/gi, name: 'javascript-uri', severity: 'high' },
  { pattern: /document\.cookie/gi, name: 'cookie-access', severity: 'high' },
  { pattern: /window\.location\s*=(?!=)/gi, name: 'redirect', severity: 'medium' },
  { pattern: /fetch\s*\(\s*['"`]https?:\/\/(?!api\.(openai|anthropic|x\.ai|generativelanguage))/gi, name: 'external-fetch', severity: 'low' },
  { pattern: /new\s+Function\s*\(/gi, name: 'dynamic-function', severity: 'high' },
  { pattern: /innerHTML\s*=\s*[^;]*\+/gi, name: 'innerHTML-concat', severity: 'medium' },
  { pattern: /<iframe[^>]*src\s*=/gi, name: 'iframe-injection', severity: 'high' },
  { pattern: /\bexec\s*\(/gi, name: 'exec-call', severity: 'medium' },
  { pattern: /require\s*\(\s*['"]child_process['"]\)/gi, name: 'child-process', severity: 'critical' },
  { pattern: /process\.env/gi, name: 'env-access', severity: 'medium' },
];

/**
 * Scan code for dangerous patterns.
 * @param {string} code - Code to scan
 * @returns {{ safe: boolean, issues: Array<{ name, severity, match, line }> }}
 */
function scan(code) {
  const issues = [];
  const lines = code.split('\n');
  
  for (const { pattern, name, severity } of DANGEROUS_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(code)) !== null) {
      // Find line number
      const beforeMatch = code.substring(0, match.index);
      const lineNum = beforeMatch.split('\n').length;
      issues.push({
        name,
        severity,
        match: match[0].substring(0, 60),
        line: lineNum
      });
    }
  }

  return {
    safe: issues.filter(i => i.severity === 'high' || i.severity === 'critical').length === 0,
    issues: issues.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.severity] || 9) - (order[b.severity] || 9);
    })
  };
}

/**
 * Sanitize HTML output — escape dangerous patterns while preserving structure.
 * @param {string} html - Generated HTML
 * @param {object} [options]
 * @param {boolean} [options.allowInlineStyles=true]
 * @param {boolean} [options.allowScripts=true] - Allow <script> tags (needed for generated apps)
 * @param {boolean} [options.stripDangerous=false] - Remove dangerous patterns instead of just flagging
 * @returns {{ html: string, removed: string[] }}
 */
function sanitize(html, options = {}) {
  const { allowInlineStyles = true, allowScripts = true, stripDangerous = false } = options;
  const removed = [];
  let output = html;

  if (stripDangerous) {
    // Remove javascript: URIs
    output = output.replace(/javascript\s*:[^"')\s]*/gi, (m) => {
      removed.push(`javascript-uri: ${m.substring(0, 40)}`);
      return '#';
    });

    // Remove eval in event handlers
    output = output.replace(/on\w+\s*=\s*["'][^"']*eval\s*\([^)]*\)[^"']*["']/gi, (m) => {
      removed.push(`eval-handler: ${m.substring(0, 40)}`);
      return '';
    });

    // Remove iframes
    output = output.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, (m) => {
      removed.push(`iframe: ${m.substring(0, 40)}`);
      return '<!-- iframe removed -->';
    });
  }

  if (!allowScripts) {
    output = output.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, (m) => {
      removed.push(`script: ${m.substring(0, 40)}`);
      return '<!-- script removed -->';
    });
  }

  if (!allowInlineStyles) {
    output = output.replace(/\sstyle\s*=\s*["'][^"']*["']/gi, (m) => {
      removed.push(`inline-style: ${m.substring(0, 40)}`);
      return '';
    });
  }

  return { html: output, removed };
}

/**
 * Generate a security report for a piece of code.
 * @param {string} code
 * @returns {string} Human-readable report
 */
function report(code) {
  const { safe, issues } = scan(code);
  if (issues.length === 0) return '✅ No security issues detected.';
  
  const lines = [
    safe ? '⚠️ Minor issues detected:' : '🚨 Security issues found:',
    ''
  ];
  for (const issue of issues) {
    const icon = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' }[issue.severity] || '⚪';
    lines.push(`  ${icon} [${issue.severity.toUpperCase()}] ${issue.name} (line ${issue.line}): ${issue.match}`);
  }
  return lines.join('\n');
}

export { scan, sanitize, report, DANGEROUS_PATTERNS };
