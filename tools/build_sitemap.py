"""Regenerate sitemap-main.xml and the sitemap.xml index.

Lists every indexable page on the site by its canonical URL (directory URLs for index.html),
with lastmod taken from the page's last git commit (today for uncommitted changes). Pages marked
noindex (the redirect stubs) and 404.html are left out. llm-countdowns/ is left out too: all-db
writes its own sitemap-countdowns.xml, which the index points to. Run from anywhere:
    python tools/build_sitemap.py
"""
import datetime
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://waifuai.github.io/"
SKIP_DIRS = {".git", ".kilo", "tools", "llm-countdowns"}
SKIP_FILES = {"404.html"}
OTHER_SITEMAPS = ["sitemap-countdowns.xml"]

CANONICAL = re.compile(r'<link rel="canonical" href="([^"]+)"')
NOINDEX = re.compile(r'<meta name="robots" content="[^"]*noindex', re.I)


def last_commit_dates():
    """Path -> date of the last commit touching it, from one git log pass."""
    out = subprocess.run(["git", "log", "--format=@%cs", "--name-only"], cwd=ROOT,
                         capture_output=True, text=True, encoding="utf-8").stdout
    dates, current = {}, None
    for line in out.splitlines():
        if line.startswith("@"):
            current = line[1:]
        elif line and line not in dates:
            dates[line] = current
    dirty = subprocess.run(["git", "status", "--porcelain"], cwd=ROOT, capture_output=True,
                           text=True, encoding="utf-8").stdout
    today = datetime.date.today().isoformat()
    for line in dirty.splitlines():
        dates[line[3:].strip('"')] = today
    return dates


def pages():
    for path in sorted(ROOT.rglob("*.html")):
        rel = path.relative_to(ROOT).as_posix()
        if rel.split("/")[0] in SKIP_DIRS or path.name in SKIP_FILES:
            continue
        head = path.read_text(encoding="utf-8", errors="ignore")[:12000]
        if NOINDEX.search(head):
            continue
        m = CANONICAL.search(head)
        if m and m[1].startswith(SITE):
            url = m[1].split("#")[0]
        else:
            url = SITE + (rel[: -len("index.html")] if path.name == "index.html" else rel)
        yield rel, url


def main():
    dates = last_commit_dates()
    today = datetime.date.today().isoformat()
    seen, entries, newest = set(), [], ""
    for rel, url in pages():
        if url in seen:
            continue
        seen.add(url)
        newest = max(newest, dates.get(rel, today))
        entries.append(f"  <url>\n    <loc>{url}</loc>\n    <lastmod>{dates.get(rel, today)}</lastmod>\n  </url>")
    main_xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                + "\n".join(entries) + "\n</urlset>\n")
    (ROOT / "sitemap-main.xml").write_text(main_xml, encoding="utf-8", newline="\n")

    index = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for name in ["sitemap-main.xml"] + OTHER_SITEMAPS:
        lastmod = newest if name == "sitemap-main.xml" else dates.get(name, today)
        index.append(f"  <sitemap>\n    <loc>{SITE}{name}</loc>\n    <lastmod>{lastmod}</lastmod>\n  </sitemap>")
    index.append("</sitemapindex>")
    (ROOT / "sitemap.xml").write_text("\n".join(index) + "\n", encoding="utf-8", newline="\n")
    print(f"{len(entries)} URLs -> sitemap-main.xml")


if __name__ == "__main__":
    main()
