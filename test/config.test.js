import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, getConfig, DEFAULTS, deepMerge, envToConfig } from '../lib/config/loader.js';

describe('Config Loader', () => {
  it('returns defaults when no config files exist', () => {
    const config = loadConfig({}, '/tmp/nonexistent-forge-project');
    assert.equal(config.provider, 'gemini');
    assert.equal(config.temperature, 0.7);
    assert.equal(config.theme, 'cyberpunk');
    assert.equal(config.persona, 'architect');
    assert.equal(config.security.sanitize, true);
    assert.equal(config.context.time, true);
  });

  it('overrides merge correctly', () => {
    const config = loadConfig({ provider: 'grok', temperature: 0.9 }, '/tmp/nonexistent');
    assert.equal(config.provider, 'grok');
    assert.equal(config.temperature, 0.9);
    assert.equal(config.theme, 'cyberpunk'); // default preserved
  });

  it('deepMerge handles nested objects', () => {
    const a = { x: 1, nested: { a: 1, b: 2 } };
    const b = { x: 2, nested: { b: 3, c: 4 } };
    const result = deepMerge(a, b);
    assert.equal(result.x, 2);
    assert.equal(result.nested.a, 1);
    assert.equal(result.nested.b, 3);
    assert.equal(result.nested.c, 4);
  });

  it('deepMerge skips undefined values', () => {
    const a = { x: 1, y: 2 };
    const b = { x: undefined, y: 3 };
    assert.equal(deepMerge(a, b).x, 1);
    assert.equal(deepMerge(a, b).y, 3);
  });

  it('envToConfig parses FORGE_ vars', () => {
    const env = {
      FORGE_PROVIDER: 'claude',
      FORGE_TEMPERATURE: '0.5',
      FORGE_TELEMETRY: 'false',
      FORGE_CONTEXT_WEATHER: 'true',
      FORGE_SECURITY_SANITIZE: 'false',
      OTHER_VAR: 'ignored'
    };
    const config = envToConfig(env);
    assert.equal(config.provider, 'claude');
    assert.equal(config.temperature, 0.5);
    assert.equal(config.telemetry, false);
    assert.equal(config.context.weather, true);
    assert.equal(config.security.sanitize, false);
    assert.equal(config.otherVar, undefined);
  });

  it('getConfig reads dot-path values', () => {
    const config = loadConfig({}, '/tmp/nonexistent');
    assert.equal(getConfig('provider', config), 'gemini');
    assert.equal(getConfig('security.sanitize', config), true);
    assert.equal(getConfig('context.git', config), true);
    assert.equal(getConfig('nonexistent.path', config), undefined);
  });

  it('DEFAULTS has all expected keys', () => {
    const keys = ['provider', 'model', 'temperature', 'maxTokens', 'theme', 
                  'persona', 'cacheTtlMs', 'cacheMaxSize', 'security', 'context'];
    for (const k of keys) {
      assert.ok(k in DEFAULTS, `Missing default: ${k}`);
    }
  });
});
