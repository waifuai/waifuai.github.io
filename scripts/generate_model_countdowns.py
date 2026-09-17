import json
import os
import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
PREDICTIONS_PATH = os.path.join(ROOT_DIR, "llm-countdowns", "predictions.json")
OUTPUT_BASE = os.path.join(ROOT_DIR, "llm-countdowns")

LAB_THEMES = {
    "xai": {"name": "xAI", "color": "#ffb300", "icon": "🟠"},
    "google": {"name": "Google DeepMind", "color": "#4facfe", "icon": "⚡"},
    "anthropic": {"name": "Anthropic", "color": "#9d4edd", "icon": "🟣"},
    "openai": {"name": "OpenAI", "color": "#10a37f", "icon": "🟢"},
    "deepseek": {"name": "DeepSeek", "color": "#ff007a", "icon": "🌊"},
    "meta": {"name": "Meta", "color": "#0081fb", "icon": "🦙"},
    "alibaba": {"name": "Alibaba", "color": "#ff6a00", "icon": "🌐"},
    "mistral": {"name": "Mistral AI", "color": "#f85a40", "icon": "🔴"},
    "kimi": {"name": "Moonshot / Kimi", "color": "#00f2fe", "icon": "🌙"},
    "xiaomi": {"name": "Xiaomi AI", "color": "#ff6700", "icon": "🧡"},
    "minimax": {"name": "MiniMax", "color": "#a855f7", "icon": "✨"}
}

