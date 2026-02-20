/**
 * Finance Portfolio Skill — Crypto & stock price context for MODUS Forge.
 * 
 * Uses free APIs (no key required):
 * - CoinGecko API for crypto (BTC, ETH, SOL, etc.)
 * - Yahoo Finance chart API for stocks
 * 
 * Provides portfolio context for generating finance-aware dashboards.
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CACHE_FILE = join(homedir(), '.forge-portfolio-cache.json');
const CACHE_TTL = 300_000; // 5 min — prices change fast

const DEFAULT_CRYPTO = ['bitcoin', 'ethereum', 'solana'];
const DEFAULT_STOCKS = ['AAPL', 'MSFT', 'NVDA'];
const DEFAULT_CURRENCY = 'usd';

/**
 * Fetch crypto prices from CoinGecko (free, no key).
 * @param {string[]} ids - CoinGecko coin IDs
 * @param {string} currency - vs currency
 * @returns {object[]} Array of { id, symbol, price, change24h }
 */
function fetchCrypto(ids = DEFAULT_CRYPTO, currency = DEFAULT_CURRENCY) {
  try {
    const idList = ids.join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${idList}&vs_currencies=${currency}&include_24hr_change=true`;
    const result = execSync(
      `curl -sf --max-time 10 "${url}"`,
      { encoding: 'utf-8', timeout: 15_000 }
    );
    const data = JSON.parse(result);

    return ids.map(id => {
      const d = data[id];
      if (!d) return { id, symbol: id.toUpperCase(), price: null, change24h: null };
      return {
        id,
        symbol: id.slice(0, 3).toUpperCase(),
        price: d[currency],
        change24h: d[`${currency}_24h_change`] ?? null,
      };
    });
  } catch {
    return ids.map(id => ({ id, symbol: id.toUpperCase(), price: null, change24h: null }));
  }
}

/**
 * Fetch stock prices from Yahoo Finance chart API (free, no key).
 * @param {string[]} symbols - Stock ticker symbols
 * @returns {object[]} Array of { symbol, price, change24h }
 */
function fetchStocks(symbols = DEFAULT_STOCKS) {
  return symbols.map(symbol => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`;
      const result = execSync(
        `curl -sf --max-time 10 -H "User-Agent: Mozilla/5.0" "${url}"`,
        { encoding: 'utf-8', timeout: 15_000 }
      );
      const data = JSON.parse(result);
      const meta = data.chart?.result?.[0]?.meta;
      if (!meta) return { symbol, price: null, change24h: null };

      const price = meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose || meta.previousClose;
      const change24h = prevClose ? ((price - prevClose) / prevClose * 100) : null;

      return { symbol, price, change24h };
    } catch {
      return { symbol, price: null, change24h: null };
    }
  });
}

/**
 * Read cached portfolio data if fresh.
 */
function readCache() {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const data = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
    if (Date.now() - data.timestamp < CACHE_TTL) return data.portfolio;
  } catch {}
  return null;
}

/**
 * Fetch full portfolio snapshot (crypto + stocks).
 * @param {object} opts - { crypto, stocks, currency }
 * @returns {Promise<object>} Portfolio snapshot
 */
export async function getPortfolio(opts = {}) {
  const cached = readCache();
  if (cached) return cached;

  const crypto = fetchCrypto(opts.crypto || DEFAULT_CRYPTO, opts.currency || DEFAULT_CURRENCY);
  const stocks = fetchStocks(opts.stocks || DEFAULT_STOCKS);

  const portfolio = {
    timestamp: new Date().toISOString(),
    crypto,
    stocks,
    summary: buildSummary(crypto, stocks),
  };

  try {
    writeFileSync(CACHE_FILE, JSON.stringify({ timestamp: Date.now(), portfolio }));
  } catch {}

  return portfolio;
}

/**
 * Build human-readable summary for prompt context.
 */
function buildSummary(crypto, stocks) {
  const parts = [];

  const btc = crypto.find(c => c.id === 'bitcoin');
  if (btc?.price) {
    const arrow = (btc.change24h ?? 0) >= 0 ? '📈' : '📉';
    parts.push(`BTC $${btc.price.toLocaleString()} ${arrow} ${(btc.change24h ?? 0).toFixed(1)}%`);
  }

  const eth = crypto.find(c => c.id === 'ethereum');
  if (eth?.price) {
    parts.push(`ETH $${eth.price.toLocaleString()}`);
  }

  const validStocks = stocks.filter(s => s.price);
  if (validStocks.length) {
    const avgChange = validStocks.reduce((sum, s) => sum + (s.change24h || 0), 0) / validStocks.length;
    const mood = avgChange > 1 ? 'bullish' : avgChange < -1 ? 'bearish' : 'neutral';
    parts.push(`Markets: ${mood}`);
  }

  return parts.join(' | ') || 'Market data unavailable';
}

/**
 * Build portfolio context string for L1 prompt injection.
 * @returns {Promise<string>} Context line
 */
export async function portfolioContext(opts = {}) {
  const portfolio = await getPortfolio(opts);
  return `💰 ${portfolio.summary}`;
}

/**
 * Get market mood for theme generation.
 * @returns {Promise<string>} 'bullish' | 'bearish' | 'neutral'
 */
export async function marketMood() {
  const portfolio = await getPortfolio();
  const allChanges = [
    ...portfolio.crypto.map(c => c.change24h),
    ...portfolio.stocks.map(s => s.change24h),
  ].filter(c => c != null);

  if (!allChanges.length) return 'neutral';
  const avg = allChanges.reduce((a, b) => a + b, 0) / allChanges.length;
  return avg > 1.5 ? 'bullish' : avg < -1.5 ? 'bearish' : 'neutral';
}
