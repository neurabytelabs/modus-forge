/**
 * Doctor — System health diagnostics for Forge.
 * 
 * Checks: Node version, dependencies, API keys, providers, disk space,
 * workspace integrity, and optional services (Ollama, Antigravity).
 * 
 * Usage: `forge doctor` → prints a diagnostic report with ✅/⚠️/❌ per check.
 * Spinoza: adequate knowledge of the system's state enables adequate action.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CHECKS = [];

function registerCheck(name, category, fn) {
  CHECKS.push({ name, category, fn });
}

// --- Checks ---

registerCheck('Node.js version', 'runtime', () => {
  const version = process.version;
  const major = parseInt(version.slice(1));
  if (major >= 22) return { status: 'ok', detail: version };
  if (major >= 18) return { status: 'warn', detail: `${version} — v22+ recommended` };
  return { status: 'fail', detail: `${version} — v18+ required` };
});

registerCheck('package.json', 'project', () => {
  const pkg = join(process.cwd(), 'package.json');
  if (!existsSync(pkg)) return { status: 'warn', detail: 'Not in a forge project directory' };
  try {
    const p = JSON.parse(readFileSync(pkg, 'utf-8'));
    return { status: 'ok', detail: `${p.name}@${p.version}` };
  } catch {
    return { status: 'fail', detail: 'Invalid package.json' };
  }
});

registerCheck('GEMINI_API_KEY', 'providers', () => {
  return process.env.GEMINI_API_KEY
    ? { status: 'ok', detail: 'Set' }
    : { status: 'warn', detail: 'Not set — Gemini direct calls will fail' };
});

registerCheck('OPENAI_API_KEY', 'providers', () => {
  return process.env.OPENAI_API_KEY
    ? { status: 'ok', detail: 'Set' }
    : { status: 'warn', detail: 'Not set — OpenAI/GPT calls will fail' };
});

registerCheck('ANTHROPIC_API_KEY', 'providers', () => {
  return process.env.ANTHROPIC_API_KEY
    ? { status: 'ok', detail: 'Set' }
    : { status: 'warn', detail: 'Not set — Claude direct calls will fail' };
});

registerCheck('Antigravity gateway', 'providers', async () => {
  try {
    const res = await fetch('http://127.0.0.1:8045/v1/models', {
      headers: { Authorization: 'Bearer sk-test' },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok
      ? { status: 'ok', detail: 'Running on :8045' }
      : { status: 'warn', detail: `Responded with ${res.status}` };
  } catch {
    return { status: 'warn', detail: 'Not reachable — multi-model routing limited' };
  }
});

registerCheck('Ollama', 'providers', async () => {
  try {
    const res = await fetch('http://127.0.0.1:11434/api/tags', {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { status: 'warn', detail: 'Not responding' };
    const data = await res.json();
    const count = data.models?.length || 0;
    return { status: 'ok', detail: `Running — ${count} model(s) available` };
  } catch {
    return { status: 'warn', detail: 'Not running — local generation unavailable' };
  }
});

registerCheck('Disk space', 'system', () => {
  try {
    const output = execSync("df -h . | tail -1 | awk '{print $4}'", { encoding: 'utf-8' }).trim();
    const num = parseFloat(output);
    const unit = output.replace(/[0-9.]/g, '').trim();
    const isLow = (unit === 'M' || (unit === 'G' && num < 1));
    return {
      status: isLow ? 'warn' : 'ok',
      detail: `${output} available`,
    };
  } catch {
    return { status: 'warn', detail: 'Could not check' };
  }
});

registerCheck('Global config', 'config', () => {
  const configPath = join(homedir(), '.forge', 'config.json');
  if (!existsSync(configPath)) return { status: 'ok', detail: 'Using defaults (no ~/.forge/config.json)' };
  try {
    JSON.parse(readFileSync(configPath, 'utf-8'));
    return { status: 'ok', detail: 'Valid' };
  } catch {
    return { status: 'fail', detail: 'Invalid JSON in ~/.forge/config.json' };
  }
});

registerCheck('Workspace', 'config', () => {
  const forgePath = join(process.cwd(), '.forge', 'config.json');
  if (!existsSync(forgePath)) return { status: 'ok', detail: 'No workspace (global mode)' };
  try {
    const config = JSON.parse(readFileSync(forgePath, 'utf-8'));
    return { status: 'ok', detail: `Workspace: ${config.name}` };
  } catch {
    return { status: 'fail', detail: 'Invalid .forge/config.json' };
  }
});

registerCheck('curl', 'tools', () => {
  try {
    execSync('which curl', { encoding: 'utf-8' });
    return { status: 'ok', detail: 'Available' };
  } catch {
    return { status: 'fail', detail: 'Not found — required for LLM API calls' };
  }
});

// --- Runner ---

const STATUS_ICON = { ok: '✅', warn: '⚠️', fail: '❌' };
const STATUS_PRIORITY = { fail: 0, warn: 1, ok: 2 };

/**
 * Run all checks, return structured results.
 */
export async function runAll(opts = {}) {
  const results = [];
  
  for (const check of CHECKS) {
    if (opts.category && check.category !== opts.category) continue;
    try {
      const result = await check.fn();
      results.push({ name: check.name, category: check.category, ...result });
    } catch (err) {
      results.push({ name: check.name, category: check.category, status: 'fail', detail: err.message });
    }
  }
  
  // Sort: failures first, then warnings, then ok
  results.sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]);
  
  return results;
}

/**
 * Format results as a human-readable report string.
 */
export function formatReport(results) {
  const lines = ['🔍 Forge Doctor\n'];
  
  let lastCategory = '';
  for (const r of results) {
    if (r.category !== lastCategory) {
      lines.push(`  [${r.category}]`);
      lastCategory = r.category;
    }
    lines.push(`  ${STATUS_ICON[r.status]} ${r.name}: ${r.detail}`);
  }
  
  const fails = results.filter(r => r.status === 'fail').length;
  const warns = results.filter(r => r.status === 'warn').length;
  const oks = results.filter(r => r.status === 'ok').length;
  
  lines.push('');
  lines.push(`  Summary: ${oks} ok, ${warns} warnings, ${fails} failures`);
  
  if (fails > 0) {
    lines.push('  ❌ Fix failures before running forge.');
  } else if (warns > 0) {
    lines.push('  ⚠️ Warnings are non-blocking but may limit features.');
  } else {
    lines.push('  ✅ All systems nominal. Forge away!');
  }
  
  return lines.join('\n');
}

/**
 * Quick health check — returns true if no failures.
 */
export async function isHealthy() {
  const results = await runAll();
  return results.every(r => r.status !== 'fail');
}
