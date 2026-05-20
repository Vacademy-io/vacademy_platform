"""bar_chart_grow — horizontal bars growing from 0 with value counter animation.

Use for: revealing numeric data across 2-8 categories (rankings, comparisons,
survey results, KPI shifts). Each bar gets a staggered entry and its value
counter rolls from 0 → target in sync with the bar width.
"""
from typing import Dict, Any

METADATA = {
    "id": "bar_chart_grow",
    "version": "1.1.0",
    "category": "motion_primitive",
    "title": "Bar Chart Grow-in",
    "description": "Horizontal bars growing from 0 with staggered entry and number counter per row.",
    "use_when": "Revealing numeric data across 2-8 categories (rankings, comparisons, survey results).",
    "compatible_shot_types": ["DATA_STORY", "TEXT_DIAGRAM", "*"],
    "requires_tier": "ultra",
    "requires_plugins": ["gsap"],
    "requires_canvas": "any",
    "example_params": {
        "bars": [
            {"label": "Jan", "value": 45},
            {"label": "Feb", "value": 72},
            {"label": "Mar", "value": 58},
        ],
        "entry_delay": 0.4,
    },
}

PARAMS_SCHEMA = {
    "type": "object",
    "required": ["bars"],
    "properties": {
        "bars": {"type": "array"},
        "entry_delay": {"type": "number"},
        "unit": {"type": "string"},
    },
}


