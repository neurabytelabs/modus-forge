/**
 * Lifecycle Hooks — Plugin extensibility system for MODUS Forge.
 * 
 * IT-20: Enables pre/post hooks at every pipeline stage.
 * Plugins register handlers; the pipeline calls them in order.
 * 
 * Hook points:
 *   beforeContext  → afterContext
 *   beforeEnhance  → afterEnhance
 *   beforeGenerate → afterGenerate
 *   beforeValidate → afterValidate
 *   beforePersist  → afterPersist
 *   onError
 * 
 * Each hook receives the pipeline state and can modify it.
 * Hooks run in registration order. Async hooks are awaited.
 * 
 * @module hooks/lifecycle
 */

/** @type {Map<string, Array<{name: string, fn: Function, priority: number}>>} */
const hooks = new Map();

const VALID_HOOKS = [
  'beforeContext', 'afterContext',
  'beforeEnhance', 'afterEnhance',
  'beforeGenerate', 'afterGenerate',
  'beforeValidate', 'afterValidate',
  'beforePersist', 'afterPersist',
  'onError',
];

/**
 * Register a hook handler.
 * @param {string} hookName - One of the valid hook points
 * @param {Function} fn - Handler function (receives state, returns modified state or void)
 * @param {object} [opts]
 * @param {string} [opts.name='anonymous'] - Plugin/handler name
 * @param {number} [opts.priority=10] - Lower runs first
 */
export function on(hookName, fn, opts = {}) {
  if (!VALID_HOOKS.includes(hookName)) {
    throw new Error(`Invalid hook: ${hookName}. Valid: ${VALID_HOOKS.join(', ')}`);
  }
  const { name = 'anonymous', priority = 10 } = opts;
  if (!hooks.has(hookName)) hooks.set(hookName, []);
  const list = hooks.get(hookName);
  list.push({ name, fn, priority });
  list.sort((a, b) => a.priority - b.priority);
}

/**
 * Remove a hook handler by name.
 * @param {string} hookName
 * @param {string} handlerName
 */
export function off(hookName, handlerName) {
  if (!hooks.has(hookName)) return;
  const list = hooks.get(hookName);
  const idx = list.findIndex(h => h.name === handlerName);
  if (idx >= 0) list.splice(idx, 1);
}

/**
 * Run all handlers for a hook point.
 * @param {string} hookName
 * @param {object} state - Current pipeline state (mutated in place)
 * @returns {Promise<object>} Modified state
 */
export async function run(hookName, state) {
  if (!hooks.has(hookName)) return state;
  
  for (const handler of hooks.get(hookName)) {
    try {
      const result = await handler.fn(state);
      if (result !== undefined && result !== null) {
        state = result;
      }
    } catch (err) {
      // Hook errors don't crash the pipeline — log and continue
      state._hookErrors = state._hookErrors || [];
      state._hookErrors.push({
        hook: hookName,
        handler: handler.name,
        error: err.message,
      });
      
      // But do run onError hooks (unless this IS onError)
      if (hookName !== 'onError') {
        await run('onError', { ...state, _currentError: err, _failedHook: hookName });
      }
    }
  }
  
  return state;
}

/**
 * Register a plugin (object with named hook handlers).
 * @param {object} plugin
 * @param {string} plugin.name - Plugin name
 * @param {object} plugin.hooks - Map of hookName → handler function
 * @param {number} [plugin.priority=10] - Default priority for all hooks
 */
export function registerPlugin(plugin) {
  const { name, hooks: pluginHooks, priority = 10 } = plugin;
  if (!name) throw new Error('Plugin must have a name');
  if (!pluginHooks || typeof pluginHooks !== 'object') {
    throw new Error('Plugin must have a hooks object');
  }
  
  for (const [hookName, fn] of Object.entries(pluginHooks)) {
    on(hookName, fn, { name: `${name}:${hookName}`, priority });
  }
}

/**
 * Remove all hooks for a plugin.
 * @param {string} pluginName
 */
export function unregisterPlugin(pluginName) {
  for (const [hookName, list] of hooks.entries()) {
    hooks.set(hookName, list.filter(h => !h.name.startsWith(`${pluginName}:`)));
  }
}

/**
 * List all registered hooks (for debugging).
 * @returns {object} Map of hookName → handler names
 */
export function list() {
  const result = {};
  for (const [hookName, list] of hooks.entries()) {
    if (list.length > 0) {
      result[hookName] = list.map(h => ({ name: h.name, priority: h.priority }));
    }
  }
  return result;
}

/**
 * Clear all hooks (for testing).
 */
export function clear() {
  hooks.clear();
}

// ─── Built-in Plugins ───

/**
 * Logging plugin — logs pipeline stages to console.
 */
export const loggingPlugin = {
  name: 'forge-logger',
  priority: 1,
  hooks: {
    beforeContext(state) {
      console.log(`⚡ [context] Gathering signals for: "${state.prompt?.slice(0, 50)}..."`);
    },
    afterEnhance(state) {
      console.log(`✨ [enhance] RUNE enhanced prompt (${state.enhancedPrompt?.length || 0} chars)`);
    },
    beforeGenerate(state) {
      console.log(`🔥 [generate] Sending to ${state.model || 'default'}...`);
    },
    afterValidate(state) {
      const score = state.validation?.total || state.validation?.score || 0;
      console.log(`📊 [validate] Spinoza score: ${(score * 100).toFixed(0)}%`);
    },
    onError(state) {
      console.error(`❌ [${state._failedHook}] ${state._currentError?.message}`);
    },
  },
};

/**
 * Timing plugin — tracks duration of each pipeline stage.
 */
export const timingPlugin = {
  name: 'forge-timer',
  priority: 0,
  hooks: {
    beforeContext(state) { state._timings = { contextStart: Date.now() }; },
    afterContext(state) { state._timings.contextMs = Date.now() - state._timings.contextStart; },
    beforeEnhance(state) { state._timings.enhanceStart = Date.now(); },
    afterEnhance(state) { state._timings.enhanceMs = Date.now() - state._timings.enhanceStart; },
    beforeGenerate(state) { state._timings.generateStart = Date.now(); },
    afterGenerate(state) { state._timings.generateMs = Date.now() - state._timings.generateStart; },
    beforeValidate(state) { state._timings.validateStart = Date.now(); },
    afterValidate(state) { state._timings.validateMs = Date.now() - state._timings.validateStart; },
  },
};
