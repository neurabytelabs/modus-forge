/**
 * HTML Renderer — Writes generated HTML to disk
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Render HTML to a file.
 * @param {string} html - Complete HTML string
 * @param {object} opts - { dir, intent }
 * @returns {Promise<string>} Output file path
 */
export async function render(html, opts = {}) {
  const dir = opts.dir || 'output';
  const slug = (opts.intent || 'app')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `${slug}-${timestamp}.html`;

  mkdirSync(dir, { recursive: true });
  const outputPath = join(dir, filename);
  writeFileSync(outputPath, html, 'utf-8');

  return outputPath;
}
