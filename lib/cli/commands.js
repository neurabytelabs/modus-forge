/**
 * CLI Subcommand Router — IT-15 Reflection Sprint
 * 
 * Unified entry point for all Forge capabilities:
 *   forge "prompt"       → Generate app (default)
 *   forge serve          → Start preview server
 *   forge grimoire       → Manage prompt library
 *   forge recipe         → Run multi-step recipes
 *   forge evolve         → Genetic prompt evolution
 *   forge analytics      → Quality insights from history
 *   forge skills         → List/run installed skills
 */

const SUBCOMMANDS = {
  serve: {
    description: 'Start the live preview server',
    module: '../../bin/forge-serve.js',
  },
  grimoire: {
    description: 'Manage prompt library (list|save|search|fav)',
    handler: grimoire,
  },
  recipe: {
    description: 'Run multi-step generation recipes',
    handler: recipe,
  },
  evolve: {
    description: 'Genetic prompt evolution (tournament selection)',
    handler: evolve,
  },
  analytics: {
    description: 'Quality insights from forge history',
    handler: analytics,
  },
  skills: {
    description: 'List and run installed skills',
    handler: skills,
  },
};

export function parseCommand(args) {
  const first = args[0] || '';
  if (SUBCOMMANDS[first]) {
    return { command: first, args: args.slice(1) };
  }
  return { command: 'forge', args };
}

export function showHelp() {
  console.log('\n🔥 MODUS Forge — Subcommands:\n');
  console.log('  forge "prompt"         Generate an app (default)');
  for (const [name, cmd] of Object.entries(SUBCOMMANDS)) {
    console.log(`  forge ${name.padEnd(18)} ${cmd.description}`);
  }
  console.log('\nRun `forge <command> --help` for details.\n');
}

async function grimoire(args) {
  const { GrimoireStore } = await import('../grimoire/store.js');
  const store = new GrimoireStore();
  const action = args[0] || 'list';

  switch (action) {
    case 'list': {
      const entries = store.list();
      if (entries.length === 0) {
        console.log('📚 Grimoire is empty. Save prompts with: forge grimoire save "prompt"');
        return;
      }
      console.log(`\n📚 Grimoire — ${entries.length} entries:\n`);
      for (const e of entries.slice(0, 20)) {
        const fav = e.favorite ? '⭐' : '  ';
        const score = e.bestScore ? ` (${(e.bestScore * 100).toFixed(0)}%)` : '';
        console.log(`  ${fav} ${e.intent}${score}`);
        if (e.tags?.length) console.log(`     🏷️  ${e.tags.join(', ')}`);
      }
      break;
    }
    case 'save': {
      const intent = args.slice(1).join(' ');
      if (!intent) { console.log('Usage: forge grimoire save "your prompt"'); return; }
      store.save({ intent, tags: [], favorite: false });
      console.log(`✅ Saved to grimoire: "${intent}"`);
      break;
    }
    case 'search': {
      const query = args.slice(1).join(' ');
      const results = store.search(query);
      console.log(`\n🔍 Found ${results.length} matches:\n`);
      for (const e of results) console.log(`  • ${e.intent}`);
      break;
    }
    case 'fav': {
      const query = args.slice(1).join(' ');
      const found = store.search(query)[0];
      if (found) { store.favorite(found.id); console.log(`⭐ Favorited: "${found.intent}"`); }
      else console.log('Not found.');
      break;
    }
    default:
      console.log('Usage: forge grimoire [list|save|search|fav] [args]');
  }
}

async function recipe(args) {
  const { RecipeEngine } = await import('../recipe/engine.js');
  const engine = new RecipeEngine();
  const file = args[0];
  if (!file) {
    console.log('Usage: forge recipe <recipe.json> [--model gemini]');
    console.log('\nRecipe files define multi-step generation workflows.');
    return;
  }
  const { readFileSync } = await import('node:fs');
  const spec = JSON.parse(readFileSync(file, 'utf-8'));
  console.log(`\n🧪 Running recipe: ${spec.name || file}\n`);
  const result = await engine.run(spec, { model: args.includes('--model') ? args[args.indexOf('--model') + 1] : 'gemini' });
  console.log(`\n✅ Recipe complete — ${result.steps?.length || 0} steps executed`);
}

async function evolve(args) {
  const { GeneticEvolver } = await import('../iterate/genetic.js');
  const prompt = args.join(' ');
  if (!prompt) {
    console.log('Usage: forge evolve "base prompt" [--generations 5] [--population 4]');
    return;
  }
  const gens = args.includes('--generations') ? parseInt(args[args.indexOf('--generations') + 1]) : 3;
  const pop = args.includes('--population') ? parseInt(args[args.indexOf('--population') + 1]) : 4;
  
  console.log(`\n🧬 Evolving: "${prompt}"`);
  console.log(`   Generations: ${gens}, Population: ${pop}\n`);
  
  const evolver = new GeneticEvolver({ generations: gens, populationSize: pop });
  const result = await evolver.evolve(prompt);
  console.log(`\n🏆 Best evolved prompt (score: ${(result.bestScore * 100).toFixed(0)}%):`);
  console.log(`   ${result.bestPrompt}`);
}

async function analytics(args) {
  const { analyzeHistory } = await import('../analytics/insights.js');
  const insights = analyzeHistory();
  
  console.log('\n📊 Forge Analytics\n');
  console.log(`Total forges: ${insights.totalForges}`);
  console.log(`Average score: ${(insights.avgScore * 100).toFixed(0)}%`);
  console.log(`Best provider: ${insights.bestProvider?.name || 'N/A'} (${((insights.bestProvider?.avgScore || 0) * 100).toFixed(0)}%)`);
  console.log(`Quality trend: ${insights.trend}`);
  
  if (insights.topPrompts.length) {
    console.log('\n⭐ Top prompts:');
    for (const p of insights.topPrompts.slice(0, 5)) {
      console.log(`  ${(p.score * 100).toFixed(0)}% — ${p.intent}`);
    }
  }
  
  if (insights.recommendations.length) {
    console.log('\n💡 Recommendations:');
    for (const r of insights.recommendations) console.log(`  • ${r}`);
  }
}

async function skills(args) {
  const { listSkills, runSkill } = await import('../skills/loader.js');
  const action = args[0] || 'list';
  
  if (action === 'list') {
    const installed = await listSkills();
    console.log(`\n🔌 Installed Skills (${installed.length}):\n`);
    for (const s of installed) {
      console.log(`  ${s.emoji || '📦'} ${s.name.padEnd(20)} ${s.description}`);
    }
  } else if (action === 'run') {
    const name = args[1];
    if (!name) { console.log('Usage: forge skills run <skill-name> [args]'); return; }
    const result = await runSkill(name, args.slice(2));
    console.log(result);
  }
}

export { SUBCOMMANDS };
