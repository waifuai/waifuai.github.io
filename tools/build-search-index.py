#!/usr/bin/env python3
"""Regenerate search-index.json for /search.html.

Walks every .html page in the site and records its title, path, and section
(the top-level directory). Run from the repository root:

    python tools/build-search-index.py
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_FILES = {'404.html', 'search.html'}
TITLE = re.compile(r'<title[^>]*>(.*?)</title>', re.S | re.I)
DESC = re.compile(r'<meta\s+name="description"\s+content="([^"]*)"', re.I)
TAGS = re.compile(r'<[^>]+>')

ENTITIES = {'&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
            '&mdash;': '—', '&ndash;': '–', '&nbsp;': ' ', '&larr;': '←'}


def clean(text):
    text = TAGS.sub('', text)
    for k, v in ENTITIES.items():
        text = text.replace(k, v)
    text = re.sub(r'\s+', ' ', text).strip()
    return re.sub(r'\s*\|\s*WaifuAI\s*$', '', text)


def main():
    sections = []
    entries = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in ('.git', '.kilo', 'tools')]
        for name in sorted(filenames):
            if not name.endswith('.html') or name in SKIP_FILES:
                continue
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, ROOT).replace(os.sep, '/')
            html = open(path, encoding='utf-8', errors='ignore').read(8192)
            m = TITLE.search(html)
            title = clean(m.group(1)) if m else rel
            if not title:
                continue
            section = rel.split('/')[0] if '/' in rel else 'Docs Hub'
            if section not in sections:
                sections.append(section)
            url = rel[:-len('index.html')] if rel.endswith('/index.html') else rel
            if url == 'index.html':
                url = ''
            d = DESC.search(html)
            desc = clean(d.group(1))[:120] if d else ''
            entries.append([title, url, sections.index(section), desc])

    out = {'sections': sections, 'pages': entries}
    dest = os.path.join(ROOT, 'search-index.json')
    with open(dest, 'w', encoding='utf-8', newline='\n') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    size = os.path.getsize(dest)
    print('%d pages indexed -> search-index.json (%.0f KB)' % (len(entries), size / 1024))
    return 0


if __name__ == '__main__':
    sys.exit(main())
