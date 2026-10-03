"""Add a "Related" block of internal links to project pages and blog posts.

Relatedness comes from the homepage: pages whose cards share a group on index.html are related,
plus the hand-picked cross-group links in EXTRA. Titles and descriptions are taken from the
homepage cards, so editing a card there and re-running this updates every block that links to it.
Blog posts outside the homepage groups link to their neighbouring posts instead.

The block sits between <!-- related --> and <!-- /related --> just before the page footer and is
replaced on every run, so the script is safe to re-run. Run from anywhere:
    python tools/related_links.py
"""
import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MAX_LINKS = 6

# Cross-group links: page -> pages to add after its group-mates.
EXTRA = {
    "ai-benchmarks/": ["llm-countdowns/", "cat-maze/", "research-text/"],
    "biochem-framework/": ["waifu-constitution/", "ai-benchmarks/"],
    "book-generator/": ["research-text/", "paraphrase/"],
    "cat-maze/": ["ai-benchmarks/"],
    "hermes-waifu/": ["waifu-sprites/", "blog-posts/11-how-to-add-your-own-live2d-avatar.html", "mcp-servers/"],
    "llm-text-queue-gpu/": ["mcp-servers/"],
    "llms-full/": ["function-graph-generator/", "research-text/"],
    "mcp-servers/": ["traits/", "waifu-chat-api/", "llm-text-queue-gpu/", "hermes-waifu/"],
    "paraphrase/": ["anime-subtitle-chatbot/", "macro-language-model/", "book-generator/"],
    "research-text/": ["ai-benchmarks/", "book-generator/"],
    "traits/": ["mcp-servers/"],
    "waifu-chat-api/": ["mcp-servers/"],
    "waifu-constitution/": ["biochem-framework/"],
    "waifu-sprites/": ["hermes-waifu/", "ransoc/"],
    "ransoc/": ["waifu-sprites/"],
    "blog-posts/11-how-to-add-your-own-live2d-avatar.html": ["hermes-waifu/"],
}
# Names for pages that several homepage cards point into (one card per project on the page).
PAGE_CARDS = {
    "paraphrase/": ("Paraphrase projects", "Back-translation, a GAN-style prompt loop, an NMT model and a human vs AI classifier."),
    "mcp-servers/": ("MCP servers", "Companion chat, a Redis generation queue and personality matching over MCP."),
    "llms-full/": ("llms-full generators", "Bundle a project's docs and code into one file for LLMs."),
}
# Pages that are generated elsewhere or have no room for a block.
SKIP = {"llm-countdowns/", "cat-maze/"}

BLOCK = re.compile(r"[ \t]*<!-- related -->.*?<!-- /related -->\r?\n", re.S)


def homepage_groups():
    src = (ROOT / "index.html").read_text(encoding="utf-8")
    groups, cards = [], {}
    for body in re.findall(r'<section class="group" id="[^"]+">(.*?)</section>', src, re.S):
        pages = []
        for href, title, desc in re.findall(
                r'<a class="card" href="([^"]+)"><span class="card-title">(.*?)</span><span class="card-desc">(.*?)</span>', body, re.S):
            if re.match(r"[a-z]+:", href):
                continue
            page = href.split("#")[0]
            if not (page.endswith("/") or page.endswith(".html")):
                continue
            title = re.sub(r"<[^>]+>", "", title).strip()
            cards.setdefault(page, PAGE_CARDS.get(page, (title, desc)))
            if page not in pages:
                pages.append(page)
        groups.append(pages)
    return groups, cards


def page_file(page):
    return ROOT / (page + "index.html" if page.endswith("/") else page)


def blog_posts():
    posts = sorted(p for p in (ROOT / "blog-posts").glob("*.html") if re.match(r"\d", p.name))
    out = {}
    for p in posts:
        src = p.read_text(encoding="utf-8")
        title = html.unescape(re.search(r"<title>(.*?)</title>", src, re.S)[1]).rsplit(" | ", 1)[0].strip()
        d = re.search(r'<meta name="description" content="([^"]*)"', src)
        desc = html.unescape(d[1]).strip() if d else ""
        if len(desc) > 120:
            desc = desc[:117].rsplit(" ", 1)[0] + "..."
        out[f"blog-posts/{p.name}"] = (title, html.escape(desc))
    return out


def block(links, cards, nl):
    items = []
    for page in links:
        title, desc = cards[page]
        desc_html = f"<p>{desc}</p>" if desc else ""
        items.append(f'<a href="/{page}"><h3>{html.escape(html.unescape(title))}</h3>{desc_html}</a>')
    return nl.join(["<!-- related -->", "<section>", "<h2>Related</h2>", '<div class="link-list">',
                    *items, "</div>", "</section>", "<!-- /related -->"]) + nl


def apply(page, links, cards):
    path = page_file(page)
    with open(path, encoding="utf-8", newline="") as f:
        src = f.read()
    nl = "\r\n" if "\r\n" in src else "\n"
    s = BLOCK.sub("", src)
    if links:
        new = block(links, cards, nl)
        idx = s.rfind("<footer")
        if idx == -1:
            idx = s.rfind("</body>")
        line_start = s.rfind("\n", 0, idx) + 1
        if s[line_start:idx].strip() == "":
            idx = line_start
        s = s[:idx] + new + s[idx:]
    if s != src:
        with open(path, "w", encoding="utf-8", newline="") as f:
            f.write(s)
    return s != src


def main():
    groups, cards = homepage_groups()
    posts = blog_posts()
    for page, info in posts.items():
        cards.setdefault(page, info)
    related = {}
    for pages in groups:
        for page in pages:
            mates = [p for p in pages if p != page]
            related.setdefault(page, [])
            for p in EXTRA.get(page, []) + mates:
                if p not in related[page]:
                    related[page].append(p)
    for page, extra in EXTRA.items():
        related.setdefault(page, list(extra))
    order = list(posts)
    for i, page in enumerate(order):
        if page not in related or not related[page]:
            related[page] = [p for p in (order[i - 1] if i else None, order[i + 1] if i + 1 < len(order) else None) if p]
            related[page].append("blog-posts/")
    cards.setdefault("blog-posts/", ("All articles", "Guides, architecture notes and ideas from the WaifuAI blog."))

    changed = 0
    for page, links in sorted(related.items()):
        if page in SKIP or not page_file(page).is_file():
            continue
        links = [p for p in links if p != page and p in cards and page_file(p).is_file()][:MAX_LINKS]
        changed += apply(page, links, cards)
    print(f"{len(related)} pages checked, {changed} updated")


if __name__ == "__main__":
    main()
