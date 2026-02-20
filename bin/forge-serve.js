#!/usr/bin/env node
/**
 * forge-serve — Local dev server for MODUS Forge outputs.
 * 
 * Serves generated HTML files with live-reload via SSE.
 * Zero dependencies — pure Node.js http + fs.watch.
 * 
 * Usage:
 *   node bin/forge-serve.js [port] [dir]
 *   node bin/forge-serve.js 3456 output/
 * 
 * Philosophy: "The mind's highest good is the knowledge of God."
 * But the developer's highest good is instant feedback. — Forge Corollary
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync, readdirSync, watch, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { list } from '../lib/persistence/history.js';

const PORT = parseInt(process.argv[2]) || 3456;
const SERVE_DIR = resolve(process.argv[3] || 'output');

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// SSE clients for live reload
const sseClients = new Set();

// Watch output directory for changes
if (existsSync(SERVE_DIR)) {
  try {
    watch(SERVE_DIR, { recursive: true }, () => {
      for (const client of sseClients) {
        client.write('data: reload\n\n');
      }
    });
  } catch {
    // fs.watch not available on all platforms
  }
}

/** Live-reload script injected into HTML responses */
const RELOAD_SCRIPT = `
<script>
(function() {
  const es = new EventSource('/__sse');
  es.onmessage = () => location.reload();
  es.onerror = () => setTimeout(() => location.reload(), 2000);
})();
</script>`;

/** Generate index page listing all output files + history */
function indexPage() {
  const files = existsSync(SERVE_DIR)
    ? readdirSync(SERVE_DIR).filter(f => f.endsWith('.html')).sort().reverse()
    : [];

  let recent = [];
  try { recent = list({ limit: 10 }); } catch { /* history not available */ }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>🔥 MODUS Forge — Local Server</title>
<style>
  :root { --bg: #0a0a0f; --fg: #e0e0e0; --accent: #7c3aed; --card: #13131a; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: var(--bg); color: var(--fg); font-family: 'Inter', system-ui, sans-serif; padding: 2rem; }
  h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
  .subtitle { color: #888; margin-bottom: 2rem; font-size: 0.9rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
  .card { background: var(--card); border: 1px solid #222; border-radius: 12px; padding: 1.2rem; transition: border-color 0.2s; }
  .card:hover { border-color: var(--accent); }
  .card a { color: var(--accent); text-decoration: none; font-weight: 600; font-size: 1.1rem; }
  .card a:hover { text-decoration: underline; }
  .meta { color: #666; font-size: 0.8rem; margin-top: 0.5rem; }
  .score { display: inline-flex; gap: 0.5rem; margin-top: 0.5rem; }
  .score span { background: #1a1a2e; padding: 2px 8px; border-radius: 6px; font-size: 0.75rem; font-family: monospace; }
  .grade { font-size: 1.2rem; font-weight: bold; float: right; }
  .grade-S { color: #ffd700; } .grade-A { color: #7c3aed; } .grade-B { color: #06b6d4; }
  .grade-C { color: #888; } .grade-D { color: #f44; }
  section { margin-bottom: 2rem; }
  h2 { font-size: 1.2rem; margin-bottom: 1rem; color: #aaa; border-bottom: 1px solid #222; padding-bottom: 0.5rem; }
</style>
</head>
<body>
<h1>🔥 MODUS Forge</h1>
<p class="subtitle">Speak it. See it. Use it.</p>

<section>
<h2>📂 Output Files (${files.length})</h2>
<div class="grid">
${files.map(f => `<div class="card"><a href="/${f}">${f}</a></div>`).join('\n')}
${files.length === 0 ? '<p style="color:#666">No files yet. Run <code>node bin/forge.js "your idea"</code> to generate.</p>' : ''}
</div>
</section>

<section>
<h2>📜 Recent History</h2>
<div class="grid">
${recent.map(h => `
<div class="card">
  <span class="grade grade-${h.grade}">${h.grade}</span>
  <a href="#">${h.prompt?.slice(0, 60) || 'untitled'}${(h.prompt?.length || 0) > 60 ? '…' : ''}</a>
  <div class="score">
    <span>C:${h.score?.conatus ?? '?'}</span>
    <span>R:${h.score?.ratio ?? '?'}</span>
    <span>L:${h.score?.laetitia ?? '?'}</span>
    <span>N:${h.score?.natura ?? '?'}</span>
  </div>
  <div class="meta">${h.provider} · ${h.model?.split('/').pop() || '?'} · ${new Date(h.timestamp).toLocaleString()}</div>
</div>`).join('\n')}
${recent.length === 0 ? '<p style="color:#666">No generation history yet.</p>' : ''}
</div>
</section>

${RELOAD_SCRIPT}
</body></html>`;
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // SSE endpoint for live reload
  if (url.pathname === '/__sse') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // Index page
  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(indexPage());
    return;
  }

  // Serve static files from output dir
  const filePath = join(SERVE_DIR, url.pathname.slice(1));
  if (!filePath.startsWith(SERVE_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<h1>404</h1><p><a href="/">← Back to index</a></p>');
    return;
  }

  const ext = extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  let content = readFileSync(filePath);

  // Inject live-reload into HTML files
  if (ext === '.html') {
    content = content.toString().replace('</body>', `${RELOAD_SCRIPT}\n</body>`);
  }

  res.writeHead(200, { 'Content-Type': mime });
  res.end(content);
});

server.listen(PORT, () => {
  console.log(`\n🔥 MODUS Forge Server`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Serving: ${SERVE_DIR}`);
  console.log(`   Live reload: enabled\n`);
});
