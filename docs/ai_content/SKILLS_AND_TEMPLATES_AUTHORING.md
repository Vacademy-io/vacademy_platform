# Authoring Guide — Skills and Shot Templates

**Audience**: engineers adding to the AI video pipeline's animation library.
**Companion**: [AI_VIDEO_GENERATION.md](./AI_VIDEO_GENERATION.md) §3.13 (skills), §3.14 (shot templates), §3.15 (transitions), §3.16 (image continuity).

---

## 0. Skill or template — which do I want?

Both are filesystem-discovered Python modules that produce HTML/CSS/JS. They differ in scope:

| Question | Build a **skill** | Build a **template** |
|---|---|---|
| What unit does it produce? | A *fragment* (one chart, one counter, one list) the LLM places inside a freeform shot | An *entire shot* — the per-shot LLM call is skipped |
| How is it invoked? | LLM drops a `<skill data-skill-id="..." data-params='{}'>` tag inside its HTML | Director sets `template_id` + `template_params` on a shot in the plan |
| Can it co-exist with custom HTML? | Yes — multiple skills + custom HTML in one shot | The template *is* the shot |
| Cost vs LLM-only | Same LLM call for the surrounding shot; skill itself has no cost | **Cheaper** — full per-shot LLM call is skipped |
| Tier scope | ultra / super_ultra | premium / ultra / super_ultra |
| Best for | Common motion patterns the LLM should compose around (counters, charts, typewriters, progress rings) | Complete repeating compositions (split-comparison, three-up grid, pull quote, hero stat) |

**Rule of thumb**: if the visual content varies per shot but the *animation pattern* doesn't → skill. If the *whole layout* repeats → template.

Worked examples:
- "Big rolling number" appears in many shots, surrounded by varying content → `number_counter` **skill**.
- "Comparison: left says X, right says Y, both reveal in sync" repeats verbatim across many videos → `split_comparison` **template**.

You can also **combine** them: a template's `render()` may emit `<skill>` tags inside its own HTML, and the skill composer will resolve them on the next pipeline pass. `stat_block_with_context` template wraps the same animation pattern as `number_counter` skill — different units, same vocabulary.

---

## 1. Authoring a skill

### 1.1 Create the folder

```
ai_service/app/ai-video-gen-main/skills/
  motion_primitives/                # category — pick one or create a new category folder
    your_skill_id/
      skill.py                      # the only required file
```

The folder name doesn't matter for the registry — `METADATA["id"]` is the lookup key. But keep folder name = id for human-readability.

### 1.2 The contract — three exports

```python
# skills/motion_primitives/your_skill_id/skill.py
from typing import Dict, Any

METADATA = {
    "id": "your_skill_id",                                   # LOOKUP KEY — must be unique
    "version": "1.0.0",                                      # bump when output changes
    "category": "motion_primitive",                          # for telemetry / catalog grouping
    "title": "Human Title",
    "description": "One sentence on what it does.",
    "use_when": "Concrete narrative trigger — when an LLM should reach for this.",
    "compatible_shot_types": ["DATA_STORY", "TEXT_DIAGRAM", "*"],   # "*" = any shot
    "requires_tier": "ultra",                                 # min tier — free/standard/premium/ultra/super_ultra
    "requires_plugins": ["gsap"],                             # purely descriptive today
    "requires_canvas": "any",                                 # "portrait"/"landscape"/"any"
    "example_params": {                                       # shown verbatim in the LLM-facing catalog
        "to": 75,
        "label": "Resting heart rate",
    },
}

PARAMS_SCHEMA = {
    "type": "object",
    "required": ["to"],                                       # caller-mandatory keys
    "properties": {                                           # type hints (loose check)
        "from":  {"type": "number"},
        "to":    {"type": "number"},
        "label": {"type": "string"},
    },
}

def render(params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    # ctx contains: shot_index, canvas_w, canvas_h, tier, shot_type
    sid = f"yk{ctx.get('shot_index', 0)}"   # ALWAYS namespace IDs by shot index

    html = f'<div class="{sid}-wrap" id="{sid}-root">...</div>'
    css  = f'.{sid}-wrap {{ ... }}'
    js   = f'gsap.fromTo("#{sid}-root", {{opacity:0}}, {{opacity:1, duration:0.4, ease:"power2.out"}});'

    audio_events = [                                          # optional — Sound Planner reads these
        {"role": "data_reveal", "t": 0.30, "volume_mul": 0.95, "skill_id": "your_skill_id"},
    ]
    return {"html": html, "css": css, "js": js, "plugins": ["gsap"], "audio_events": audio_events}
```

