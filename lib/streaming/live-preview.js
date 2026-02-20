/**
 * Live Preview Server — Real-time streaming preview for MODUS Forge.
 * 
 * IT-20: Combines streaming handler with HTTP server to show
 * progressive rendering as the LLM generates HTML.
 * 
 * Uses SSE to push chunks to the browser. The browser accumulates
 * chunks into a live iframe that updates in real-time.
 * 
 * @module streaming/live-preview
 */

import { createServer } from 'node:http';
import { stream, createProgressTracker } from './handler.js';

const PREVIEW_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>MODUS Forge — Live Preview</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'JetBrains Mono', monospace; background: #0a0a0a; color: #e0e0e0; }
  #header {
    padding: 12px 20px;
    background: #111;
    border-bottom: 1px solid #222;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  #header h1 { font-size: 14px; color: #7C3AED; }
  #stats { font-size: 12px; color: #666; }
  #stats span { color: #06B6D4; margin-left: 12px; }
  #preview-frame {
    width: 100%; height: calc(100vh - 48px);
    border: none; background: white;
  }
  .generating #header { border-bottom-color: #7C3AED; }
  .done #header { border-bottom-color: #06B6D4; }
</style>
</head>
<body class="generating">
<div id="header">
  <h1>🔥 MODUS Forge — Live Generation</h1>
  <div id="stats">
    <span id="chunks">0 chunks</span>
    <span id="chars">0 chars</span>
    <span id="speed">— ch/s</span>
    <span id="status">⏳ generating...</span>
  </div>
</div>
<iframe id="preview-frame" sandbox="allow-scripts allow-same-origin"></iframe>
<script>
  const frame = document.getElementById('preview-frame');
  const statsChunks = document.getElementById('chunks');
  const statsChars = document.getElementById('chars');
  const statsSpeed = document.getElementById('speed');
  const statusEl = document.getElementById('status');
  
  let html = '';
  let chunkCount = 0;
  const startTime = Date.now();
  
  const src = new EventSource('/stream');
  
  src.onmessage = (e) => {
    const data = JSON.parse(e.data);
    
    if (data.chunk) {
      html += data.chunk;
      chunkCount++;
      
      // Update preview every 5 chunks (debounce)
      if (chunkCount % 5 === 0 || html.includes('</html>')) {
        frame.srcdoc = html;
      }
      
      const elapsed = (Date.now() - startTime) / 1000;
      statsChunks.textContent = chunkCount + ' chunks';
      statsChars.textContent = html.length + ' chars';
      statsSpeed.textContent = Math.round(html.length / elapsed) + ' ch/s';
    }
    
    if (data.done) {
      frame.srcdoc = html;
      statusEl.textContent = '✅ done (' + ((Date.now() - startTime) / 1000).toFixed(1) + 's)';
      document.body.className = 'done';
      src.close();
    }
    
    if (data.error) {
      statusEl.textContent = '❌ ' + data.error;
      src.close();
    }
  };
  
  src.onerror = () => {
    statusEl.textContent = '❌ connection lost';
    src.close();
  };
</script>
</body>
</html>`;

/**
 * Start a live preview server that streams LLM generation.
 * @param {string} prompt - Enhanced prompt to generate
 * @param {object} [opts]
 * @param {string} [opts.model='gemini'] - Model to use
 * @param {number} [opts.port=3456] - Server port
 * @param {boolean} [opts.open=true] - Open browser automatically
 * @returns {Promise<{html: string, server: object}>}
 */
export async function livePreview(prompt, opts = {}) {
  const { model = 'gemini', port = 3456, open = true } = opts;
  
  let sseRes = null;
  let finalHtml = '';
  let generating = false;
  
  const server = createServer((req, res) => {
    if (req.url === '/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      sseRes = res;
      
      // Start generation if not already running
      if (!generating) {
        generating = true;
        startGeneration(prompt, model, res);
      }
      
      req.on('close', () => { sseRes = null; });
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(PREVIEW_HTML);
    }
  });
  
  async function startGeneration(prompt, model, res) {
    try {
      finalHtml = await stream(prompt, model, {
        onChunk(text) {
          if (sseRes && !sseRes.destroyed) {
            sseRes.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
          }
        },
        onDone(full) {
          if (sseRes && !sseRes.destroyed) {
            sseRes.write(`data: ${JSON.stringify({ done: true, totalChars: full.length })}\n\n`);
          }
        },
      });
    } catch (err) {
      if (sseRes && !sseRes.destroyed) {
        sseRes.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      }
    }
  }
  
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`🔥 Live preview: http://localhost:${port}`);
      if (open) {
        import('node:child_process').then(({ execSync }) => {
          try { execSync(`open http://localhost:${port}`); } catch {}
        });
      }
      
      // Auto-close after generation completes + 30s
      const check = setInterval(() => {
        if (finalHtml && !sseRes) {
          clearInterval(check);
          setTimeout(() => {
            server.close();
            resolve({ html: finalHtml, server });
          }, 5000);
        }
      }, 1000);
    });
  });
}
