import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PipelineInspector, createInspector } from '../lib/debug/inspector.js';

describe('PipelineInspector', () => {
  it('should trace a full pipeline', () => {
    const inspector = new PipelineInspector();
    inspector.start('test-pipeline', { prompt: 'make a timer' });
    inspector.record('enhance', { input: 'raw prompt', output: 'enhanced prompt', durationMs: 5 });
    inspector.record('generate', { provider: 'gemini', model: 'gemini-3-pro', output: '<html>...', tokens: 500 });
    inspector.record('validate', { output: { score: 85 }, decision: 'score above threshold' });
    const report = inspector.end('<html>final</html>');
    
    assert.equal(report.stageCount, 3);
    assert.ok(report.totalMs >= 0);
    assert.ok(report.providers.includes('gemini'));
    assert.equal(report.errors.length, 0);
  });

  it('should track errors', () => {
    const inspector = new PipelineInspector();
    inspector.start('error-pipeline');
    inspector.record('generate', { error: new Error('API timeout') });
    const report = inspector.end();
    assert.equal(report.errors.length, 1);
    assert.equal(report.errors[0].stage, 'generate');
  });

  it('should produce readable toString()', () => {
    const inspector = new PipelineInspector();
    inspector.start('string-test');
    inspector.record('step1', { provider: 'claude' });
    const str = inspector.toString();
    assert.ok(str.includes('Pipeline Trace'));
    assert.ok(str.includes('step1'));
    assert.ok(str.includes('claude'));
  });

  it('should summarize long strings in non-verbose mode', () => {
    const inspector = new PipelineInspector({ verbose: false });
    inspector.start('summary-test');
    const longStr = 'x'.repeat(200);
    inspector.record('step', { input: longStr });
    const trace = inspector.traces[1];
    assert.ok(trace.input.length < 200);
    assert.ok(trace.input.includes('chars'));
  });

  it('should keep full data in verbose mode', () => {
    const inspector = new PipelineInspector({ verbose: true });
    inspector.start('verbose-test');
    const longStr = 'x'.repeat(200);
    inspector.record('step', { input: longStr });
    assert.equal(inspector.traces[1].input, longStr);
  });

  it('should be no-op when disabled', () => {
    const inspector = new PipelineInspector({ enabled: false });
    inspector.start('disabled');
    inspector.record('step', { data: 'test' });
    assert.equal(inspector.end(), null);
    assert.equal(inspector.traces.length, 0);
  });

  it('should export toJSON()', () => {
    const inspector = new PipelineInspector();
    inspector.start('json-test');
    inspector.record('step1');
    const json = inspector.toJSON();
    assert.ok(json.traces);
    assert.ok(json.summary);
  });

  it('should create inspector via factory', () => {
    const inspector = createInspector({ verbose: true });
    assert.ok(inspector instanceof PipelineInspector);
    assert.equal(inspector.verbose, true);
  });
});
