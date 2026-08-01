#!/usr/bin/env python3
"""Build the standalone admin portal demo.

    python3 build_admin_demo.py admin-demo.json admin-demo-template.html explorer-template.html ..

The mock engine (product-accurate CSS + the widget/screen renderers) is lifted
verbatim out of explorer-template.html at build time, so the portal demo and the
feature catalog always render the same UI. Content lives in admin-demo.json.
"""
import base64
import json
import sys
from pathlib import Path

# markers delimiting the shared engine inside explorer-template.html
CSS_START = "/* ============================================================\n   PRODUCT-ACCURATE APP MOCK"
CSS_END = "/* ---------- print ---------- */"
JS_START = "/* ---- inline icon set"
JS_END = "\nlet demoState=null;"


def slice_between(text, start, end, what):
    i = text.find(start)
    j = text.find(end, i + 1)
    if i < 0 or j < 0:
        sys.exit(f"could not locate the {what} block in explorer-template.html")
    return text[i:j].rstrip()


def main():
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    data_path, tpl_path, engine_path, out_dir = map(Path, sys.argv[1:])

    data = json.loads(data_path.read_text(encoding="utf-8"))
    engine = engine_path.read_text(encoding="utf-8")
    tpl = tpl_path.read_text(encoding="utf-8")

    mock_css = slice_between(engine, CSS_START, CSS_END, "mock CSS")
    mock_js = slice_between(engine, JS_START, JS_END, "mock JS")

    # every nav target must resolve, or the demo dead-ends on a click
    missing = sorted({
        k.get("page")
        for m in data["modules"]
        for item in m["nav"]
        for k in [item] + item.get("children", [])
        if k.get("page") and k["page"] not in data["pages"]
    })
    if missing:
        sys.exit("nav points at undefined pages: " + ", ".join(missing))
    linked = {
        k["page"]
        for m in data["modules"]
        for item in m["nav"]
        for k in [item] + item.get("children", [])
        if k.get("page")
    }
    orphans = sorted(set(data["pages"]) - linked)

    # inline every referenced asset so the deliverable stays a single portable file
    inlined = [0]

    def inline(node):
        if isinstance(node, dict):
            for k, v in node.items():
                if k in ("img", "poster") and isinstance(v, str) and not v.startswith("data:"):
                    path = data_path.parent / v
                    if not path.exists():
                        sys.exit(f"missing asset: {v}")
                    mime = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
                    node[k] = f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()
                    inlined[0] += 1
                else:
                    inline(v)
        elif isinstance(node, list):
            for v in node:
                inline(v)

    inline(data)

    html = (tpl
            .replace("__MOCK_CSS__", mock_css)
            .replace("__MOCK_JS__", mock_js)
            .replace("__DATA_JSON__", json.dumps(data, ensure_ascii=False, separators=(",", ":")))
            .replace("__TITLE__", data["meta"]["title"])
            .replace("__TAGLINE__", data["meta"]["tagline"]))

    out = out_dir / "admin-portal-demo.html"
    out.write_text(html, encoding="utf-8")
    print(f"OK: {len(data['modules'])} modules, {len(data['pages'])} pages, {inlined[0]} images inlined")
    if orphans:
        print("note: pages not reachable from any nav item: " + ", ".join(orphans))
    print(f"HTML: {out} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
