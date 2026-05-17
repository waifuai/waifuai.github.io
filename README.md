# waifuai.github.io

Monorepo for [WaifuAI](https://waifuai.github.io) — an open-source ecosystem of AI tools, Solana blockchain infrastructure, MCP servers, NLP/paraphrase systems, and interactive web applications. All subprojects are published as GitHub Pages at `waifuai.github.io`.

## Categories

### AI / LLM Infrastructure
| Project | Description |
|---|---|
| [ai-benchmarks](ai-benchmarks/) | LLM spatial reasoning evaluation (Maze Gauntlet) with leaderboard and OpenRouter multi-model testing |
| [llm-text-queue-gpu](llm-text-queue-gpu/) | Redis-backed async text generation queue for LLM inference via OpenRouter |
| [macro-language-model](macro-language-model/) | CLI chatbot with modular personality system (tsundere, deredere, etc.) |
| [book-generator](book-generator/) | Full book generator from a title prompt using OpenRouter |
| [llms-full-html](llms-full-html/) | Aggregated HTML documentation bundles optimized for LLM ingestion |
| [llms-full-txt](llms-full-txt/) | Markdown code aggregation with TOC and line counting |
| [biochem-framework](biochem-framework/) | AI conversation benchmark scoring by estimated neurochemical impact |

### Waifu / AI Companion
| Project | Description |
|---|---|
| [hermes-waifu](hermes-waifu/) | Live2D animated waifu with expression controls and Hermes Agent integration |
| [waifu-chat-api](waifu-chat-api/) | REST API for waifu chatbot conversations with user management |
| [waifu-constitution](waifu-constitution/) | AI alignment constitution and behavioral guidelines for waifu agents |
| [waifu-layer](waifu-layer/) | Personality trait layering system for LLM waifu responses |
| [waifu-llm-vrm](waifu-llm-vrm/) | Python library (`pywaifu`) for Godot engine AI waifus with VRM support |
| [anime-subtitle-chatbot](anime-subtitle-chatbot/) | Few-shot chatbot trained on anime subtitles |

### MCP Servers (Model Context Protocol)
| Project | Description |
|---|---|
| [mcp-waifu-chat](mcp-waifu-chat/) | Conversational AI waifu with SQLite history (FastMCP) |
| [mcp-waifu-queue](mcp-waifu-queue/) | Redis-backed async job queue for text generation |
| [mcp-traits-matcher](mcp-traits-matcher/) | Personality analysis with Euclidean distance matching |
| [mcp-solana-affiliate](mcp-solana-affiliate/) | Solana ICO affiliate program with Blink URL generation |
| [mcp-solana-dex](mcp-solana-dex/) | Basic Solana DEX order book management |
| [mcp-solana-ico](mcp-solana-ico/) | Solana ICO with bonding curves, buy/sell, and discounts |
| [mcp-solana-internet](mcp-solana-internet/) | Pay-to-access payment system with expiry |

### Solana / Blockchain
| Project | Description |
|---|---|
| [solana-launchpad-ecosystem](solana-launchpad-ecosystem/) | Multi-program Rust ecosystem for AI-driven tokenomics |
| [solana-ico](solana-ico/) | Python CLI for ContextCoin ICO with linear bonding curves |
| [launchpad-skill](launchpad-skill/) | Rust CLI for managing tokenized companies on Solana |
| [sim-bonding-curve](sim-bonding-curve/) | Agent-based bonding curve token economy simulations |
| [sim-airdrop](sim-airdrop/) | Airdrop strategy simulation with tiered/lottery/uniform distributions |
| [sim-affiliate](sim-affiliate/) | Token economy simulation with affiliate dynamics |
| [sim-mcp-token](sim-mcp-token/) | Multi-agent economic simulation with resource ecosystems |
| [reasoning-pricer](reasoning-pricer/) | AI-accelerated predictive pricing for Solana tokens |
| [crypto-simulation](crypto-simulation/) | Unified mathematical theory of token economy simulations |

### NLP / Paraphrase Generation
| Project | Description |
|---|---|
| [paraphrase-generation](paraphrase-generation/) | Core paraphrase generation library |
| [paraphrase-gan](paraphrase-gan/) | GAN-style paraphrase refinement loop via OpenRouter |
| [paraphrase-gan-utils](paraphrase-gan-utils/) | Production paraphrase system with caching and REST API |
| [paraphrase-back-translate](paraphrase-back-translate/) | Back-translation paraphrase generation |
| [paraphrase-neural-machine-translation](paraphrase-neural-machine-translation/) | TensorFlow 2.x seq2seq NMT with Luong attention |
| [paraphrase-human-sentence-classifier](paraphrase-human-sentence-classifier/) | Human vs. AI sentence classifier |

### Research & Documentation
| Project | Description |
|---|---|
| [research-books](research-books/) | 14+ academic books on quantum biology, bonding curves, waifu AI, and more |
| [research-text](research-text/) | Research docs on tokenomics, quantum computing, and Solana |
| [blog-posts](blog-posts/) | Ecosystem blog articles and announcements |

### Web Applications
| Project | Description |
|---|---|
| [web-apps](web-apps/) | 40+ interactive browser apps including token simulators, MCP tutorials, and waifu chat |
| [function-graph-generator](function-graph-generator/) | Visual mathematical function call graphs |

### Utilities
| Project | Description |
|---|---|
| [street-lines](street-lines/) | Parking rectangle generation algorithms from geospatial coordinates |
| [ransoc](ransoc/) | RANSOC — real-time curiosity-driven search relevance algorithm |
| [traits](traits/) | Personality trait analysis and scoring system |
| [quantum-circuit-optimization](quantum-circuit-optimization/) | Quantum circuit optimization library |

## Tech Stack

- **Python** — dominant language across ~85% of projects (with Poetry/uv for dependency management)
- **Rust** — Solana blockchain programs and CLI tools
- **JavaScript/HTML/CSS** — frontend apps and documentation pages
- **TensorFlow 2.x** — neural machine translation models
- **OpenRouter API** — universal AI provider across all LLM projects
- **FastMCP** — MCP server framework for all protocol servers
- **SQLite / Redis / JSON** — data storage and queuing
- **pytest / ruff / mypy / black** — testing and code quality

## License

MIT-0 (No Attribution) — see [LICENSE](LICENSE).

Deployed at **[waifuai.github.io](https://waifuai.github.io)**
