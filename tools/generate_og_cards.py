"""Link-preview cards (1200x630 PNG) for project landing pages and blog posts.

Same look as the llm-countdowns cards: dark background, colored bar, small label, big title,
accent tagline. Card text is fixed (no counts or dates), so a card only changes when its entry
here changes, and rendering is deterministic so unchanged cards stay out of git.

Each page's og:image / twitter:image is pointed at its card with a ?v=<content hash> so
Discord and X refetch it when it changes. Pages without preview tags get them added.

Needs Pillow and Segoe UI (C:\\Windows\\Fonts). Run from anywhere:
    python tools/generate_og_cards.py
"""
import hashlib
import html
import io
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SITE_URL = "https://waifuai.github.io/"

WIDTH, HEIGHT = 1200, 630
FONT_DIR = Path(r"C:\Windows\Fonts")
REGULAR, SEMIBOLD, BOLD = FONT_DIR / "segoeui.ttf", FONT_DIR / "seguisb.ttf", FONT_DIR / "segoeuib.ttf"
BG, TEXT, MUTED, ACCENT = "#0f0f10", "#ececea", "#a3a39e", "#8cabff"
LEFT = 80
MAX_W = WIDTH - 2 * LEFT

# Project landing pages: directory -> (name, tagline). Keep taglines free of counts and dates.
PROJECTS = {
    "ai-benchmarks": ("AI Benchmarks", "Maze Gauntlet spatial reasoning tests"),
    "anime-subtitle-chatbot": ("Anime Subtitle Chatbot", "Replies learned from anime dialogue"),
    "biochem-framework": ("Biochem Framework", "AI chats scored by neurochemical impact"),
    "blog-posts": ("WaifuAI Blog", "Guides, architecture and ideas"),
    "book-generator": ("Book Generator", "Whole books from a single title"),
    "cat-maze": ("Cat Maze", "Retro puzzle game with a level editor"),
    "crypto-simulation": ("Crypto Simulation", "Token economy simulation docs"),
    "function-graph-generator": ("Function Graph Generator", "Call graphs for Python code"),
    "hermes-waifu": ("Hermes Waifu", "Live2D companion for Hermes Agent"),
    "launchpad-skill": ("Launchpad Skill", "Solana token CLI for AI agents"),
    "llm-text-queue-gpu": ("LLM Text Queue", "Redis-backed GPU inference queue"),
    "llms-full-html": ("llms-full.html", "Site docs that LLMs can read"),
    "llms-full-txt": ("llms-full.txt", "Generators and utilities"),
    "macro-language-model": ("Macro Language Model", "Chatbot with modular personalities"),
    "mcp-solana-affiliate": ("MCP Solana Affiliate", "Blink URLs for token promotion"),
    "mcp-solana-dex": ("MCP Solana DEX", "Order book server over MCP"),
    "mcp-solana-ico": ("MCP Solana ICO", "Bonding curve token sales over MCP"),
    "mcp-solana-internet": ("MCP Solana Internet", "Pay-to-access with expiring tokens"),
    "mcp-traits-matcher": ("MCP Traits Matcher", "Personality matching over MCP"),
    "mcp-waifu-chat": ("MCP Waifu Chat", "Companion chat server with memory"),
    "mcp-waifu-queue": ("MCP Waifu Queue", "Async text generation over MCP"),
    "paraphrase-back-translate": ("Back-Translation Paraphraser", "Paraphrases via other languages"),
    "paraphrase-gan": ("Paraphrase GAN", "Generator and classifier refinement loop"),
    "paraphrase-gan-utils": ("Paraphrase GAN Utils", "Batch paraphrasing with a REST API"),
    "paraphrase-generation": ("Paraphrase Generation", "Core paraphrasing library"),
    "paraphrase-human-sentence-classifier": ("Human Sentence Classifier", "Was it written by a human or an AI?"),
    "paraphrase-neural-machine-translation": ("NMT Paraphraser", "Seq2seq paraphrasing in TensorFlow"),
    "quantum-circuit-optimization": ("Quantum Circuit Optimization", "Gate and depth reduction tools"),
    "ransoc": ("RANSOC", "Adaptive normalization for curiosity"),
    "reasoning-pricer": ("Reasoning Pricer", "AI price predictions for Solana tokens"),
    "research-books": ("Research Books", "Open-access academic volumes"),
    "research-text": ("Research Papers", "Papers, derivations and reports"),
    "sim-affiliate": ("Affiliate Simulation", "Token economy with affiliate dynamics"),
    "sim-airdrop": ("Airdrop Simulator", "Compare token airdrop strategies"),
    "sim-bonding-curve": ("Bonding Curve Simulator", "Agent-based token economy"),
    "sim-mcp-token": ("Agent Economy Simulation", "Resource ecosystems and price dynamics"),
    "solana-ico": ("ContextCoin ICO", "Solana CLI with linear bonding curves"),
    "solana-launchpad-ecosystem": ("Solana Launchpad Ecosystem", "AI bots driving on-chain tokenomics"),
    "street-lines": ("Street Lines", "Proofs for the parking rectangle algorithm"),
    "traits": ("Traits", "Personality trait analysis"),
    "waifu-chat-api": ("Waifu Chat API", "REST API for companion chat"),
    "waifu-constitution": ("Waifu Constitution", "Alignment principles for companions"),
    "waifu-layer": ("Waifu Layer", "An L1 blockchain for AI agents"),
    "waifu-llm-vrm": ("Waifu LLM VRM", "Godot AI companions with VRM models"),
    "web-apps": ("Web Apps", "Interactive tools that run in the browser"),
}
# Root-level pages: file -> (name, tagline). Cards go in og/.
ROOT_PAGES = {
    "links.html": ("Links", "Referral credits for AI tools"),
}