### 1.3 The five non-negotiable rules

1. **Namespace every element ID** with the shot index. The skill composer does NOT inject extra namespacing — collisions are your responsibility. Use `f"sk{ctx['shot_index']}_<your-id>"` or any short prefix derived from `shot_index`.
2. **Use brand CSS variables**, never hardcoded brand colors. `var(--brand-primary)` / `var(--brand-accent)` / `var(--brand-text)` etc. — these resolve to institute branding. Hardcoding hex is fine for content colors (red for "wrong", green for "correct") and neutrals (`#000`, `#fff`).
3. **Never use `setTimeout`**. The render server seeks `gsap.globalTimeline.totalTime(t)` per frame; `setTimeout` callbacks fire in wall-clock time and won't sync. Use `gsap.delayedCall(seconds, fn)` or a tween's `delay:` field.
4. **Never wrap your `js` in `window.addEventListener('load', …)`**. The render server runs each shot inside a shadow root — there is no shadow-scoped `load` event. Just emit your code; GSAP is loaded globally before the shot HTML is parsed. The composer wraps your JS in an IIFE with a `typeof gsap` guard automatically. (See [AI_VIDEO_GENERATION.md §8.9](./AI_VIDEO_GENERATION.md) — invariant.)
5. **Sanitize text** if you accept text params. `import html as _html; _html.escape(params["label"])`. Skill output goes directly into the shot HTML; un-escaped user content is an XSS surface.

### 1.4 Registering and testing

The registry auto-discovers any `skill.py` under `skills/`. No edits to `skill_registry.py` needed.

```bash
cd vacademy_platform/ai_service/app/ai-video-gen-main
python3 -c "
from skill_registry import get_registry, build_catalog_for_shot
print(sorted(get_registry().keys()))   # your_skill_id should appear
print(build_catalog_for_shot('TEXT_DIAGRAM', 'ultra', 'landscape'))
"
```

End-to-end smoke through the composer:

```python
from skill_composer import compose
ctx = {"shot_index": 3, "canvas_w": 1920, "canvas_h": 1080, "tier": "ultra", "shot_type": "TEXT_DIAGRAM"}
shot_html = '<div><skill data-skill-id="your_skill_id" data-params=\'{"to": 100}\'></skill></div>'
result = compose(shot_html, ctx)
assert result["succeeded"] == 1 and result["failed"] == 0
print(result["html"][:500])
```

### 1.5 Versioning

Bump `METADATA["version"]` when the rendered output changes meaningfully (different DOM shape, different animation timing, new param). To ship a breaking change, drop a NEW skill folder (`your_skill_id_v2`) rather than overwriting v1 — past videos referencing v1 stay reproducible.

### 1.6 Where the skill is rendered

`_shot_task` in `automation_pipeline.py` calls `skill_composer.compose(html, ctx)` after the per-shot LLM returns and before `_ensure_fonts`. The composer's regex matches `<skill data-skill-id="…" data-params='…'></skill>` (and self-closing variants). Your `html` fragment is substituted inline; your `css` is aggregated into a single `<style data-skill-css>` block in `<head>`; your `js` is aggregated into one IIFE `<script data-skill-js>` block before `</body>`.

---

## 2. Authoring a shot template

### 2.1 Create the folder

```
ai_service/app/ai-video-gen-main/shot_templates/
  your_template_id/
    template.py
```

### 2.2 The contract — three exports