def load_predictions():
    with open(PREDICTIONS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def build_lab_subpage_html(lab_slug, lab_info, primary_model, all_lab_models, days_str):
    color = lab_info.get("color", "#00f2fe")
    icon = lab_info.get("icon", "⚡")
    creator = lab_info.get("name", lab_slug.capitalize())
    
    name = primary_model.get("predictedName", "Next Frontier Model")
    window_label = primary_model.get("explicitWindowLabel", "Upcoming")
    status = primary_model.get("status", "Active Development")
    target_iso = primary_model.get("explicitTargetDate", "")
    confidence = primary_model.get("confidence", "High")
    confidence_score = primary_model.get("confidenceScore", 90)
    hype_score = primary_model.get("hypeScore", 90)
    features = primary_model.get("features", [])
    source = primary_model.get("source", "")
    model_id = primary_model.get("id", "")
    canonical_url = f"https://waifuai.github.io/llm-countdowns/{lab_slug}/"
    
    title = f"⏳ {creator} Launch Countdown — Next: {name}"
    
    # Spec snippet for Discord description
    spec_snippet = ""
    for feat in features:
        if any(k in feat.lower() for k in ["parameter", "params", "context", "gpu", "cluster", "moe", "swe-bench", "agent"]):
            spec_snippet = feat
            break
    if not spec_snippet and features:
        spec_snippet = features[0]
    if len(spec_snippet) > 105:
        spec_snippet = spec_snippet[:102] + "..."
        
    desc = f"⏳ Next {creator} Model: {name} ({window_label}, {days_str}) • Status: {status}. {spec_snippet} Track the official {creator} launch radar on WaifuAI!"
    if len(desc) > 280:
        desc = desc[:277] + "..."

    features_html = "".join([f"<li>{f}</li>" for f in features[:4]])
    
    # Render all models for this lab in a clean pipeline overview
    pipeline_cards = []
    for m in all_lab_models:
        m_name = m.get("predictedName", m.get("id"))
        m_tier = m.get("category", "frontier").upper()
        m_win = m.get("explicitWindowLabel", "Upcoming")
        m_status = m.get("status", "In development")
        is_hero = (m.get("id") == model_id)
        hero_tag = '<span style="background: rgba(255, 179, 0, 0.2); color: #ffb300; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">NEXT DROP</span>' if is_hero else ''
        pipeline_cards.append(f"""
        <div style="background: {'rgba(0, 242, 254, 0.05)' if is_hero else 'rgba(255, 255, 255, 0.02)'}; border: 1px solid {'rgba(0, 242, 254, 0.3)' if is_hero else 'rgba(255, 255, 255, 0.06)'}; border-radius: var(--radius-sm); padding: 14px; margin-top: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <div>
              <span style="font-weight: 800; color: #fff; font-size: 15px;">{m_name}</span>
              {hero_tag}
            </div>
            <span style="font-size: 11px; background: rgba(0, 242, 254, 0.1); color: var(--accent-cyan); padding: 2px 8px; border-radius: var(--radius-full); font-weight: 700;">{m_win}</span>
          </div>
          <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4;">{m_status}</div>
        </div>
        """)
        
    pipeline_html = f"""
    <div style="margin-top: 24px;">
      <h3 style="font-size: 13px; text-transform: uppercase; color: var(--accent-cyan); letter-spacing: 0.8px; margin-bottom: 4px;">
        🧭 {creator} Upcoming Model Pipeline
      </h3>
      {"".join(pipeline_cards)}
    </div>
    """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-EP9DHGYS02"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){{dataLayer.push(arguments);}}
    gtag('js', new Date());
    gtag('config', 'G-EP9DHGYS02');
  </script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>{title} | WaifuAI</title>
  <meta name="description" content="{desc}">
  <meta name="keywords" content="{creator}, {name}, AI countdown, release date, LLM launch clock, WaifuAI">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="{canonical_url}">

  <!-- Discord & OpenGraph Meta Tags (Optimized for Rich Link Previews) -->
  <meta property="og:site_name" content="WaifuAI • LLM Countdowns">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:image" content="https://waifuai.github.io/llm-countdowns/og_image.jpg">
  <meta property="og:url" content="{canonical_url}">
  <meta property="og:type" content="website">
  <meta name="theme-color" content="{color}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title}">
  <meta name="twitter:description" content="{desc}">
  <meta name="twitter:image" content="https://waifuai.github.io/llm-countdowns/og_image.jpg">

  <!-- Structured Data (Schema.org) -->
  <script type="application/ld+json">
  {{
    "@context": "https://schema.org",
    "@graph": [
      {{
        "@type": "WebApplication",
        "@id": "{canonical_url}#app",
        "name": "{creator} Launch Countdown",
        "url": "{canonical_url}",
        "description": "{desc}",
        "applicationCategory": "DeveloperApplication",
        "operatingSystem": "All",
        "offers": {{
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        }},
        "publisher": {{
          "@type": "Organization",
          "name": "WaifuAI",
          "url": "https://waifuai.com/"
        }}
      }},
      {{
        "@type": "BreadcrumbList",
        "@id": "{canonical_url}#breadcrumb",
        "itemListElement": [
          {{
            "@type": "ListItem",
            "position": 1,
            "name": "WaifuAI Docs Hub",
            "item": "https://waifuai.github.io/"
          }},
          {{
            "@type": "ListItem",
            "position": 2,
            "name": "LLM Countdowns",
            "item": "https://waifuai.github.io/llm-countdowns/"
          }},
          {{
            "@type": "ListItem",
            "position": 3,
            "name": "{creator}",
            "item": "{canonical_url}"
          }}
        ]
      }}
    ]
  }}
  </script>

  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="stylesheet" href="../style.css">
  <style>
    .subpage-container {{
      max-width: 900px;
      margin: 0 auto;
      padding: 20px 16px 60px;
      width: 100%;
    }}
    .back-nav {{
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--accent-cyan);
      text-decoration: none;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 20px;
      transition: transform 0.2s ease;
    }}
    .back-nav:hover {{
      transform: translateX(-3px);
      text-decoration: underline;
    }}
    .model-subpage-card {{
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      padding: 30px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
      position: relative;
      overflow: hidden;
    }}
    .model-subpage-card::before {{
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, {color}, var(--accent-blue));
    }}
    .subpage-clock-wrap {{
      margin: 28px 0;
      padding: 20px;
      background: rgba(8, 12, 22, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: var(--radius-md);
    }}
    .cta-row {{
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 24px;
    }}
    .btn-full-radar {{
      flex: 1;
      min-width: 220px;
      background: linear-gradient(135deg, {color} 0%, var(--accent-blue) 100%);
      color: #070a11;
      font-weight: 800;
      font-size: 14px;
      padding: 12px 20px;
      border-radius: var(--radius-full);
      text-align: center;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 15px rgba(0, 242, 254, 0.25);
    }}
    .btn-full-radar:hover {{
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 242, 254, 0.4);
    }}
    .btn-copy-subpage {{
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      font-weight: 700;
      font-size: 13px;
      padding: 12px 18px;
      border-radius: var(--radius-full);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
    }}
    .btn-copy-subpage:hover {{
      background: rgba(255, 255, 255, 0.1);
      border-color: var(--accent-cyan);
    }}
    .dossier-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin: 20px 0;
    }}
    .dossier-item {{
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.04);
      border-radius: var(--radius-sm);
      padding: 12px;
    }}
    .dossier-item-label {{
      font-size: 11px;
      text-transform: uppercase;
      color: var(--text-muted);
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }}
    .dossier-item-value {{
      font-size: 14px;
      font-weight: 700;
      color: var(--text-primary);
    }}
    .toast-popup {{
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: #0d131f;
      border: 1px solid var(--accent-cyan);
      color: #fff;
      padding: 10px 20px;
      border-radius: var(--radius-full);
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 8px 30px rgba(0, 242, 254, 0.3);
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      z-index: 9999;
      pointer-events: none;
    }}
    .toast-popup.visible {{
      transform: translateX(-50%) translateY(0);
    }}
  </style>
