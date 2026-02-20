# 🔥 MODUS Forge

**Speak it. See it. Use it.**

> "The App Store is dead. The future is ephemeral, personal software forged by AI in seconds."
> — Inspired by [Andrej Karpathy's vision](https://x.com/kaborothy/status/...)

MODUS Forge turns a single sentence into a fully functional, personal dashboard — no app store, no downloads, no subscriptions. Just your intent, your data, your app.

```bash
modus-forge "Track my cardio for 8 weeks"
```

→ Generates a complete, self-contained HTML dashboard  
→ Connects to your sensor APIs (Apple Health, Garmin, Woodway...)  
→ Opens in your browser, ready to use  
→ Yours. Not a template. Not a generic app. **Yours.**

## How It Works

```
You → "Track my cardio for 8 weeks"
         ↓
    RUNE Engine (prompt enrichment + 8-layer framework)
         ↓
    Context Layer (your data, preferences, connected APIs)
         ↓
    LLM Generation (Gemini / Claude / GPT)
         ↓
    Spinoza Validator (quality control: Conatus, Ratio, Laetitia, Natura)
         ↓
    index.html → open in browser 🚀
```

## Philosophy

Every app is a **modus** — a mode of existence, unique to the person who needs it. 

We don't believe in one-size-fits-all software. We believe in software that exists only because *you* need it, shaped by *your* context, and disposable when you don't.

*"God is Nature" — Spinoza*  
*Your intent is the app. The app is the intent.*

## Features

- 🧠 **RUNE-Powered** — Prompts are enhanced through an 8-layer framework before hitting the LLM
- 🔌 **Sensor Discovery** — Auto-detects and integrates available APIs (health, fitness, finance, weather, IoT...)
- 🎨 **Beautiful by Default** — Dark cyberpunk aesthetic, data-dense, interactive dashboards
- ✅ **Spinoza Validated** — Every output is checked for actionability, logic, beauty, and naturalness
- 📦 **Zero Dependencies** — Single HTML file, works offline, double-click to open
- 🔒 **Private** — Runs locally. Your data stays yours.

## Quick Start

```bash
# Install
npm install -g modus-forge

# Forge your first app
modus-forge "Track my daily water intake"
modus-forge "Monitor my portfolio: AAPL, TSLA, BTC"
modus-forge "Plan my 8-week marathon training"
modus-forge "Dashboard for my home energy usage"

# With options
modus-forge "Track my sleep" --model gemini-3-pro --style minimal
modus-forge "Budget tracker" --connect "bank-api" --lang tr
```

## Architecture

```
modus-forge/
├── bin/                  # CLI entry point
│   └── forge.js
├── lib/
│   ├── rune/             # RUNE prompt engine
│   │   ├── enhancer.js   # 8-layer prompt enrichment
│   │   └── validator.js  # Spinoza quality control
│   ├── context/          # Personal context layer
│   │   ├── sensors.js    # API/sensor discovery
│   │   └── profile.js    # User preferences & history
│   ├── generators/       # LLM code generation
│   │   ├── gemini.js
│   │   ├── claude.js
│   │   └── openai.js
│   └── renderer/         # Output formatting
│       ├── html.js       # Single-file HTML builder
│       └── preview.js    # Browser preview launcher
├── templates/            # Base design system templates
│   ├── dashboard.html
│   ├── tracker.html
│   └── monitor.html
├── skills/               # Sensor integration skills
│   ├── health/           # Apple Health, Garmin, Fitbit...
│   ├── finance/          # Portfolio, banking APIs...
│   ├── iot/              # Smart home, energy...
│   └── custom/           # User-added integrations
├── package.json
└── README.md
```

## The Vision

Andrej Karpathy said it best: a cardio experiment tracker is ~300 lines of code. There will never be (and shouldn't be) a specific app store entry for it. 

**MODUS Forge is the missing layer:**

| Yesterday | Today | Tomorrow (Forge) |
|-----------|-------|-------------------|
| Search app store | Vibe code for 1 hour | "Track my cardio" → done in 60 seconds |
| Download generic app | Fix bugs manually | RUNE validates automatically |
| Adapt to the app | Reverse-engineer APIs | Sensors discovered & connected |
| Data in their cloud | Data in your HTML | Data stays local |

The industry needs to reconfigure into **AI-native sensors & actuators**. Until then, Forge bridges the gap — reverse-engineering APIs so you don't have to.

## Built With

- [RUNE](https://github.com/neurabytelabs/rune) — Prompt engineering framework ("Every prompt is a spell")
- [MODUS](https://github.com/neurabytelabs/modus) — Universe simulation platform (Spinoza philosophy)
- [OpenClaw](https://github.com/openclaw/openclaw) — AI agent orchestration

## Roadmap

- [x] Concept & architecture
- [ ] CLI MVP (single prompt → HTML)
- [ ] RUNE integration (prompt enrichment)
- [ ] Sensor discovery (Apple Health, Garmin)
- [ ] Template library (dashboard, tracker, monitor)
- [ ] Spinoza validation loop
- [ ] Multi-LLM support (Gemini, Claude, GPT)
- [ ] Persistent apps (auto-update, live data)
- [ ] Community skills marketplace

## NeuraByte Labs

**"Where Spinoza Meets Silicon"**

MODUS Forge is a [NeuraByte Labs](https://neurabytelabs.com) project.

## License

MIT