# ---------------------------------------------------------------------------
# Drawing
# ---------------------------------------------------------------------------

def _font(path, size):
    return ImageFont.truetype(str(path), size)


def _wrap(draw, text, font, max_width):
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if line and draw.textlength(trial, font=font) > max_width:
            lines.append(line)
            line = word
        else:
            line = trial
    return lines + [line] if line else lines


def _fit_lines(draw, text, path, sizes, max_lines):
    """First size in sizes at which text wraps into at most max_lines lines."""
    for size in sizes:
        font = _font(path, size)
        lines = _wrap(draw, text, font, MAX_W)
        if len(lines) <= max_lines:
            return font, size, lines
    return font, size, lines[:max_lines]


def render(label, title, tagline=None):
    """PNG bytes: label, title (up to 3 lines), optional accent tagline, vertically centered."""
    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 11, HEIGHT], fill=ACCENT)

    t_font, t_size, t_lines = _fit_lines(d, title, BOLD, (108, 96, 84, 76, 68), 2 if tagline else 3)
    blocks = [(34, int(34 * 1.5), [label], REGULAR, MUTED)]
    blocks.append((t_size, int(t_size * 1.12), t_lines, BOLD, TEXT))
    if tagline:
        g_font, g_size, g_lines = _fit_lines(d, tagline, SEMIBOLD, (60, 54, 48), 2)
        blocks.append((g_size, int(g_size * 1.25), g_lines, SEMIBOLD, ACCENT))

    gap = 36
    height = sum(lh * len(lines) for _, lh, lines, _, _ in blocks) + gap * (len(blocks) - 1)
    y = (HEIGHT - height) // 2
    for i, (size, lh, lines, path, color) in enumerate(blocks):
        font = _font(path, size)
        for line in lines:
            if i == 0:
                d.ellipse([LEFT, y + lh // 2 - 11, LEFT + 22, y + lh // 2 + 11], fill=ACCENT)
                d.text((LEFT + 36, y + lh // 2), line, font=font, fill=MUTED, anchor="lm")
            else:
                d.text((LEFT - (4 if path == BOLD else 2), y + lh * 0.8), line, font=font, fill=color, anchor="ls")
            y += lh
        y += gap

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------

def write_png(path, png):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.is_file() or path.read_bytes() != png:
        path.write_bytes(png)


def set_preview(page, image_url):
    """Point a page's og:image and twitter:image at image_url, adding tags that are missing."""
    with open(page, encoding="utf-8", newline="") as f:  # keep CRLF files CRLF
        src = f.read()
    nl = "\r\n" if "\r\n" in src else "\n"
    s = src
    og = f'<meta property="og:image" content="{image_url}">'
    tw = f'<meta name="twitter:image" content="{image_url}">'
    size = (f'<meta property="og:image:width" content="{WIDTH}">{nl}'
            f'<meta property="og:image:height" content="{HEIGHT}">')

    s = re.sub(r'[ \t]*<meta property="og:image:(width|height)"[^>]*>\r?\n', "", s)
    if re.search(r'<meta property="og:image" content="[^"]*">', s):
        s = re.sub(r'(?m)^([ \t]*)<meta property="og:image" content="[^"]*">',
                   lambda m: f"{m[1]}{og}{nl}{m[1]}{size.replace(nl, nl + m[1])}", s, count=1)
    else:
        s = re.sub(r"(?m)^([ \t]*)</head>", lambda m: f"{m[1]}{og}{nl}{m[1]}{size.replace(nl, nl + m[1])}{nl}{m[1]}</head>", s, count=1)
    if re.search(r'<meta name="twitter:image" content="[^"]*">', s):
        s = re.sub(r'<meta name="twitter:image" content="[^"]*">', tw, s, count=1)
    else:
        if '<meta name="twitter:card"' not in s:
            s = re.sub(r"(?m)^([ \t]*)</head>",
                       lambda m: f'{m[1]}<meta name="twitter:card" content="summary_large_image">{nl}{m[1]}</head>', s, count=1)
        s = re.sub(r'(?m)^([ \t]*)(<meta name="twitter:card"[^>]*>)', lambda m: f"{m[1]}{m[2]}{nl}{m[1]}{tw}", s, count=1)

    if s != src:
        page.write_text(s, encoding="utf-8", newline="")
    return s != src


def publish(page, card, label, title, tagline=None):
    png = render(label, title, tagline)
    write_png(card, png)
    version = hashlib.sha256(png).hexdigest()[:10]
    url = f"{SITE_URL}{card.relative_to(ROOT).as_posix()}?v={version}"
    return set_preview(page, url)


def blog_title(page):
    m = re.search(r"<title>(.*?)</title>", page.read_text(encoding="utf-8"), re.S)
    return html.unescape(m[1]).rsplit(" | ", 1)[0].strip()


def main():
    jobs = []
    for slug, (name, tagline) in PROJECTS.items():
        jobs.append((ROOT / slug / "index.html", ROOT / slug / "og.png", "WaifuAI", name, tagline))
    for file, (name, tagline) in ROOT_PAGES.items():
        jobs.append((ROOT / file, ROOT / "og" / file.replace(".html", ".png"), "WaifuAI", name, tagline))
    for page in sorted((ROOT / "blog-posts").glob("[0-9]*.html")):
        jobs.append((page, ROOT / "blog-posts" / "og" / page.with_suffix(".png").name, "WaifuAI Blog", blog_title(page), None))

    changed = sum(publish(*job) for job in jobs)
    print(f"{len(jobs)} cards, {changed} pages updated")


if __name__ == "__main__":
    main()