</head>
<body>

  <!-- Ecosystem Nav Bar -->
  <div class="ecosystem-nav-bar" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 16px; background: rgba(13, 19, 31, 0.95); border-bottom: 1px solid var(--border-color); font-size: 12px; font-weight: 600;">
    <a href="../../" style="display: inline-flex; align-items: center; gap: 6px; color: var(--accent-cyan); text-decoration: none;">
      <span>←</span>
      <span>WaifuAI Docs Hub</span>
    </a>
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="background: rgba(0, 242, 254, 0.1); color: var(--accent-cyan); border: 1px solid rgba(0, 242, 254, 0.25); border-radius: var(--radius-full); padding: 2px 8px; font-size: 10px; font-weight: 700;">⚡ {creator.upper()}</span>
      <span style="border: 1px solid rgba(0, 230, 118, 0.3); color: var(--accent-green); background: rgba(0, 230, 118, 0.1); border-radius: var(--radius-full); padding: 2px 8px; font-size: 10px; font-weight: 700;">EVERGREEN RADAR</span>
    </div>
  </div>

  <div class="subpage-container">
    <a href="../" class="back-nav">
      <span>←</span>
      <span>Back to All Frontier Model Countdowns</span>
    </a>

    <div class="model-subpage-card">
      <div class="hero-card-meta">
        <span class="spotlight-pill" style="background: rgba(255, 179, 0, 0.15); color: {color}; border-color: {color};">
          {icon} {creator}
        </span>
        <span class="model-tier-badge hero-tier-badge frontier">
          👑 {primary_model.get('category', 'frontier').upper()}
        </span>
        <span class="confidence-pill {confidence.lower()}">
          Confidence: {confidence} ({confidence_score}%)
        </span>
      </div>

      <div class="hero-title-group" style="margin-top: 14px;">
        <h1 class="hero-model-name" style="font-size: 28px; line-height: 1.2; margin-bottom: 6px;">{creator} Launch Countdown</h1>
        <div class="hero-creator-name" style="font-size: 14px;">
          Next Expected Drop: <strong>{name}</strong> • <span style="color: var(--accent-cyan); font-weight: 700;">Target Window: {window_label}</span>
        </div>
      </div>

      <!-- Live Countdown Display -->
      <div class="subpage-clock-wrap">
        <div class="hero-clock-display" id="subpage-clock">
          <div class="clock-unit-card">
            <div class="clock-digit" id="unit-days">--</div>
            <div class="clock-label">DAYS</div>
          </div>
          <div class="clock-colon">:</div>
          <div class="clock-unit-card">
            <div class="clock-digit" id="unit-hours">--</div>
            <div class="clock-label">HOURS</div>
          </div>
          <div class="clock-colon">:</div>
          <div class="clock-unit-card">
            <div class="clock-digit" id="unit-minutes">--</div>
            <div class="clock-label">MINS</div>
          </div>
          <div class="clock-colon">:</div>
          <div class="clock-unit-card accent">
            <div class="clock-digit" id="unit-seconds">--</div>
            <div class="clock-label">SECS</div>
          </div>
        </div>
      </div>

      <!-- Dossier Intel Specs -->
      <div class="dossier-grid">
        <div class="dossier-item">
          <div class="dossier-item-label">Status &amp; Stage</div>
          <div class="dossier-item-value" style="color: {color};">{status}</div>
        </div>
        <div class="dossier-item">
          <div class="dossier-item-label">Target Launch Window</div>
          <div class="dossier-item-value">{window_label}</div>
        </div>
        <div class="dossier-item">
          <div class="dossier-item-label">Community Hype</div>
          <div class="dossier-item-value" style="color: var(--accent-pink);">{hype_score} / 100 🔥</div>
        </div>
        <div class="dossier-item">
          <div class="dossier-item-label">Lab Cadence Cycle</div>
          <div class="dossier-item-value">{primary_model.get('cadenceDays', 30)} days historical</div>
        </div>
      </div>

      <!-- Rumored Breakthroughs -->
      <div style="margin-top: 24px;">
        <h3 style="font-size: 14px; text-transform: uppercase; color: var(--accent-cyan); letter-spacing: 0.8px; margin-bottom: 10px;">
          🔬 Expected Capabilities &amp; Architecture Forecast
        </h3>
        <ul class="card-rumor-list" style="margin-bottom: 16px;">
          {features_html}
        </ul>
      </div>

      <!-- All Models in Pipeline -->
      {pipeline_html}

      <!-- Source Citation -->
      <div class="card-source-snippet" title="{source}" style="margin-top: 14px; font-size: 12px; color: var(--text-muted);">
        📡 <strong>Intel Source:</strong> {source}
      </div>

      <!-- Actions & CTA -->
      <div class="cta-row">
        <a href="../#{model_id}" class="btn-full-radar">
          ⚡ Open Full Interactive Launch Radar
        </a>
        <button id="btn-copy-discord" class="btn-copy-subpage" data-model-id="{model_id}">
          🔗 Copy Discord Share Link
        </button>
        <button id="btn-download-ics" class="btn-copy-subpage" data-model-id="{model_id}">
          📅 Add to Calendar (.ics)
        </button>
      </div>
    </div>
  </div>

  <div id="toast" class="toast-popup">Link copied! Ready to paste into Discord 🚀</div>

  <script>
    const targetDateStr = "{target_iso}";
    const targetDate = new Date(targetDateStr).getTime();

    function updateClock() {{
      const now = Date.now();
      const diff = Math.max(0, targetDate - now);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      document.getElementById("unit-days").textContent = String(days).padStart(2, "0");
      document.getElementById("unit-hours").textContent = String(hours).padStart(2, "0");
      document.getElementById("unit-minutes").textContent = String(mins).padStart(2, "0");
      document.getElementById("unit-seconds").textContent = String(secs).padStart(2, "0");
    }}

    updateClock();
    setInterval(updateClock, 1000);

    function showToast(msg) {{
      const toast = document.getElementById("toast");
      toast.textContent = msg;
      toast.classList.add("visible");
      setTimeout(() => toast.classList.remove("visible"), 2600);
    }}

    document.getElementById("btn-copy-discord").addEventListener("click", () => {{
      const url = window.location.href;
      navigator.clipboard.writeText(url).then(() => {{
        showToast("Discord preview link copied! Pasting shows countdown card 🚀");
      }}).catch(() => {{
        showToast("Link: " + url);
      }});
    }});

    document.getElementById("btn-download-ics").addEventListener("click", () => {{
      const pad = (n) => String(n).padStart(2, '0');
      const d = new Date(targetDate);
      const stamp = d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + '00Z';
      const endD = new Date(d.getTime() + 3600000);
      const endStamp = endD.getUTCFullYear() + pad(endD.getUTCMonth() + 1) + pad(endD.getUTCDate()) + 'T' + pad(endD.getUTCHours()) + pad(endD.getUTCMinutes()) + '00Z';

      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//WaifuAI//LLM Countdowns//EN',
        'BEGIN:VEVENT',
        `UID:{model_id}-countdown@waifuai.github.io`,
        `DTSTAMP:${{stamp}}`,
        `DTSTART:${{stamp}}`,
        `DTEND:${{endStamp}}`,
        `SUMMARY:⏳ {name} Launch ({creator})`,
        `DESCRIPTION:Target launch window for {name} ({creator}). Track live countdown on WaifuAI: {canonical_url}`,
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\\r\\n');

      const blob = new Blob([ics], {{ type: 'text/calendar;charset=utf-8' }});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `{model_id}-countdown.ics`;
      a.click();
      showToast("Calendar reminder downloaded 📅");
    }});
  </script>