```python
# shot_templates/your_template_id/template.py
from typing import Dict, Any
import html as _html

METADATA = {
    "id": "your_template_id",
    "version": "1.0.0",
    "title": "Human Title",
    "description": "One sentence on what the composition looks like.",
    "use_when": "Specific narrative pattern this layout fits — be concrete.",
    "compatible_shot_types": ["TEXT_DIAGRAM", "DATA_STORY"],   # PREFER explicit list over "*"
    "requires_tier": "premium",
    "requires_canvas": "any",
    "example_params": {                                         # appears verbatim in Director catalog
        "headline": "Two paths.",
        "left_label": "BEFORE", "left_text": "Pen and paper",
        "right_label": "AFTER", "right_text": "Always-on cloud",
    },
}

PARAMS_SCHEMA = {
    "type": "object",
    "required": ["left_label", "left_text", "right_label", "right_text"],
    "properties": {
        "headline":    {"type": "string"},
        "left_label":  {"type": "string"},
        "left_text":   {"type": "string"},
        "right_label": {"type": "string"},
        "right_text":  {"type": "string"},
    },
}

def render(shot: Dict[str, Any], params: Dict[str, Any], ctx: Dict[str, Any]) -> Dict[str, Any]:
    """Produce the FULL shot composition. No outer #shot-root wrapper —
    the composer adds it. Just the inner content + css + js."""
    shot_idx = ctx.get("shot_index", 0)
    pack     = ctx.get("shot_pack") or {}
    sid      = f"yt{shot_idx}"   # template-namespaced id prefix

    fs = pack.get("font_scale", {});  sp = pack.get("spacing", {});  ez = pack.get("ease", {})
    safe        = sp.get("safe_area", "4%")
    ease_entry  = ez.get("entry", "power3.out")
    fs_display  = fs.get("display", "8rem")

    html = (
        f'<div class="{sid}-stage stage-drift">'
        f'  <div class="{sid}-headline" id="{sid}-h">{_html.escape(params.get("headline","") or "")}</div>'
        f'  ...'
        f'</div>'
    )
    css = f"""
    .{sid}-stage {{ position:absolute; inset:0; padding:{safe};
                    color:var(--brand-text); font-family:'Inter',sans-serif; }}
    .{sid}-headline {{ font-family:'Bebas Neue', sans-serif; font-size:{fs_display}; opacity:0; }}
    """
    js = f"""
    gsap.to('#{sid}-h', {{opacity:1, y:-6, duration:0.5, delay:0.10, ease:'{ease_entry}'}});
    gsap.fromTo('.{sid}-stage', {{x:0,y:0,scale:1}}, {{x:12,y:-6,scale:1.02, duration:12, ease:'none'}});
    """
    audio_events = [
        {"role": "transition_in", "t": 0.10, "volume_mul": 0.85, "skill_id": "your_template_id"},
    ]
    return {"html": html, "css": css, "js": js, "audio_events": audio_events}
```

### 2.3 The seven non-negotiable rules

1. **Do NOT emit the outer `<div id="shot-root">`** — the composer wraps your `html` automatically. Just produce the inner stage.
2. **Read tokens from `ctx["shot_pack"]`** with sensible fallbacks. Templates run at premium+ and the shot pack is always available, but defensive defaults make the template testable in isolation.
3. **Namespace your IDs and class names** with a `f"yt{ctx['shot_index']}-…"` prefix or similar. Two templates in adjacent shots must not collide.
4. **Use `var(--brand-*)` for brand colors**, never hardcoded hex.
5. **Never use `window.addEventListener('load', …)`** in your `js` — same shadow-DOM rule as skills (invariant 8.9). The composer wraps your JS in an IIFE with `typeof gsap` guard.
6. **`compatible_shot_types`**: prefer an explicit allow-list over `"*"`. Templates have a hardcoded blocklist that always wins (`KINETIC_TEXT` / `KINETIC_TITLE` / `SOURCE_CLIP` — those have dedicated builders), but allow-list discipline is what makes the Director's catalog readable.
7. **Sanitize text params** — every string from `params` should pass through `html.escape()` before reaching `html`.

### 2.4 What `ctx` carries

| Key | Type | Notes |
|---|---|---|
| `shot_index` | int | Use for ID namespacing. |
| `canvas_w`, `canvas_h` | int | Pixel dimensions. Use to branch landscape vs portrait if needed. |
| `tier` | str | `"premium"` / `"ultra"` / `"super_ultra"`. |
| `shot_type` | str | The Director-assigned shot_type (already passed the compat check). |
| `shot_pack` | dict | Design tokens — see [§3.8.1 of AI_VIDEO_GENERATION.md](./AI_VIDEO_GENERATION.md). Always populated at premium+. |
| `transition_in` | str | The picker-resolved transition name. |
| `transition_css_block` | str | The GSAP code for that transition. The composer wires this onto `#shot-root` automatically — you do not need to emit it. |

### 2.5 Registering and testing

Auto-discovered. No registry edits.

```bash
cd vacademy_platform/ai_service/app/ai-video-gen-main
python3 -c "
from shot_template_registry import get_registry, build_catalog_for_director
print(sorted(get_registry().keys()))   # your_template_id should appear
print(build_catalog_for_director('premium', 'landscape'))
"
```

