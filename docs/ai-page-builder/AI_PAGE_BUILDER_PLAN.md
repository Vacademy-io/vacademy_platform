# AI Page Builder — "Describe it, get a website"

> **Status:** PLANNED (decisions locked 2026-07-14) · **Owner surfaces:** frontend-admin-dashboard `manage-pages/`, `ai_service`, `admin_core_service`, `media_service`
> **Companion docs:** `frontend-learner-dashboard-app/docs/CATALOGUE_WORLDCLASS_INFRA_ROADMAP.md` (layer G5), `COURSE_CATALOGUE_EDITOR_SPEC.md`

## 1. Vision

An institute admin — with zero design or technical skill — describes what they want, drops in their
logo, photos, a brochure, screenshots of sites they admire, or their existing website URL, and gets a
**finished, on-brand catalogue page** built from our real component system. Afterwards they keep
talking to the AI: *"make the hero darker"*, *"add a testimonials section after the courses"*,
*"replace that photo"* — every change previewed before it lands, nothing live until they publish.

**Why this is uniquely cheap for us:** pages are already **pure JSON** — typed components
(`heroSection`, `featureGrid`, `sectionHeading`, `stepsProcess`, …) styled by a shared token engine
(themes, effects, ornaments, dividers, motion — the P0–P1c vocabulary). The AI never writes
HTML/CSS. It writes a constrained JSON document that the admin canvas and the learner app already
know how to render, theme, validate, and hand-edit. AI output is therefore always **fully editable
by hand afterwards** — no lock-in to the AI, no opaque generated code.

## 2. Locked decisions (product Q&A 2026-07-14)