</body>
</html>
"""

def generate_subpages():
    data = load_predictions()
    labs = data.get("labs", {})
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    
    # 11 Clean lab folders ONLY
    lab_urls = []
    
    for lab_slug, lab_info in LAB_THEMES.items():
        lab_data = labs.get(lab_slug, {})
        models = list(lab_data.get("models", {}).values())
        if not models:
            continue
            
        # Sort by target date ascending
        models.sort(key=lambda x: x.get("explicitTargetDate", "9999"))
        primary = models[0]
        
        target_iso = primary.get("explicitTargetDate", "")
        window_label = primary.get("explicitWindowLabel", "Upcoming")
        days_str = "Imminent"
        if target_iso:
            try:
                target_dt = datetime.datetime.fromisoformat(target_iso.replace("Z", "+00:00"))
                diff = target_dt - now_utc
                days = max(0, diff.days)
                days_str = f"~{days}d remaining"
            except Exception:
                days_str = window_label

        html = build_lab_subpage_html(lab_slug, lab_info, primary, models, days_str)
        
        target_dir = os.path.join(OUTPUT_BASE, lab_slug)
        os.makedirs(target_dir, exist_ok=True)
        with open(os.path.join(target_dir, "index.html"), "w", encoding="utf-8") as f:
            f.write(html)
        print(f"Generated clean lab subpage: {lab_slug}/ (Next: {primary.get('predictedName')})")
        lab_urls.append(f"https://waifuai.github.io/llm-countdowns/{lab_slug}/")

    # Generate sitemap-countdowns.xml with exactly these 11 lab URLs + root
    today_str = now_utc.strftime("%Y-%m-%d")
    sitemap_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <url>',
        '    <loc>https://waifuai.github.io/llm-countdowns/</loc>',
        f'    <lastmod>{today_str}</lastmod>',
        '    <changefreq>daily</changefreq>',
        '    <priority>1.0</priority>',
        '  </url>'
    ]
    for url in lab_urls:
        sitemap_lines.extend([
            '  <url>',
            f'    <loc>{url}</loc>',
            f'    <lastmod>{today_str}</lastmod>',
            '    <changefreq>daily</changefreq>',
            '    <priority>0.9</priority>',
            '  </url>'
        ])
    sitemap_lines.append('</urlset>')
    sitemap_path = os.path.join(ROOT_DIR, "sitemap-countdowns.xml")
    with open(sitemap_path, "w", encoding="utf-8") as f:
        f.write("\n".join(sitemap_lines) + "\n")
    print(f"Generated {sitemap_path} with {len(lab_urls) + 1} clean URLs.")

if __name__ == "__main__":
    generate_subpages()
