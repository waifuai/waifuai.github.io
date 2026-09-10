import os

pricer_dir = r'c:\Users\petrp\g\gwai2\waifuai.github.io\reasoning-pricer'
sitemap_path = r'c:\Users\petrp\g\gwai2\waifuai.github.io\sitemap-reasoning-pricer.xml'

all_html = []
for root, dirs, files in os.walk(pricer_dir):
    for f in sorted(files):
        if f.endswith('.html'):
            rel = os.path.relpath(os.path.join(root, f), pricer_dir).replace('\\', '/')
            all_html.append(rel)

all_html.sort()

lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
]

for rel in all_html:
    url = f'https://waifuai.github.io/reasoning-pricer/{rel}'
    lines.append('  <url>')
    lines.append(f'    <loc>{url}</loc>')
    lines.append('    <lastmod>2026-09-10</lastmod>')
    lines.append('  </url>')

lines.append('</urlset>\n')

with open(sitemap_path, 'w', encoding='utf-8', newline='\n') as f:
    f.write('\n'.join(lines))

print(f'Wrote {len(all_html)} URLs to {sitemap_path}')