End-to-end smoke through the composer:

```python
from shot_template_composer import compose
ctx = {
    "shot_index": 0, "canvas_w": 1920, "canvas_h": 1080,
    "tier": "premium", "shot_type": "TEXT_DIAGRAM",
    "shot_pack": {}, "transition_css_block": "",
}
shot = {
    "shot_type": "TEXT_DIAGRAM",
    "template_id": "your_template_id",
    "template_params": {"left_label": "A", "left_text": "1", "right_label": "B", "right_text": "2"},
}
result = compose(shot, ctx)
assert not result["skipped"], result["reason"]
assert 'id="shot-root"' in result["html"]
print(result["html"][:500])
```

Test the failure paths too:

```python
# Specialized shot types — must skip
for st in ["KINETIC_TEXT", "KINETIC_TITLE", "SOURCE_CLIP"]:
    r = compose(shot, {**ctx, "shot_type": st})
    assert r["skipped"] and "specialized" in r["reason"]

# Missing required param — must skip with diagnostic
r = compose({"template_id": "your_template_id", "template_params": {"left_label": "x"}}, ctx)
assert r["skipped"] and "missing required" in r["reason"]

# Unknown template_id — must skip
r = compose({"template_id": "nope"}, ctx)
assert r["skipped"]
```

### 2.6 Where the template is rendered

In `_shot_task` (automation_pipeline.py), right after `shot_type` is read from the Director plan and **before** any system-prompt or LLM logic. The bypass:

1. Reads `shot.get("template_id")`. If empty, falls through to the LLM path.
2. Resolves `transition_in` and looks up `transition_css_block` from `prompts.TRANSITION_CSS_BLOCKS`.
3. Calls `shot_template_composer.compose(shot, ctx)`.
4. On success: runs the result through `_ensure_fonts()`, builds the entry, writes the per-shot cache file, returns immediately. **No per-shot LLM call.**
5. On `skipped`: logs the reason and continues to the LLM path as if `template_id` weren't set.

### 2.7 Versioning and rollout

Same rules as skills — bump `version` for output changes; ship breaking changes as a new template ID. The Director only sees templates whose `requires_tier` is ≤ the run's tier, so you can soft-launch a new template at super_ultra and promote later.

---

## 3. Authoring a transition (advanced)

Transitions are smaller than skills/templates and currently live as inline strings in [`prompts.py::TRANSITION_CSS_BLOCKS`](../../ai_service/app/ai-video-gen-main/prompts.py). To add one:

### 3.1 Add the GSAP block

```python
TRANSITION_CSS_BLOCKS["your_transition_name"] = (
    "gsap.fromTo('#shot-root', {opacity:0, x:'-30%'}, "
    "{opacity:1, x:'0%', duration:0.4, ease:'power3.out'});"
)
```

Targets `#shot-root` (the per-shot wrapper). Must work in both browser-iframe and renderer-shadow-DOM contexts:

- ✅ Use `gsap.fromTo`, `gsap.to`, `gsap.set` with `'#shot-root'` selectors — the renderer rewrites these to shadow-aware variants.
- ✅ Use `document.getElementById('shot-root')` if you need an Element reference — the renderer rewrites to `__sd_getElementById`.
- ❌ Never use `document.body.appendChild(...)` — that escapes shadow scope. Append to `document.getElementById('shot-root')` instead.
- ❌ Never wrap in `window.addEventListener('load', …)` — see invariant 8.9.

### 3.2 Register with the picker

Add the transition name to [`transition_picker._KNOWN_TRANSITIONS`](../../ai_service/app/ai-video-gen-main/transition_picker.py) and slot a rule into `pick()` describing when it should fire (cross-family pair, same-type chain, act boundary, etc.).

### 3.3 Smoke test

```python
from transition_picker import pick, normalize
assert normalize("your_transition_name") == "your_transition_name"
# Add a unit test for the rule that selects it
```

---

## 4. The shadow-DOM compatibility checklist

Both skills and templates run in two contexts: an iframe (browser player) and a shadow root (Playwright render server). The renderer rewrites these patterns automatically:

- `document.querySelector` → `__sd_querySelector`
- `document.querySelectorAll` → `__sd_querySelectorAll`
- `document.getElementById` → `__sd_getElementById`
- `window.RoughNotation` → `__sd_RoughNotation`
- `new Vivus(...)` → `new __sd_Vivus(...)`
- A scoped `anime` proxy resolves Anime.js targets within the shadow root

