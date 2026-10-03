# waifuai.github.io

Monorepo for [WaifuAI](https://waifuai.github.io) — an open-source ecosystem of AI companion code, LLM tools, MCP servers, NLP/paraphrase systems, and research. All subprojects are published as GitHub Pages at `waifuai.github.io`.

## Categories

### AI / LLM Infrastructure
| Project | Description |
|---|---|
| [ai-benchmarks](ai-benchmarks/) | LLM spatial reasoning evaluation (Maze Gauntlet) with leaderboard and OpenRouter multi-model testing |
| [llm-text-queue-gpu](llm-text-queue-gpu/) | Redis-backed async text generation queue for LLM inference via OpenRouter |
| [macro-language-model](macro-language-model/) | CLI chatbot with modular personality system (tsundere, deredere, etc.) |
| [book-generator](book-generator/) | Full book generator from a title prompt using OpenRouter |
| [llms-full-html](llms-full/#html) | Aggregated HTML documentation bundles optimized for LLM ingestion |
| [llms-full-txt](llms-full/#txt) | Markdown code aggregation with TOC and line counting |
| [biochem-framework](biochem-framework/) | AI conversation benchmark scoring by estimated neurochemical impact |

### Waifu / AI Companion
| Project | Description |
|---|---|
| [waifu-sprites](waifu-sprites/) | Browser app: chat with an animated video companion (12 states, 12 emotions) |
| [hermes-waifu](hermes-waifu/) | Live2D animated waifu with expression controls and Hermes Agent integration |
| [waifu-chat-api](waifu-chat-api/) | REST API for waifu chatbot conversations with user management |
| [waifu-constitution](waifu-constitution/) | AI alignment constitution and behavioral guidelines for waifu agents |
| [waifu-llm-vrm](waifu-llm-vrm/) | Python library (`pywaifu`) for Godot engine AI waifus with VRM support |
| [anime-subtitle-chatbot](anime-subtitle-chatbot/) | Few-shot chatbot trained on anime subtitles |

### MCP Servers (Model Context Protocol)
| Project | Description |
|---|---|
| [mcp-waifu-chat](mcp-servers/#chat) | Conversational AI waifu with SQLite history (FastMCP) |
| [mcp-waifu-queue](mcp-servers/#queue) | Redis-backed async job queue for text generation |
| [mcp-traits-matcher](mcp-servers/#traits-matcher) | Personality analysis with Euclidean distance matching |

### NLP / Paraphrase Generation
| Project | Description |
|---|---|
| [paraphrase-generation](paraphrase/#suite) | Core paraphrase generation library |
| [paraphrase-gan](paraphrase/#gan) | GAN-style paraphrase refinement loop via OpenRouter |
| [paraphrase-gan-utils](paraphrase/#gan-utils) | Production paraphrase system with caching and REST API |
| [paraphrase-back-translate](paraphrase/#back-translate) | Back-translation paraphrase generation |
| [paraphrase-neural-machine-translation](paraphrase/#nmt) | TensorFlow 2.x seq2seq NMT with Luong attention |
| [paraphrase-human-sentence-classifier](paraphrase/#classifier) | Human vs. AI sentence classifier |

### Research & Documentation
| Project | Description |
|---|---|
| [research-text](research-text/) | Research docs on kinematics, quantum computing, and AI agents |
| [blog-posts](blog-posts/) | Ecosystem blog articles and announcements |

### Web Applications
| Project | Description |
|---|---|
| [function-graph-generator](function-graph-generator/) | Visual mathematical function call graphs |

### Utilities
| Project | Description |
|---|---|
| [street-lines](street-lines/) | Parking rectangle generation algorithms from geospatial coordinates |
| [ransoc](ransoc/) | RANSOC — real-time curiosity-driven search relevance algorithm |
| [traits](traits/) | Personality trait analysis and scoring system |
| [quantum-circuit-optimization](quantum-circuit-optimization/) | Quantum circuit optimization library |

## Site infrastructure

| File | Purpose |
|---|---|
| [theme.css](theme.css) | Single shared stylesheet for every docs/content page |
| [search.html](search.html) | Client-side search over every page on the site |
| [search-index.json](search-index.json) | Generated index (title, path, section, description) — rebuild with `python tools/build-search-index.py` |
| [404.html](404.html) | Themed not-found page served by GitHub Pages |
| sitemap.xml, sitemap-main.xml | Sitemap index and every indexable page outside llm-countdowns — rebuild with `python tools/build_sitemap.py` |
| sitemap-countdowns.xml | LLM Countdowns pages, written by all-db's `export-countdowns` |

After adding, moving or deleting a page, run these from the repo root:

```bash
python tools/related_links.py       # Related blocks, from the homepage groups
python tools/generate_og_cards.py   # link-preview cards
python tools/build_sitemap.py       # sitemap
python tools/build-search-index.py  # site search
```

Moved pages keep a small redirect stub (noindex, meta refresh) at the old address; the sitemap and search skip them.

## Tech Stack

- **Python** — dominant language across ~85% of projects (with Poetry/uv for dependency management)
- **Rust** — CLI tools
- **JavaScript/HTML/CSS** — frontend apps and documentation pages
- **TensorFlow 2.x** — neural machine translation models
- **OpenRouter API** — universal AI provider across all LLM projects
- **FastMCP** — MCP server framework for all protocol servers
- **SQLite / Redis / JSON** — data storage and queuing
- **pytest / ruff / mypy / black** — testing and code quality

## License

MIT-0 (No Attribution) — see [LICENSE](LICENSE).

Deployed at **[waifuai.github.io](https://waifuai.github.io)**
