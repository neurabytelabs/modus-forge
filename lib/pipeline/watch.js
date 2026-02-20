/**
 * Watch Mode — Auto-regenerate on file changes.
 * 
 * IT-21: Watches prompt files or directories and triggers pipeline
 * regeneration when changes are detected. Uses SSE to push live updates.
 * 
 * Usage:
 *   forge watch prompt.txt --model gemini
 *   forge watch prompts/ --model claude
 * 
 * @module pipeline/watch
 */

import { watch, readFileSync, existsSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { createChannel, createSSEServer } from '../sse/server.js';
import { enhance } from '../rune/enhancer.js';
import { validate } from '../rune/validator.js';
import { buildSystemInstruction } from '../rune/system-instruction.js';

/**
 * Debounce utility — avoids triggering on every keystroke.
 */
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Start watch mode on a file or directory.
 * @param {string} target - File or directory to watch
 * @param {object} opts
 * @param {string} [opts.model='gemini'] - LLM model
 * @param {number} [opts.port=3457] - Dashboard port
 * @param {boolean} [opts.open=true] - Open browser
 * @param {function} [opts.generate] - Custom generation function (prompt, model) → html
 * @param {number} [opts.debounceMs=500] - Debounce interval
 * @returns {Promise<{close: function, url: string}>}
 */
export async function watchMode(target, opts = {}) {
  const {
    model = 'gemini',
    port = 3457,
    open = true,
    generate,
    debounceMs = 500,
  } = opts;

  if (!existsSync(target)) {
    throw new Error(`Watch target not found: ${target}`);
  }

  const isDir = statSync(target).isDirectory();
  const channel = createChannel({ heartbeatMs: 15000 });
  let iteration = 0;
  let lastHtml = '';
  let generating = false;

  const DASHBOARD_HTML = buildDashboard(target, model);

  // SSE server
  const { url, close: closeServer } = await createSSEServer({
    '/': { html: DASHBOARD_HTML },
    '/events': { channel },
    '/latest': {
      html: () => lastHtml || '<html><body><h1>Waiting for first generation...</h1></body></html>',
    },
  }, port);

  console.log(`👁️  Watch mode: ${url}`);
  console.log(`   Watching: ${target}`);
  console.log(`   Model: ${model}`);

  if (open) {
    import('node:child_process').then(({ execSync }) => {
      try { execSync(`open ${url}`); } catch { /* */ }
    });
  }

  // Generation function
  async function regenerate(filePath) {
    if (generating) return;
    generating = true;
    iteration++;

    const promptText = readFileSync(filePath, 'utf-8').trim();
    if (!promptText) { generating = false; return; }

    channel.broadcast({
      type: 'status',
      iteration,
      file: basename(filePath),
      status: 'generating',
      timestamp: Date.now(),
    });

    const startTime = Date.now();

    try {
      let html;
      if (generate) {
        html = await generate(promptText, model);
      } else {
        // Default: enhance + generate via router
        const enhanced = enhance(promptText);
        const sysInstruction = buildSystemInstruction({ model, features: ['responsive', 'animated'] });

        // Dynamic import to avoid circular deps
        const { detectProvider, callProvider } = await import('../generators/router.js');
        const provider = detectProvider(model);
        html = await callProvider(provider, model, enhanced, sysInstruction);
      }

      const elapsed = Date.now() - startTime;
      const validation = validate(html);
      lastHtml = html;

      channel.broadcast({
        type: 'result',
        iteration,
        file: basename(filePath),
        status: 'done',
        elapsed,
        chars: html.length,
        score: validation.total ?? (
          (validation.conatus + validation.ratio + validation.laetitia + validation.natura) / 4
        ),
        validation,
        timestamp: Date.now(),
      });

      console.log(`✅ IT-${iteration} | ${basename(filePath)} | ${elapsed}ms | score: ${((validation.total ?? ((validation.conatus + validation.ratio + validation.laetitia + validation.natura) / 4)) * 100).toFixed(0)}%`);
    } catch (err) {
      channel.broadcast({
        type: 'error',
        iteration,
        file: basename(filePath),
        error: err.message,
        timestamp: Date.now(),
      });
      console.error(`❌ IT-${iteration} | ${err.message}`);
    }

    generating = false;
  }

  const debouncedRegen = debounce(regenerate, debounceMs);

  // File watcher
  const watcher = watch(target, { recursive: isDir }, (eventType, filename) => {
    if (!filename || !filename.endsWith('.txt') && !filename.endsWith('.md')) return;
    const filePath = isDir ? join(target, filename) : target;
    if (!existsSync(filePath)) return;
    console.log(`📝 Changed: ${filename}`);
    debouncedRegen(filePath);
  });

  // Initial generation
  if (!isDir) {
    regenerate(target);
  }

  return {
    url,
    close() {
      watcher.close();
      closeServer();
    },
  };
}

/**
 * Build the watch mode dashboard HTML.
 */
function buildDashboard(target, model) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>MODUS Forge — Watch Mode</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'JetBrains Mono', monospace; background: #0a0a0a; color: #e0e0e0; height: 100vh; display: flex; flex-direction: column; }
  #header {
    padding: 10px 20px;
    background: #111;
    border-bottom: 1px solid #222;
    display: flex; justify-content: space-between; align-items: center;
    flex-shrink: 0;
  }
  #header h1 { font-size: 13px; color: #7C3AED; }
  #meta { font-size: 11px; color: #666; }
  #meta span { color: #06B6D4; margin-left: 10px; }
  #log {
    padding: 8px 20px;
    background: #080808;
    border-bottom: 1px solid #1a1a1a;
    font-size: 11px;
    max-height: 120px;
    overflow-y: auto;
    flex-shrink: 0;
  }
  .log-entry { padding: 2px 0; border-bottom: 1px solid #111; }
  .log-entry.error { color: #ef4444; }
  .log-entry.done { color: #06B6D4; }
  .log-entry.generating { color: #7C3AED; }
  #preview { flex: 1; border: none; width: 100%; background: white; }
  .score { display: inline-block; padding: 1px 6px; border-radius: 3px; font-weight: bold; }
  .score.high { background: #06B6D420; color: #06B6D4; }
  .score.mid { background: #f59e0b20; color: #f59e0b; }
  .score.low { background: #ef444420; color: #ef4444; }
</style>
</head>
<body>
<div id="header">
  <h1>👁️ MODUS Forge — Watch Mode</h1>
  <div id="meta">
    <span>📁 ${basename(target)}</span>
    <span>🤖 ${model}</span>
    <span id="iteration">IT-0</span>
    <span id="status">⏸ waiting</span>
  </div>
</div>
<div id="log"></div>
<iframe id="preview" src="/latest"></iframe>
<script>
  const log = document.getElementById('log');
  const iterEl = document.getElementById('iteration');
  const statusEl = document.getElementById('status');
  const preview = document.getElementById('preview');

  const src = new EventSource('/events');
  src.onmessage = (e) => {
    const d = JSON.parse(e.data);
    iterEl.textContent = 'IT-' + d.iteration;

    if (d.type === 'status') {
      statusEl.textContent = '⏳ generating...';
      addLog('generating', '⏳ IT-' + d.iteration + ' | ' + d.file + ' | generating...');
    }
    if (d.type === 'result') {
      statusEl.textContent = '✅ done';
      const pct = (d.score * 100).toFixed(0);
      const cls = d.score > 0.7 ? 'high' : d.score > 0.4 ? 'mid' : 'low';
      addLog('done', '✅ IT-' + d.iteration + ' | ' + d.elapsed + 'ms | <span class="score ' + cls + '">' + pct + '%</span>');
      preview.src = '/latest?' + Date.now();
    }
    if (d.type === 'error') {
      statusEl.textContent = '❌ error';
      addLog('error', '❌ IT-' + d.iteration + ' | ' + d.error);
    }
  };

  function addLog(cls, html) {
    const el = document.createElement('div');
    el.className = 'log-entry ' + cls;
    el.innerHTML = new Date().toLocaleTimeString() + ' ' + html;
    log.prepend(el);
    if (log.children.length > 50) log.lastChild.remove();
  }
</script>
</body>
</html>`;
}