def render(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    bars = params.get("bars") or []
    entry_delay = float(params.get("entry_delay", 0.3))
    unit = str(params.get("unit", ""))
    shot_idx = ctx.get("shot_index", 0)
    prefix = f"bcg{shot_idx}"

    # Canvas-aware fonts via shot_pack. Bars labels/values are body-scale text;
    # fall back to slightly tighter hardcoded values when shot_pack is absent.
    pack = ctx.get("shot_pack") or {}
    fs = (pack.get("font_scale") or {}) if isinstance(pack, dict) else {}
    fs_label = fs.get("body") or "1.5rem"
    fs_value = fs.get("body") or "1.6rem"
    shot_duration = float(ctx.get("shot_duration", 5.0) or 5.0)

    values = [float(b.get("value", 0) or 0) for b in bars]
    max_val = max(values + [1.0])

    rows = []
    for i, b in enumerate(bars):
        label = str(b.get("label", ""))
        value = float(b.get("value", 0) or 0)
        pct = (value / max_val) * 100.0
        color = str(b.get("color") or "var(--brand-primary)")
        rows.append(
            f'<div class="{prefix}-row">'
            f'<span class="{prefix}-label">{label}</span>'
            f'<div class="{prefix}-track">'
            f'<div class="{prefix}-fill" id="{prefix}-fill-{i}" '
            f'data-target-width="{pct}" style="background:{color}"></div>'
            f'</div>'
            f'<span class="{prefix}-value" id="{prefix}-val-{i}" '
            f'data-target-value="{value:g}">0{unit}</span>'
            f'</div>'
        )
    html = f'<div class="{prefix}-chart" id="{prefix}-root">' + "".join(rows) + "</div>"

    # min-width (not flex-basis) on value cell so 4-digit numbers ("1,250") don't
    # blow out the layout — the cell grows to fit, the track shrinks gracefully.
    css = f"""
.{prefix}-chart {{ display:flex; flex-direction:column; gap:1.1rem; width:100%; padding:1.2rem 0; }}
.{prefix}-row {{ display:flex; align-items:center; gap:1rem; }}
.{prefix}-label {{ flex:0 0 9rem; font-size:{fs_label}; font-weight:700; color:var(--brand-text); text-transform:uppercase; letter-spacing:0.04em; }}
.{prefix}-track {{ flex:1; height:2.4rem; background:rgba(255,255,255,0.07); border-radius:0.35rem; overflow:hidden; }}
.{prefix}-fill {{ height:100%; width:0%; border-radius:0.35rem; box-shadow:0 0 0 1px rgba(255,255,255,0.08) inset; }}
.{prefix}-value {{ min-width:5rem; font-size:{fs_value}; font-weight:800; color:var(--brand-accent); text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }}
"""

    js_parts = []
    last_bar_finish = entry_delay
    for i, _ in enumerate(bars):
        d = entry_delay + i * 0.12
        last_bar_finish = d + 0.9
        js_parts.append(
            f'{{'
            f'var fill=document.getElementById("{prefix}-fill-{i}");'
            f'var val=document.getElementById("{prefix}-val-{i}");'
            f'if(fill){{'
            f'gsap.to(fill,{{width: fill.dataset.targetWidth+"%", duration:0.9, delay:{d:.3f}, ease:"power3.out"}});'
            f'}}'
            f'if(val){{'
            f'var target=parseFloat(val.dataset.targetValue)||0;'
            f'gsap.to({{v:0}},{{v:target, duration:0.9, delay:{d:.3f}, ease:"power2.out", '
            f'onUpdate:function(){{val.textContent=Math.round(this.targets()[0].v)+{json_str(unit)};}}}});'
            f'}}'
            f'}}'
        )
    # Back-half motion: after the last bar lands, give the chart a subtle drift.
    back_half_delay = max(last_bar_finish + 0.3, shot_duration * 0.55)
    back_half_dur = max(0.8, shot_duration - back_half_delay)
    js_parts.append(
        f'gsap.fromTo("#{prefix}-root",'
        f'{{x:0}},'
        f'{{x:6, duration:{back_half_dur:.2f}, delay:{back_half_delay:.2f}, ease:"sine.inOut"}});'
    )
    js = "\n".join(js_parts)

    # Audio events: one ui_click as each bar starts growing, final ui_positive
    # when the last bar lands. Skip entirely for >5 bars to avoid clutter.
    audio_events = []
    if bars and len(bars) <= 5:
        for i, _ in enumerate(bars):
            bar_delay = entry_delay + i * 0.12
            audio_events.append({
                "role": "ui_click",
                "t": round(bar_delay, 3),
                "volume_mul": 0.75,
                "skill_id": "bar_chart_grow",
            })
        last_delay = entry_delay + (len(bars) - 1) * 0.12 + 0.9  # 0.9 = bar grow duration
        audio_events.append({
            "role": "ui_positive",
            "t": round(last_delay, 3),
            "volume_mul": 0.85,
            "skill_id": "bar_chart_grow",
        })

    return {"html": html, "css": css, "js": js, "plugins": ["gsap"], "audio_events": audio_events}


def json_str(s: str) -> str:
    """Escape a string for safe embedding inside a JS string literal."""
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def static_fallback(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    """No-animation static version: bars rendered at full width, values displayed
    directly, no GSAP. Used when the animated render() raises or params are
    invalid — better than a `<!-- skill error -->` comment.
    """
    bars = params.get("bars") or []
    if not isinstance(bars, list) or not bars:
        bars = [{"label": "—", "value": 0}]
    unit = str(params.get("unit", ""))
    shot_idx = ctx.get("shot_index", 0)
    prefix = f"bcg{shot_idx}fb"
    pack = ctx.get("shot_pack") or {}
    fs = (pack.get("font_scale") or {}) if isinstance(pack, dict) else {}
    fs_label = fs.get("body") or "1.5rem"
    fs_value = fs.get("body") or "1.6rem"

    values = [float((b or {}).get("value", 0) or 0) for b in bars]
    max_val = max(values + [1.0])

    rows = []
    for b in bars:
        if not isinstance(b, dict):
            b = {}
        label = str(b.get("label", ""))
        value = float(b.get("value", 0) or 0)
        pct = (value / max_val) * 100.0
        color = str(b.get("color") or "var(--brand-primary)")
        display_val = f"{int(round(value))}{unit}" if abs(value - round(value)) < 1e-6 else f"{value:g}{unit}"
        rows.append(
            f'<div class="{prefix}-row">'
            f'<span class="{prefix}-label">{label}</span>'
            f'<div class="{prefix}-track">'
            f'<div class="{prefix}-fill" style="width:{pct:.1f}%;background:{color}"></div>'
            f'</div>'
            f'<span class="{prefix}-value">{display_val}</span>'
            f'</div>'
        )
    html = f'<div class="{prefix}-chart">' + "".join(rows) + "</div>"
    css = f"""
.{prefix}-chart {{ display:flex; flex-direction:column; gap:1.1rem; width:100%; padding:1.2rem 0; }}
.{prefix}-row {{ display:flex; align-items:center; gap:1rem; }}
.{prefix}-label {{ flex:0 0 9rem; font-size:{fs_label}; font-weight:700; color:var(--brand-text); text-transform:uppercase; letter-spacing:0.04em; }}
.{prefix}-track {{ flex:1; height:2.4rem; background:rgba(255,255,255,0.07); border-radius:0.35rem; overflow:hidden; }}
.{prefix}-fill {{ height:100%; border-radius:0.35rem; box-shadow:0 0 0 1px rgba(255,255,255,0.08) inset; }}
.{prefix}-value {{ min-width:5rem; font-size:{fs_value}; font-weight:800; color:var(--brand-accent); text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }}
"""
    return {"html": html, "css": css, "js": "", "plugins": [], "audio_events": []}
