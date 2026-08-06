# Feature catalog build pipeline

The two deliverables in the parent folder are **generated from one data source** so they never drift:

```
catalog.json  ──►  build_catalog.py  ──►  ../vacademy-features.md
                        │                 ../vacademy-features.html
explorer-template.html ─┘
```

## How to update the catalog

1. Edit `catalog.json` — it holds the full product taxonomy:
   `pillars[] → features[] → subFeatures[]`. Each feature has `id` (kebab-case,
   unique within its pillar), `name`, `tagline`, `description`, `roles`,
   `platforms`, `subFeatures[{name, description}]`.
2. Bump `meta.updated` in `catalog.json` to today's date, then regenerate:

   ```bash
   python3 build_catalog.py catalog.json explorer-template.html ..
   ```
3. Commit `catalog.json` + the two regenerated files together.

Quick edits directly in `vacademy-features.html` (its embedded `DATA` object)
or in the `.md` also work — but then mirror the change in `catalog.json` so
the next regeneration doesn't lose it.

## Template

`explorer-template.html` is the interactive explorer shell (search, product
cards, deep-dive pages). `build_catalog.py` injects the JSON where the
`__DATA_JSON__` placeholder sits. Change look & feel in the template; change
content in `catalog.json`.

## Admin portal demo

`../admin-portal-demo.html` is a second, standalone deliverable: a full-viewport,
clickable walkthrough of the admin portal (no feature-catalog chrome).

```
admin-demo.json ─────►  build_admin_demo.py  ──►  ../admin-portal-demo.html
admin-demo-template.html ┘        ▲
explorer-template.html ───────────┘  (mock CSS + renderers, lifted verbatim)
```

Regenerate with:

```bash
python3 build_admin_demo.py admin-demo.json admin-demo-template.html explorer-template.html ..
```

The mock engine is **not** duplicated — the build script slices the
`PRODUCT-ACCURATE APP MOCK` CSS block and the widget/screen renderers straight
out of `explorer-template.html`, so a styling change there lands in both
deliverables. Rebuild both after editing the template.

- `admin-demo.json` holds `modules[] → nav[] → {label, page | children[]}` plus a
  flat `pages{}` map. Page bodies use the same widget schema as the guided demos.
- Every `page` referenced by nav must exist; the build fails loudly if not, and
  reports pages that no nav item can reach.
- Deep links work: `admin-portal-demo.html#lms/courses`.

### Imagery

`assets/*.jpg` holds the photographic covers used by the portal demo (course
cards, Instructor Copilot, product pages, storyboard shots, video posters).
`build_admin_demo.py` inlines every `img` / `poster` path it finds in
`admin-demo.json` as a base64 data URI, so the deliverable stays one portable
file — reference them as `"img": "assets/course-ai-ml.jpg"`.

They were generated with `genimg.py` (OpenRouter, `krea/krea-2-large`), which
centre-crops to 2:1, resizes to 640×320 and compresses to ~20–35 KB each:

```bash
OPENROUTER_API_KEY=... python3 genimg.py     # regenerates every asset
```

Edit the `SHOTS` list in that script to change or add covers. A card may carry
`img` **and** `banner` — the photo becomes the cover and the banner text is set
over it with a scrim; `banner` alone falls back to a generated SVG cover.

### Widget types

The renderers live in the `W` map inside `explorer-template.html`. Beyond the
basics (`header`, `stats`, `table`, `cards`, `list`, `form`, `chart`, `funnel`,
`kanban`, `chat`, `tree`, `notify`, `wizard`, `builder`, `invoice`, `call`,
`video`, `player`, `whiteboard`, `tabs`, `filters`, `hero`, `askbar`) the portal
demo adds:

| type | mirrors |
| --- | --- |
| `segments` | Learning Timeline / Progress / AI Analysis, Roster / Content Map / Live Feed |
| `props` | the labelled Session Details grid |
| `session` | a scheduled-session card with join link + QR |
| `thread` | the two-pane Doubt Management inbox |
| `ranks` / `badges` | the leaderboard and its badge strip |
| `slidelist` | the Lecture Video Slides editor rail |
| `modal` | dialogs such as Activity Stats and Enroll Learner |
| `assistant` | the Vacademy Assistant chat panel |

`modal` and `slidelist` nest other widgets via a `widgets: []` array, so a dialog
can contain stats, filters and lists. QR codes are drawn deterministically from
the session title — no image asset needed.

### The assistant dock

`admin-demo.json` has a top-level `assistant` object (an `assistant` widget) that
the portal renders **once, outside `#app`**, floating over whatever page is open.
Clicking **Assist** in the right utility rail toggles it; the × in its header
closes it. It is chrome, not a page, so it survives navigation.

Because it renders outside the `.mock` shell it would inherit none of the
`--p-*` design tokens, so the token block is scoped to
`.mock, .phone, [data-mock-tokens]` and the dock carries `data-mock-tokens`.
Any future overlay rendered outside the shell needs that attribute too.