| Question | Decision |
|---|---|
| Entry point | **Wizard + copilot** — "Create page with AI" wizard for the first draft, persistent AI chat panel in the editor for iterative edits |
| Inputs at launch | **All four**: images/logo upload · screenshots as inspiration (vision) · existing-website URL import · docs/brochures/raw text |
| Edit application | **Preview diff, then Apply** — AI proposes, canvas shows before/after, user applies or discards |
| Billing | **Academy credits** — per-run metering via the existing credits system (DB-tunable rates, cost preview) |
| Theme scope | **Full brand kit** — AI derives ThemePack (primary color, font pairing, atmosphere, radius, heading scale) from logo/screenshots/site |
| Generation scope v1 | **Single page per run** — one full page per wizard run; copilot edits one page at a time |
| Draft flow | **Variants + refine chat** — "Try another direction" regenerates with a new design angle; refinements typed before accepting; nothing touches the real page until accepted |
| Onboarding | **Manage-pages first**, reuse the engine in institute onboarding as phase 2 |
| Institute data | **Data-aware** — AI reads real courses/prices/sessions and places live components (`courseCatalog`, pricing) + copy referencing real course names |
| Publish semantics | **Draft + explicit Publish** — new page-revision model; learners see last published revision; Apply lands on draft; rollback/history included |
| Language | **English-first** (best-effort mirror of the brief's language); formal selector later |

## 3. Architecture

```
                       ┌────────────────────────────────────────────────┐
 admin manage-pages    │                 ai_service (Python)            │
 ┌──────────────────┐  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
 │ AI Wizard        │──┼─►│ Ingest   │─►│ Brand Kit│─►│  Composer    │  │
 │ (brief + assets) │  │  │ pipeline │  │ deriver  │  │ (page JSON)  │  │
 ├──────────────────┤  │  └────┬─────┘  └──────────┘  └──────┬───────┘  │
 │ AI Copilot panel │──┼──────────────────────────────►│ Editor (ops) │ │
 │ (chat + diffs)   │  │       │                       └──────┬───────┘ │
 └────────┬─────────┘  │       │            Validator ◄───────┘         │
          │            └───────┼────────────────────────────────────────┘
          ▼                    ▼
 admin_core_service      media_service (S3)         admin_core_service
 (institute data:        (uploaded + harvested      (catalogue revisions:
  courses/prices)         images, re-hosted)         draft / published)
```

### 3.1 Ingestion pipeline (`ai_service`)

One endpoint family, four asset kinds, all normalized into a single **"source pack"** the composer
consumes:

- **Images + logo** — uploaded through the existing media_service flow; ingest records
  `{media_id, public_url, kind: logo|photo|banner, vision_caption}` (one cheap vision pass captions
  each image so the composer can place them meaningfully).
- **Screenshots (inspiration)** — vision model extracts a **design brief**, never content: section
  order, layout patterns (split hero? logo wall? dark theme?), mood words, density. Output is a
  structured `inspiration` object; the composer maps it onto OUR presets (atmosphere, effects,
  variants) — no copying of text/images from the screenshot.
- **Existing website URL** — server-side fetch + readability extraction: page text, headings,
  nav labels, brand colors (from CSS/logo), and image URLs. Harvested images are **re-hosted to our
  S3** (same lesson as the course-PDF pipeline: third-party URLs rot). Output: `site_import`
  {sections of real copy, color candidates, image media_ids}.
- **Docs / brochures / raw text** — PDFs go through the existing MathPix pdf pipeline (already used
  for course grounding); DOC/TXT/pasted text used directly. Output: `content_corpus` chunks tagged
  by topic (about-us, courses, faculty, contact…).

### 3.2 Brand Kit deriver

Inputs: logo + screenshots + site_import color candidates + the brief.
Output: a **ThemePack proposal** using only knobs the system already has:

```json
{
  "primaryColor": "#0F6E5D",
  "themePreset": "custom",
  "fontPairing": "fraunces+inter",        // from the 16-face registry
  "atmosphere": { "canvas": "soft", "intensity": "subtle" },
  "headingScale": "editorial",
  "borderRadius": "rounded",
  "motion": { "personality": "calm" },
  "rationale": "Deep green from logo; serif display matches premium coaching positioning"
}
```

The wizard renders **2–3 brand kit options as live mini-previews** (the token engine makes this a
pure client-side re-render — zero extra AI cost per preview). The chosen kit is written to
`globalSettings` on the draft and becomes context for every later generation, so all pages stay
coherent. The copilot may *propose* theme changes later but they go through the same diff-preview.

### 3.3 Composer (page generation)

- **System prompt = auto-generated schema catalog.** A build step exports the component vocabulary
  from the single source of truth the editor already uses: `component-templates.ts` (every type +
  canonical props) + the engine's `ComponentStyle` schema + the curated preset vocabulary
  (MESH/ORNAMENT/BORDER_GRADIENT presets, effects, section shell, stagger, hero v2, accordion
  variants, steps timelines…). This file (`catalogue-schema-catalog.json`) is checked in and
  regenerated whenever templates change — the AI can never invent a component the renderers don't
  have.
- **Design doctrine** distilled from the world-class infra work rides in the prompt: rhythm rules
  (sectionHeading before dense sections, alternate surface tints, one hero per page), presets-first
  styling, back-compat-safe fields only, terminology from the institute's **Naming Settings**
  (Course→Product etc. — page copy must use their terms).
- **Institute data snapshot**: composer receives a compact JSON of real courses (names, prices,
  levels, sessions, tags) from admin_core, so *"landing page for my Arduino course"* uses real
  names/prices and places live `courseCatalog`/pricing components (which render real data at
  runtime anyway — the AI only decides placement + filters).
- **Output contract**: one `Page` JSON (components array), strict server-side JSON-schema
  validation + a semantic lint pass (unknown types, missing required props, images referenced
  outside the source pack, raw hex where a token belongs, `htmlBlock` forbidden — see §6). Invalid
  → automatic repair round-trip; still invalid → error surfaced, no charge for failed runs.
- **Variants**: "Try another direction" re-runs the composer with a different injected design angle
  (e.g. *editorial-serif storytelling* vs *bold conversion-focused* vs *minimal Swiss*) — same trick
  as the video pipeline's direction picker. Refinement messages in the wizard patch the current
  draft instead of regenerating from scratch.

### 3.4 Copilot (iterative editing)

- Context: current draft page JSON + selected component id (if any) + brand kit + recent chat.
- Output: **a list of operations**, not a whole page — `insert(component, afterId)`,
  `update(id, propsPatch, stylePatch)`, `remove(id)`, `move(id, afterId)`,
  `updateGlobalSettings(patch)`. Ops keep diffs small, cheap, and reviewable; whole-page rewrites
  are reserved for explicit "redesign this page" asks.
- FE applies ops to a **shadow copy**, the canvas renders it with changed components outlined, and a
  diff card in the chat lists the changes in plain language ("Added a Testimonials section after
  Courses · Hero background → dark mesh"). **Apply** merges into the draft revision; **Discard**
  throws the shadow away. Selected-component asks scope the ops to that component.
- The existing manual editor keeps working on the same draft at all times — AI and hand-editing are
  the same document.

### 3.5 Draft / Publish / History (admin_core_service)

Today `course_catalogue` stores one live `catalogue_json` per tag (status is per-catalogue). New:

```
catalogue_revision
  id UUID PK · catalogue_id FK · revision_no INT
  catalogue_json TEXT · status DRAFT|PUBLISHED|DISCARDED
  created_by · created_at · source MANUAL|AI_WIZARD|AI_COPILOT · ai_run_id NULL
```

- Learner endpoints keep serving the **latest PUBLISHED** revision (the existing `catalogue_json`
  column becomes a denormalized pointer/copy of it — zero learner-side change).
- Editor loads latest DRAFT if one exists, else forks one from PUBLISHED on first edit.
- **Publish** promotes the draft; **History** lists revisions with one-click rollback
  (rollback = new draft from an old revision, then publish).
- This is a prerequisite shipped in Phase A — it also derisks *manual* editing today (currently
  save = live).

### 3.6 Credits & billing

New DB-tunable tool keys (V-migration, same pattern as course-creation billing):
`page_brand_kit`, `page_generate` (wizard run / variant), `page_edit` (copilot op batch),
`page_site_import` (URL scrape + vision), priced per run with per-run idempotent charges keyed by
`ai_run_id`. The wizard shows an estimated credit cost before the big buttons; failed/invalid runs
are not charged. Model tiering: premium model for `page_generate`/brand kit, cheaper tier for small
copilot ops (registry-driven, like the video pipeline's per-stage models).

## 4. UX flows

**Wizard** (entry: "Create page with AI" on the catalogue list + inside the editor's page tabs):
1. **Brief** — one big friendly textarea ("Tell us about this page…") + page-type chips (Homepage,
   Course landing, About, Admissions, Contact) + toggle "use my real course data" (default on).
2. **Assets** — drag-drop images/logo/PDF · "Screenshots of sites you like" drop zone · "Import from
   my current website" URL field. All optional; each shows an ingest status chip.
3. **Brand kit** — 2–3 generated kits as mini page previews; pick one (or "keep my current theme").
4. **Generate** — progress with staged messages (reading your brochure → designing sections →
   writing copy). Cost shown up front.
5. **Review** — full draft rendered on the real canvas. Buttons: **Accept draft** (lands as page
   draft), **Try another direction**, refine chat box ("make it feel more premium", "add a fee
   structure section"). Accept ≠ publish — banner reminds them to Publish when ready.

**Copilot panel** (right sidebar tab next to Properties): chat thread; each AI reply that changes
the page carries a diff card (plain-language change list + Apply/Discard); when a component is
selected, a scope chip shows "editing: Hero Section". Quick-action chips seed common asks
("Add section ▾", "Rewrite copy", "Change mood").

## 5. Phasing

| Phase | Ships | Notes |
|---|---|---|
| **A — Foundations** | `catalogue_revision` draft/publish/history + Publish UI · schema-catalog export script · ai_service `POST /page-builder/v1/generate` (brief + uploaded images only) · wizard steps 1/2/4/5 (no brand kit, no URL/PDF) · credits keys + cost preview | End state: brief + photos → full draft page → publish. Already demo-able. |
| **B — Brand + Copilot** | Brand kit deriver + wizard step 3 · copilot panel with op-based edits + diff cards · variants ("try another direction") · refine chat in wizard | The "living website" experience. |
| **C — Heavy ingestion** | Website URL import (scrape + re-host + brand extraction) · screenshot inspiration (vision design brief) · PDF/brochure corpus | The "migrate my site in 5 minutes" hook. |
| **D — Growth** | Onboarding integration ("set up your website" on institute signup) · multi-page site runs with shared nav/footer · language knob · saved-blocks learning (G3/G4 synergy) | After quality is proven in B/C. |

## 6. Guardrails & risks

- **Schema-bound output only** — validation + repair loop; unknown component types/props stripped.
- **No `htmlBlock` from AI** (XSS surface + unstyleable); the vocabulary is rich enough without it.
- **Images**: AI may only reference media_ids from the source pack (uploaded/harvested/existing
  institute media). No hotlinking, no AI-invented URLs.
- **Inspiration ≠ copying**: screenshots produce structural/mood briefs only; site import is meant
  for the institute's *own* site — put that in the UI copy ("import content you own").
- **Naming Settings compliance**: page copy uses the institute's configured terms.
- **Blast radius**: single page per run + draft/publish + revision history + diff-preview = nothing
  destructive is one click away.
- **Quality bar risk**: first drafts must look designed, not assembled — mitigations: brand kit
  first, curated preset vocabulary, design doctrine in prompt, premium model for generation, and a
  cheap self-critique pass ("does this page violate rhythm rules?") before returning.
- **Cost risk**: vision passes and scrapes are metered (`page_site_import`); caps per run.

## 7. Open questions (to resolve during Phase A build)

1. Concurrency: two admins editing the same draft (last-write-wins today) — acceptable for v1?
2. Where the copilot chat history lives (per draft revision? per catalogue?) and for how long.
3. Draft preview link for learners-eye review before publish (signed preview URL?).
4. Rate limits / abuse: per-institute daily generation cap in addition to credits?
5. Whether Phase A should also expose "AI: generate one section" inside the existing add-component
   flow (cheap subset of the composer — possibly a free teaser that markets the full wizard).
