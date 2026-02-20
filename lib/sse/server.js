/**
 * Shared SSE Server Utility — MODUS Forge.
 * 
 * IT-21: Extracted from live-preview, monitor, and streaming modules.
 * Provides a reusable SSE channel primitive that any module can use.
 * 
 * Pattern: createChannel() → channel.send(data) / channel.broadcast(data)
 * Clients connect via channel.handler (HTTP request handler).
 * 
 * @module sse/server
 */

import { createServer } from 'node:http';

/**
 * Create an SSE channel that manages connected clients.
 * @param {object} [opts]
 * @param {number} [opts.heartbeatMs=30000] - Keep-alive interval
 * @param {number} [opts.maxClients=50] - Max concurrent connections
 * @param {function} [opts.onConnect] - Called when client connects
 * @param {function} [opts.onDisconnect] - Called when client disconnects
 * @returns {SSEChannel}
 */
export function createChannel(opts = {}) {
  const { heartbeatMs = 30000, maxClients = 50, onConnect, onDisconnect } = opts;
  /** @type {Set<import('http').ServerResponse>} */
  const clients = new Set();
  let heartbeat = null;

  function startHeartbeat() {
    if (heartbeat) return;
    heartbeat = setInterval(() => {
      for (const res of clients) {
        if (res.destroyed) { clients.delete(res); continue; }
        try { res.write(': heartbeat\n\n'); } catch { clients.delete(res); }
      }
    }, heartbeatMs);
    // Don't block process exit
    if (heartbeat.unref) heartbeat.unref();
  }

  function stopHeartbeat() {
    if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
  }

  /**
   * HTTP request handler — attach to a route to accept SSE clients.
   * @param {import('http').IncomingMessage} req
   * @param {import('http').ServerResponse} res
   */
  function handler(req, res) {
    if (clients.size >= maxClients) {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('Too many connections');
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no', // nginx
    });
    res.flushHeaders();

    clients.add(res);
    startHeartbeat();
    onConnect?.(clients.size);

    req.on('close', () => {
      clients.delete(res);
      onDisconnect?.(clients.size);
      if (clients.size === 0) stopHeartbeat();
    });
  }

  /**
   * Send a named event to all connected clients.
   * @param {string} event - Event name (or 'message' for default)
   * @param {*} data - JSON-serializable data
   * @param {string} [id] - Optional event ID for reconnection
   */
  function send(event, data, id) {
    const payload = formatSSE(event, data, id);
    for (const res of clients) {
      if (res.destroyed) { clients.delete(res); continue; }
      try { res.write(payload); } catch { clients.delete(res); }
    }
  }

  /**
   * Send default 'message' event to all clients.
   * @param {*} data - JSON-serializable data
   */
  function broadcast(data) {
    send('message', data);
  }

  /**
   * Close all connections and stop heartbeat.
   */
  function close() {
    stopHeartbeat();
    for (const res of clients) {
      try { res.end(); } catch { /* ignore */ }
    }
    clients.clear();
  }

  return {
    handler,
    send,
    broadcast,
    close,
    get clientCount() { return clients.size; },
  };
}

/**
 * Format an SSE payload string.
 * @param {string} event - Event name
 * @param {*} data - JSON-serializable data
 * @param {string} [id] - Event ID
 * @returns {string}
 */
export function formatSSE(event, data, id) {
  let msg = '';
  if (id) msg += `id: ${id}\n`;
  if (event && event !== 'message') msg += `event: ${event}\n`;
  msg += `data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`;
  return msg;
}

/**
 * Create a simple SSE HTTP server with route-based channels.
 * @param {object} routes - Map of path → { channel, html? }
 * @param {number} [port=0] - Port (0 = auto-assign)
 * @returns {Promise<{server: object, url: string, close: function}>}
 */
export function createSSEServer(routes, port = 0) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const route = routes[req.url];
      if (route?.channel) {
        route.channel.handler(req, res);
      } else if (route?.html) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(typeof route.html === 'function' ? route.html() : route.html);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(port, () => {
      const addr = server.address();
      const url = `http://localhost:${addr.port}`;
      resolve({
        server,
        url,
        close() {
          Object.values(routes).forEach(r => r.channel?.close());
          server.close();
        },
      });
    });
  });
}
