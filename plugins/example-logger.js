/**
 * Example Plugin — Demonstrates the MODUS Forge plugin contract.
 * 
 * This plugin logs pipeline events and adds a "build info" context signal.
 * Use as a template for creating your own plugins.
 */

export default {
  name: 'example-logger',
  version: '1.0.0',
  description: 'Logs pipeline events and adds build metadata to context',

  // Lifecycle hooks (same as hooks/lifecycle.js)
  hooks: {
    beforeGenerate(state) {
      console.log(`[example-logger] 🔥 Generating with model: ${state.model || 'default'}`);
    },
    afterValidate(state) {
      const score = state.validation?.total ?? 0;
      if (score > 0.8) {
        console.log(`[example-logger] 🌟 High quality output! (${(score * 100).toFixed(0)}%)`);
      }
    },
  },

  // Context sensor — returns a string injected into L1
  context() {
    return `Build: MODUS Forge | Node ${process.version} | ${process.platform}`;
  },

  // CLI commands — available as `forge example-cmd`
  commands: {
    'example-hello': {
      desc: 'Say hello from the example plugin',
      run(args) {
        return `👋 Hello from example-logger! Args: ${args.join(', ') || 'none'}`;
      },
    },
  },

  init() {
    console.log('[example-logger] Plugin initialized');
  },

  destroy() {
    console.log('[example-logger] Plugin destroyed');
  },
};
