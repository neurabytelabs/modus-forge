/**
 * Streaming Handler — Real-time LLM output streaming for MODUS Forge.
 * 
 * IT-20: Enables progressive rendering of LLM responses.
 * Supports Gemini (SSE), OpenAI-compatible (SSE), and Ollama (NDJSON).
 * 
 * Uses Node.js native fetch + ReadableStream — zero dependencies.
 * 
 * @module streaming/handler
 */

import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const GEMINI_API_KEY = 'AIzaSyDvsIgQj9luKM3Ml1QiHfA1bm3vo9o80Gk';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const ANTIGRAVITY = 'http://127.0.0.1:8045';
const ANTIGRAVITY_KEY = 'sk-f741397b2b564a1eaac8e714034eec2f';

/**
 * Stream generation from Gemini API.
 * @param {string} prompt - Enhanced prompt
 * @param {string} [model='gemini-2.0-flash'] - Gemini model name
 * @param {object} [opts]
 * @param {function} [opts.onChunk] - Called with each text chunk
 * @param {function} [opts.onDone] - Called with full text when done
 * @param {AbortSignal} [opts.signal] - Abort signal
 * @returns {Promise<string>} Full generated text
 */
export async function streamGemini(prompt, model = 'gemini-2.0-flash', opts = {}) {
  const { onChunk, onDone, signal } = opts;
  
  const url = `${GEMINI_BASE}/${model}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.8, maxOutputTokens: 32000 },
    systemInstruction: { parts: [{ text: 'You are MODUS Forge. Generate complete, self-contained HTML apps. Output ONLY valid HTML. No markdown fences. Start with <!DOCTYPE html>.' }] },
  };
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini stream error ${res.status}: ${err}`);
  }
  
  return processSSE(res.body, extractGeminiText, onChunk, onDone);
}

/**
 * Stream generation from OpenAI-compatible API (Antigravity, OpenAI, Grok).
 * @param {string} prompt - Enhanced prompt
 * @param {string} [model='gemini-2.0-flash'] - Model name
 * @param {object} [opts]
 * @param {string} [opts.endpoint] - API endpoint
 * @param {string} [opts.apiKey] - API key
 * @param {function} [opts.onChunk] - Called with each text chunk
 * @param {function} [opts.onDone] - Called with full text when done
 * @param {AbortSignal} [opts.signal] - Abort signal
 * @returns {Promise<string>} Full generated text
 */
export async function streamOpenAI(prompt, model = 'gemini-2.0-flash', opts = {}) {
  const {
    endpoint = `${ANTIGRAVITY}/v1/chat/completions`,
    apiKey = ANTIGRAVITY_KEY,
    onChunk, onDone, signal,
  } = opts;
  
  const body = {
    model,
    messages: [
      { role: 'system', content: 'You are MODUS Forge. Generate complete, self-contained HTML apps. Output ONLY valid HTML. No markdown fences. Start with <!DOCTYPE html>.' },
      { role: 'user', content: prompt },
    ],
    stream: true,
    temperature: 0.8,
    max_tokens: 32000,
  };
  
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI stream error ${res.status}: ${err}`);
  }
  
  return processSSE(res.body, extractOpenAIText, onChunk, onDone);
}

/**
 * Stream generation from Ollama (NDJSON format).
 * @param {string} prompt - Enhanced prompt
 * @param {string} [model='llama3'] - Ollama model
 * @param {object} [opts]
 * @param {function} [opts.onChunk] - Called with each text chunk
 * @param {function} [opts.onDone] - Called with full text when done
 * @param {AbortSignal} [opts.signal] - Abort signal
 * @returns {Promise<string>} Full generated text
 */
export async function streamOllama(prompt, model = 'llama3', opts = {}) {
  const { onChunk, onDone, signal } = opts;
  
  const body = {
    model,
    prompt,
    system: 'You are MODUS Forge. Generate complete, self-contained HTML apps. Output ONLY valid HTML. No markdown fences. Start with <!DOCTYPE html>.',
    stream: true,
    options: { temperature: 0.8 },
  };
  
  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama stream error ${res.status}: ${err}`);
  }
  
  return processNDJSON(res.body, onChunk, onDone);
}

/**
 * Auto-detect provider and stream accordingly.
 * @param {string} prompt - Enhanced prompt
 * @param {string} [model='gemini'] - Model identifier
 * @param {object} [opts] - Streaming options
 * @returns {Promise<string>}
 */
export async function stream(prompt, model = 'gemini', opts = {}) {
  if (/^(gemini|gemini-flash|gemini-pro|gemini-2)/.test(model)) {
    const geminiModel = model.includes('pro') ? 'gemini-2.0-pro' : 'gemini-2.0-flash';
    return streamGemini(prompt, geminiModel, opts);
  }
  if (/^(ollama|llama|codellama|mistral|phi)/.test(model)) {
    return streamOllama(prompt, model.replace(/^ollama[-/]?/, '') || 'llama3', opts);
  }
  // Default: OpenAI-compatible via Antigravity
  return streamOpenAI(prompt, model, opts);
}

/**
 * Create a progress tracker for streaming with time estimates.
 * @param {object} [opts]
 * @param {function} [opts.onProgress] - Progress callback
 * @returns {object} Tracker with onChunk/onDone callbacks
 */
export function createProgressTracker(opts = {}) {
  const { onProgress } = opts;
  let chunks = 0;
  let chars = 0;
  const startTime = Date.now();
  
  return {
    onChunk(text) {
      chunks++;
      chars += text.length;
      const elapsed = Date.now() - startTime;
      const charsPerSec = chars / (elapsed / 1000);
      onProgress?.({
        chunks,
        chars,
        elapsedMs: elapsed,
        charsPerSec: Math.round(charsPerSec),
        estimatedTokens: Math.round(chars / 4),
      });
    },
    onDone(fullText) {
      const elapsed = Date.now() - startTime;
      onProgress?.({
        chunks,
        chars: fullText.length,
        elapsedMs: elapsed,
        charsPerSec: Math.round(fullText.length / (elapsed / 1000)),
        estimatedTokens: Math.round(fullText.length / 4),
        done: true,
      });
    },
  };
}

// ─── Internal SSE/NDJSON processors ───

async function processSSE(body, extractFn, onChunk, onDone) {
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';
  
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      
      try {
        const text = extractFn(JSON.parse(data));
        if (text) {
          full += text;
          onChunk?.(text);
        }
      } catch { /* skip malformed */ }
    }
  }
  
  onDone?.(full);
  return full;
}

async function processNDJSON(body, onChunk, onDone) {
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';
  
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        const text = json.response || '';
        if (text) {
          full += text;
          onChunk?.(text);
        }
        if (json.done) break;
      } catch { /* skip */ }
    }
  }
  
  onDone?.(full);
  return full;
}

function extractGeminiText(data) {
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function extractOpenAIText(data) {
  return data?.choices?.[0]?.delta?.content || '';
}
