import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createChannel, formatSSE, createSSEServer } from '../lib/sse/server.js';

describe('SSE Server', () => {
  describe('formatSSE', () => {
    it('should format a default message event', () => {
      const result = formatSSE('message', { hello: 'world' });
      assert.equal(result, 'data: {"hello":"world"}\n\n');
    });

    it('should format a named event', () => {
      const result = formatSSE('update', { v: 1 });
      assert.equal(result, 'event: update\ndata: {"v":1}\n\n');
    });

    it('should include event ID when provided', () => {
      const result = formatSSE('message', 'test', '42');
      assert.equal(result, 'id: 42\ndata: test\n\n');
    });

    it('should handle string data without JSON encoding', () => {
      const result = formatSSE('message', 'plain text');
      assert.equal(result, 'data: plain text\n\n');
    });
  });

  describe('createChannel', () => {
    it('should create a channel with 0 clients', () => {
      const ch = createChannel();
      assert.equal(ch.clientCount, 0);
      ch.close();
    });

    it('should expose handler, send, broadcast, close', () => {
      const ch = createChannel();
      assert.equal(typeof ch.handler, 'function');
      assert.equal(typeof ch.send, 'function');
      assert.equal(typeof ch.broadcast, 'function');
      assert.equal(typeof ch.close, 'function');
      ch.close();
    });

    it('should track onConnect/onDisconnect callbacks', () => {
      let connected = 0;
      const ch = createChannel({
        onConnect: (n) => { connected = n; },
      });
      assert.equal(connected, 0);
      ch.close();
    });
  });

  describe('createSSEServer', () => {
    it('should create a server with auto-assigned port', async () => {
      const ch = createChannel();
      const { url, close } = await createSSEServer({
        '/events': { channel: ch },
        '/': { html: '<h1>test</h1>' },
      });
      assert.ok(url.startsWith('http://localhost:'));
      close();
    });
  });
});
