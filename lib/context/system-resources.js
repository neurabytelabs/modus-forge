/**
 * System Resources Context — CPU, memory, disk signals for adaptive generation.
 * 
 * When the machine is under load, suggest simpler outputs (fewer animations,
 * lighter DOM). When idle, go wild with effects and complexity.
 * 
 * Philosophy: "Each thing, as far as it can by its own power, strives to
 * persevere in its being." — Spinoza, Ethics III, Prop 6
 * (Conserve resources when scarce; expand when abundant.)
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Cache system info for 2 minutes */
let cache = { data: null, ts: 0 };
const CACHE_TTL = 120_000;

/**
 * Get CPU load average (1-min).
 * @returns {number} Load average (0 = idle, >1 = overloaded per core)
 */
function getCpuLoad() {
  try {
    const uptime = execSync('sysctl -n vm.loadavg 2>/dev/null || cat /proc/loadavg 2>/dev/null', {
      encoding: 'utf-8', timeout: 3000
    }).trim();
    const match = uptime.match(/([\d.]+)/);
    return match ? parseFloat(match[1]) : 0;
  } catch { return 0; }
}

/**
 * Get memory usage percentage.
 * @returns {{ totalGB: number, usedPercent: number }}
 */
function getMemory() {
  try {
    if (process.platform === 'darwin') {
      const total = parseInt(execSync('sysctl -n hw.memsize', { encoding: 'utf-8' }).trim(), 10);
      const pageSize = parseInt(execSync('sysctl -n hw.pagesize', { encoding: 'utf-8' }).trim(), 10);
      const vmStat = execSync('vm_stat', { encoding: 'utf-8' });
      const pages = (key) => {
        const m = vmStat.match(new RegExp(`${key}:\\s+(\\d+)`));
        return m ? parseInt(m[1], 10) : 0;
      };
      const free = (pages('Pages free') + pages('Pages speculative')) * pageSize;
      const totalGB = +(total / 1e9).toFixed(1);
      const usedPercent = +((1 - free / total) * 100).toFixed(0);
      return { totalGB, usedPercent };
    }
    // Linux fallback
    const meminfo = readFileSync('/proc/meminfo', 'utf-8');
    const val = (key) => parseInt(meminfo.match(new RegExp(`${key}:\\s+(\\d+)`))?.[1] || '0', 10);
    const total = val('MemTotal');
    const avail = val('MemAvailable');
    return { totalGB: +(total / 1e6).toFixed(1), usedPercent: +((1 - avail / total) * 100).toFixed(0) };
  } catch { return { totalGB: 0, usedPercent: 0 }; }
}

/**
 * Get disk usage for home directory.
 * @returns {{ totalGB: number, usedPercent: number }}
 */
function getDisk() {
  try {
    const df = execSync(`df -g ~ 2>/dev/null || df -BG ~ 2>/dev/null`, {
      encoding: 'utf-8', timeout: 3000
    });
    const lines = df.trim().split('\n');
    if (lines.length < 2) return { totalGB: 0, usedPercent: 0 };
    const parts = lines[1].split(/\s+/);
    const totalGB = parseInt(parts[1], 10) || 0;
    const usedPercent = parseInt(parts[4], 10) || 0;
    return { totalGB, usedPercent };
  } catch { return { totalGB: 0, usedPercent: 0 }; }
}

/**
 * Determine complexity budget based on system resources.
 * @param {{ cpuLoad: number, memUsed: number }} stats
 * @returns {{ level: string, hint: string }}
 */
function complexityBudget(stats) {
  const pressure = (stats.cpuLoad / 2 + stats.memUsed / 100) / 2; // 0-1 normalized
  if (pressure > 0.8) return { level: 'minimal', hint: 'System under heavy load — generate simple, lightweight output. No animations, minimal DOM.' };
  if (pressure > 0.5) return { level: 'moderate', hint: 'Moderate system load — keep animations subtle, avoid heavy computations.' };
  return { level: 'full', hint: 'System idle — feel free to add rich animations, complex layouts, and visual effects.' };
}

/**
 * Gather system resource context.
 * @returns {{ cpu: number, memory: { totalGB: number, usedPercent: number }, disk: { totalGB: number, usedPercent: number }, complexity: { level: string, hint: string }, summary: string }}
 */
export function systemResourcesContext() {
  const now = Date.now();
  if (cache.data && (now - cache.ts) < CACHE_TTL) return cache.data;

  const cpuLoad = getCpuLoad();
  const memory = getMemory();
  const disk = getDisk();
  const complexity = complexityBudget({ cpuLoad, memUsed: memory.usedPercent });

  const data = {
    cpu: cpuLoad,
    memory,
    disk,
    complexity,
    summary: `System: CPU ${cpuLoad.toFixed(1)} load, ${memory.usedPercent}% RAM, ${disk.usedPercent}% disk → complexity=${complexity.level}`
  };
  cache = { data, ts: now };
  return data;
}