But it does NOT rewrite:

- `document.body` — escapes shadow scope. Use `document.getElementById('shot-root')` or append into a DOM node you created inside the shadow root.
- `document.head` — same problem.
- `window.addEventListener('load', …)` — there is no shadow-scoped `load` event.
- Any direct DOM construction that walks via `parentElement` / `parentNode` past the shadow root boundary — the boundary will return `null`.

**Rule of thumb**: if your code reaches outside its own subtree, it will work in the browser player and silently fail in the MP4. Verify by rendering a 5-second test video at super_ultra and inspecting the MP4 frames.

---

## 5. Common pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| Skill/template renders in browser, ships static in MP4 | `window.addEventListener('load', …)` wrapper, OR `setTimeout(...)` callback, OR `document.body.appendChild` | Drop the load wrapper, switch to `gsap.delayedCall`, scope DOM operations to `#shot-root` |
| ID collision when two skills/templates of the same type appear in adjacent shots | Forgot to namespace IDs by `ctx['shot_index']` | Prefix every `id="..."` and class selector with `f"sk{ctx['shot_index']}_"` (or similar) |
| Brand colors don't appear | Hardcoded hex instead of CSS vars | Use `var(--brand-primary)` etc. — see the shot pack `color_tokens` |
| Catalog doesn't show your skill/template to the Director | `requires_tier` higher than the run's tier, or `compatible_shot_types` doesn't include the actual shot type | Lower the tier, add the shot type, or add `"*"` (skills only — templates should keep allow-lists explicit) |
| `data-params` JSON parse error | Smart quotes or escaped-wrong inner quotes | Use single-quoted outer (`data-params='{"k":"v"}'`); never let the LLM mix quote styles |
| Renderer crashes on unknown plugin | `requires_plugins` references a CDN library not in the renderer's harness | Today only `gsap` and `gsap-motionpath` are wired up; for new plugins, edit `automation_pipeline.py:_shot_task` skill-compose plugin block + `generate_video.py` boilerplate |

---

## 6. End-to-end checklist before shipping

1. `python3 -c "import ast; ast.parse(open('skills/.../skill.py').read())"` parses cleanly.
2. `from skill_registry import get_registry; assert 'your_skill_id' in get_registry()` (or shot_template_registry equivalent).
3. End-to-end compose smoke test passes — renders the right HTML shape, no exceptions.
4. The skill appears in `build_catalog_for_shot('YOUR_SHOT_TYPE', 'ultra', 'landscape')` (or `build_catalog_for_director`).
5. Generate one ultra-tier video that exercises the new skill/template; inspect:
   - Browser player: animation runs, IDs don't collide if multiple shots use it
   - MP4 render: animation runs identically, no static frames
6. If the new module is interesting/load-bearing, mention it in the next batch update of [AI_VIDEO_GENERATION.md](./AI_VIDEO_GENERATION.md) §3.13 (skills) or §3.14 (templates). Adding a new module to the existing categories does NOT require a doc update — the registry is authoritative.

---

## 7. References

- [skill_registry.py](../../ai_service/app/ai-video-gen-main/skill_registry.py) — registry implementation, ~230 lines
- [skill_composer.py](../../ai_service/app/ai-video-gen-main/skill_composer.py) — composer implementation, ~180 lines
- [skills/motion_primitives/number_counter/skill.py](../../ai_service/app/ai-video-gen-main/skills/motion_primitives/number_counter/skill.py) — concise reference skill
- [shot_template_registry.py](../../ai_service/app/ai-video-gen-main/shot_template_registry.py) — registry implementation
- [shot_template_composer.py](../../ai_service/app/ai-video-gen-main/shot_template_composer.py) — composer with skip-path discipline
- [shot_templates/split_comparison/template.py](../../ai_service/app/ai-video-gen-main/shot_templates/split_comparison/template.py) — concise reference template
- [transition_picker.py](../../ai_service/app/ai-video-gen-main/transition_picker.py) — picker rules + the `_KNOWN_TRANSITIONS` allow-list
- [prompts.py::TRANSITION_CSS_BLOCKS](../../ai_service/app/ai-video-gen-main/prompts.py) — transition GSAP strings
- [AI_VIDEO_GENERATION.md](./AI_VIDEO_GENERATION.md) — full pipeline architecture; §3.13–§3.16 cover skills, templates, transitions, and image continuity
