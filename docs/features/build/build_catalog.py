#!/usr/bin/env python3
"""Build vacademy-features.md + vacademy-features.html from curated catalog.json.

Usage: python3 build_catalog.py catalog.json template.html out_dir
"""
import json, sys, re, pathlib

def md_escape(s):
    return str(s or "").strip()

def build_md(data):
    p = data["pillars"]
    n_feat = sum(len(x["features"]) for x in p)
    n_sub = sum(len(f.get("subFeatures", [])) for x in p for f in x["features"])
    L = []
    L.append(f"# {data['meta']['name']} — Complete Feature Catalog\n")
    L.append(f"> {data['meta']['subhead']}\n")
    L.append(f"**{len(p)} products · {n_feat} features · {n_sub} capabilities** · Last updated: {data['meta']['updated']}\n")
    L.append("This document is maintained in parallel with `vacademy-features.html` (interactive explorer). "
             "When you add or change a feature, update **both** files — the HTML embeds the same content in its `DATA` object.\n")
    L.append("---\n")
    # TOC
    L.append("## Products\n")
    L.append("| # | Product | What it covers | Features |")
    L.append("|---|---------|----------------|----------|")
    for i, x in enumerate(p, 1):
        anchor = re.sub(r"[^a-z0-9]+", "-", x["name"].lower()).strip("-")
        L.append(f"| {i} | [{x['name']}](#{anchor}) | {x['tagline']} | {len(x['features'])} |")
    L.append("")
    # Note on terminology
    if data["meta"].get("terminologyNote"):
        L.append(f"> **Note on terminology:** {data['meta']['terminologyNote']}\n")
    L.append("---\n")
    for x in p:
        L.append(f"## {x['name']}\n")
        L.append(f"*{x['tagline']}*\n")
        L.append(md_escape(x["description"]) + "\n")
        for f in x["features"]:
            L.append(f"### {f['name']}\n")
            if f.get("tagline"):
                L.append(f"*{f['tagline']}*\n")
            L.append(md_escape(f["description"]) + "\n")
            meta_bits = []
            if f.get("roles"):
                meta_bits.append("**For:** " + ", ".join(f["roles"]))
            if f.get("platforms"):
                meta_bits.append("**Where:** " + ", ".join(f["platforms"]))
            if meta_bits:
                L.append(" · ".join(meta_bits) + "\n")
            subs = f.get("subFeatures", [])
            if subs:
                for s in subs:
                    L.append(f"- **{s['name']}** — {md_escape(s['description'])}")
                L.append("")
        L.append("---\n")
    L.append("## Maintaining this catalog\n")
    L.append("- **This file** (`vacademy-features.md`): plain-Markdown reference — easy to diff, grep, and paste into proposals.")
    L.append("- **`vacademy-features.html`**: interactive explorer for clients — open it in any browser (no server or internet needed). All content lives in the single `DATA` object near the bottom of the file; edit it there. Products, features and capability rows render automatically, including search.")
    L.append("- Keep the two in sync: every feature added/renamed/removed in one must be mirrored in the other.")
    L.append(f"- Bump the `updated` date (in this header and in the HTML `DATA.meta.updated`) whenever you edit.\n")
    return "\n".join(L)

def main():
    cat, tpl, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
    data = json.loads(pathlib.Path(cat).read_text())
    out = pathlib.Path(outdir); out.mkdir(parents=True, exist_ok=True)
    # MD
    (out / "vacademy-features.md").write_text(build_md(data))
    # HTML — inject compact JSON
    tpl_text = pathlib.Path(tpl).read_text()
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    payload = payload.replace("</", "<\\/")  # keep </script> safe
    html = tpl_text.replace("__DATA_JSON__", payload)
    (out / "vacademy-features.html").write_text(html)
    n_feat = sum(len(x["features"]) for x in data["pillars"])
    n_sub = sum(len(f.get("subFeatures", [])) for x in data["pillars"] for f in x["features"])
    print(f"OK: {len(data['pillars'])} pillars, {n_feat} features, {n_sub} subfeatures")
    print(f"MD:   {(out/'vacademy-features.md')} ({(out/'vacademy-features.md').stat().st_size//1024} KB)")
    print(f"HTML: {(out/'vacademy-features.html')} ({(out/'vacademy-features.html').stat().st_size//1024} KB)")

if __name__ == "__main__":
    main()
