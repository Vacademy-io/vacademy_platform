# Catalogue Infrastructure — Path to World-Class Output

> **Version:** 1.2 · **Date:** 2026-06-20 · **Status:** P0 + P1 largely BUILT (see Build Status)

## Build Status (2026-06-20)

| Phase | Status | Notes |
|---|---|---|
| **P0 Foundations** (A1–A4, B3, B4, G1) | ✅ BUILT + adversarially reviewed (12/12 findings fixed) | Shared style engine + sync gate in pre-commit; Section Shell; token sweep; reduced motion; font registry/loader; fluid type scale (safelisted); canvas parity step 1 |
| **P1a Effects & Hero** (C1–C4 effects, B5 atmosphere, D1 hero v2) | ✅ BUILT + reviewed (11/11 fixed) | glass/glow/borderGradient/backgroundLayers/scrims + Premium Effects presets; atmosphere axis; Hero v2 (eyebrow/multi-CTA/stat chips/trust) |
| **P1b Components & Motion** (D2–D6, E4, E5) | ✅ BUILT + adversarially reviewed (10/10 findings fixed) | Accordion split-with-artifact + slots; persona featureGrid (chips/bullets/icons/skins); labeled logo walls; trustChip + testimonial ratings; steps timeline variants; stagger (no-marker fallback); motion personalities (unset = legacy :root fallbacks) |
| C5 ornaments · C6 dividers · D7 SectionHeading · E1–E3 layout | ⏳ Not started | |
| F1–F5 media pipeline | ⏳ Not started | F1 batch-resolve needs a new public media endpoint (cross-service) |
| G2–G5 velocity (blocks, packs, AI) | ⏳ Not started | |
| Accordion slot-authoring UI | ⏳ Known gap | Slots render from JSON/templates; editor UI pending |
> **Companion to:** `COURSE_CATALOGUE_EDITOR_SPEC.md`
>
> **Question this answers:** what must we build in the catalogue page-builder
> (admin `manage-pages/` + learner `$tagName/` + token system) so that *admins*
> can produce premium, world-class course websites — without us hand-building
> any single site. Derived from a 7-domain capability-gap analysis (49 findings,
> code-verified) against the bar set by premium modern edtech/cohort pages.

---

## 1. Thesis

The builder today can express a **clean flat page**; it cannot express an
**atmosphere** — and atmosphere (layered light, glass, editorial type, composed
sections, confident motion) is what separates world-class sites from tidy ones.
The gaps are not 50 small features: they collapse into **seven infra layers**,
three of which are foundations everything else sits on. The strategy is
*capability + taste-by-default*: expose new power almost exclusively through
**curated presets** (theme packs, skins, motion personalities), keep every
schema change **additive** so existing tenant JSON renders pixel-identically,
and fix the **authoring loop** (canvas parity, reuse, AI) so ambition is cheap.

---

## 2. The Capability Stack

### Layer A — Shared Style Engine + Section Shell *(foundation)*

**Unlocks:** one place to add every future effect; full-bleed atmosphere with
contained content; ends admin/learner style drift.

| Item | Proposal | Effort |
|---|---|---|
| A1. **`catalogue-style-engine`** shared module | Extract `ComponentStyle` types + `buildComponentStyle`/`buildResponsiveCSS` + all new compilers into ONE canonical module consumed by both `CanvasRenderer` (admin) and `ComponentStyleWrapper` (learner). Both apps currently run duplicate, already-drifting copies of `style-utils.ts`. Add a sync-check script (pattern: `design-lint.mjs`). | M |
| A2. **Section Shell** (two-node wrapper) | `ComponentStyle.layout?: { width: 'text'\|'narrow'\|'default'\|'wide'\|'full-bleed'; contentMaxWidth?; zIndex?; overlapTop?; overlapBottom? }`. When present, wrapper renders **outer canvas div** (full-width: backgrounds, ornaments, dividers, z) + **inner content column** (`max-width` from existing `--catalogue-container-*` tokens). This one change is the prerequisite for mesh backgrounds, dividers, ornaments and overlap. | L |
| A3. **Token sweep of `JsonRenderer` sections** | ~19 inline renderers hardcode `bg-white`/`text-gray-*` → swap to `catalogue-*` tokens (mechanical; the aliases exist). Without this, **no theme can ever reach most of the page**. Add a design-lint rule banning raw grays in `$tagName` renderers. | M |
| A4. **Reduced-motion guarantee** | `usePrefersReducedMotion()` in `ComponentStyleWrapper` (skip inline animation styles, show content immediately) + `prefers-reduced-motion` blocks for marquee/hover classes. Configured motion currently ignores it entirely (WCAG 2.3.3). | S |

### Layer B — Theme Engine v2 *(the personality axis)*

**Unlocks:** "premium dark editorial" as a one-switch institute personality.
Today `[data-catalogue-theme]` presets are **hue swaps only**.

| Item | Proposal | Effort |
|---|---|---|
| B1. **ThemePack schema** | `GlobalSettings.theme.pack?: { id; base:'light'\|'dark'; primary /* seed → generated 50-500 */; surfaces?; text?; typography?:{pairingId}; radius?; atmosphere?; motion?; skin?:'flat'\|'soft'\|'glass' }`. Applied as data-attrs + CSS vars in `CourseCataloguePage`. Presets become *data*, not CSS files. Legacy `theme.preset` keeps working (a pack can alias it). | L |
| B2. **Font pairing system** | `GlobalSettings.typography?: { pairingId?; display?:{family,weights,letterSpacing}; body?:{family,weights}; customFonts?:[{name,woff2Url,weight}] }` + a shared `catalogue-fonts.ts` registry (serif display faces included — Fraunces, Playfair, Newsreader…) + curated **pairing gallery** in the editor (each option rendered in its own face). Today: one global sans from a 10-item list; serif/display type is impossible. | M |
| B3. **`ensureFontsLoaded()`** | Walk config (global typography + every `style.typography.fontFamily` incl. responsive) → inject ONE merged css2 link. Fixes the **silent break** where StyleEditor offers per-component fonts the learner never loads. Editor imports the same registry. | S |
| B4. **Fluid display type scale** | Replace the dead `--heading-h1/h2/h3` knob (zero consumers — verified) with `--catalogue-display/h1/h2/h3/lead` fluid clamps + `--catalogue-display-tracking/-weight/-leading` personality tokens; `[data-heading-scale]` scales the clamp bounds; sweep hero/section headings onto the scale. | M |
| B5. **Atmosphere axis** | `theme.atmosphere?: { canvas:'flat'\|'soft'\|'mesh'\|'aurora'; intensity:'subtle'\|'medium'\|'bold'; glassSurfaces?; glowAccents?; sectionAlternation? }` → `data-catalogue-atmosphere` attr driving token overrides per atmosphere×mode. Builds on the hero-mesh tokens shipped 2026-06-17. | M |

### Layer C — Effects & Surface System

**Unlocks:** glass, glow, gradient borders, layered backgrounds, scrims,
ornaments, section dividers — the entire "premium surface" vocabulary.
All are new **optional `ComponentStyle` fields** compiled by Layer A's engine,
with curated presets in `StyleEditor`.

| Item | Proposal | Effort |
|---|---|---|
| C1. **Glass** | `glass?: { blur:'sm'\|'md'\|'lg'; tint?; borderOpacity? }` → `backdrop-filter` + new `--catalogue-glass-bg/-border` tokens (light+dark). | S |
| C2. **Gradient border + glow** | `borderGradient?: { angle?, stops, width? }` (mask-composite technique) and `glow?: { color?, intensity }` riding the existing `--catalogue-card-glow` token family. | M |
| C3. **Background layers** | `backgroundLayers?: BackgroundLayer[]` (`color\|linear\|radial\|image\|mesh\|noise\|grid`, each with opacity/blend) composed into one `background-image` list. Replaces today's single-slot background; also fixes gradient+image mutual exclusivity. | M |
| C4. **Image overlay/scrim presets** | `backgroundOverlay?: { preset:'scrim-dark'\|'scrim-bottom'\|'scrim-light'\|'brand-tint'\|'custom' … }` — legible text over photos in one click. | S |
| C5. **Ornaments** | `ornaments?: [{ preset:'blob'\|'ring'\|'dots'\|'grid'\|'glow-orb'\|'image'; x,y,size,color?,opacity?,blur?,parallaxDepth? }]` rendered aria-hidden at z:0 inside the Section Shell; colors ride `--primary-*`. | M |
| C6. **Section dividers** | `dividers?: { top?, bottom?: { shape:'wave'\|'angle'\|'curve'…, height?, flip?, color:'auto' } }` as inline SVGs on the shell edges; `auto` samples the adjacent section's canvas. | M |

### Layer D — Component Expressiveness *(all 7 formally verified)*

**Unlocks:** the composite sections premium pages are made of. All additive
props; absent fields render byte-identical to today.

| Item | Proposal | Effort |
|---|---|---|
| D1. **Hero v2** | `eyebrow?{text,icon,style}`, `left.buttons?[]` (variant primary/secondary/ghost), `statChips?[]`, `trust?{avatars,rating,text}`, `media?{kind:'image'\|'carousel'\|'video'\|'slot'}` where **slot recurses through `renderComponent`** (same pattern as columnLayout). Also fixes: template's `left.subheading`/`left.tags` are currently **silently dropped** by the renderer (verified). | M |
| D2. **Accordion-with-artifact** | `tabsAccordion` items gain `icon?`, `meta?`, `slot?: Component[]`; `variant:'plain'\|'boxed'\|'split'` — `split` shows the open item's slot in a sticky right panel (curriculum + project card). | M |
| D3. **Persona cards** | `featureGrid`: item `chips?[]`, `bullets?[]`, `link?`, `iconName?` (curated Phosphor set); grid `align`, `cardSkin:'cards'\|…\|'glass'\|'gradient-border'\|'tinted'`. | M |
| D4. **Journey timeline** | `stepsProcess` `variant:'plain'\|'timeline-cards'\|'alternating'`, `nodeStyle`, `connectorGradient`; step `meta?`, `chips?`, `state:'highlight'`. | M |
| D5. **Labeled logo wall** | `logoCloud` logos `label?`; `display:'logo'\|'logo+label'\|'label-pill'`, `tile:'none'\|'card'\|'pill'`, `marqueeSpeed`. | S |
| D6. **Trust primitives** | testimonials `rating?`/`highlight?` + new micro-component `trustChip` (avatar stack + rating + text). | S |
| D7. **SectionHeading primitive** | Shared `props.heading?: { eyebrow?, title, highlight?{text,style:'gradient'\|'underline'\|'mark'}, lead?, align?, size? }` + one `<SectionHeading/>` renderer consumed by all sections (uses the shipped-but-unused `.catalogue-eyebrow`). | M |

### Layer E — Layout & Motion

| Item | Proposal | Effort |
|---|---|---|
| E1. **Overlap/stacking** | `offset?: { y?, zIndex? }` (negative margins done right, auto-reduced on mobile). | S |
| E2. **columnLayout v2** | True `columnFr?[]` widths, `xl/2xl` gaps, `reverseOnMobile?` — **and fix slot children's `ComponentStyle` being dropped on the learner** (route slots through the same wrapped-render path). | M |
| E3. **Sticky + aspect/viewport** | `sticky?:{enabled,top}` (enroll rails); `aspectRatio?` + `contentAlign?`; min-height presets incl. `100svh`. | S |
| E4. **Stagger** | `entrance.stagger?:{interval,maxItems}` — item mappers emit `--stagger-i`; cards/logos/FAQs cascade instead of thudding in as one block. | M |
| E5. **Motion personality** | `GlobalSettings.motion?:{personality:'none'\|'calm'\|'balanced'\|'dynamic'}` → `--catalogue-motion-*` tokens; components inherit unless overridden. Editor shows **presets, not ms sliders**. | M |
| E6. **Motion authoring loop** | Canvas/preview replay button (postMessage `REPLAY_ANIMATION`), hover-preview on entrance options. Admins currently configure motion blind. | M |
| E7. **Marquee primitive + hover catalog + parallax** | Shared `MarqueeStrip` (speed/direction/fadeEdges) as a real component type; hover types `border-glow/img-zoom/arrow-slide` with intensity; wire the **dead `scroll.parallax` schema** (typed in both apps, implemented in neither) to ornament/background layers only. | M |

### Layer F — Media & Asset Pipeline

| Item | Proposal | Effort |
|---|---|---|
| F1. **MediaRef + batch resolve** | Image props accept `string \| { fileId, url, width, height, alt, focal }`; store the resolved URL at upload time; add public **batch** get-details endpoint; learner `MediaResolverProvider` kills the per-image URL waterfall. | M |
| F2. **SmartImage** | One shared renderer: `srcset/sizes`, lazy, `decoding=async`, `aspect-ratio` + dominant-color placeholder from MediaRef (CLS→0). Tier A optimization via CDN URL params (e.g. Cloudflare `format=auto,width=`); Tier B = on-upload derivatives later. | M→L |
| F3. **Asset library** | Searchable per-institute library dialog (list endpoint on `UserToFile` by source+instituteId) behind every `ImageUploadField`; crop + focal point + alt text. | L |
| F4. **Icon system** | Value convention `phosphor:GraduationCap[:duotone]` \| `image:<url>` \| literal emoji (back-compat); curated ~100-icon tree-shaken `CatalogueIcon` + searchable picker reused by hero/features/steps editors. | M |
| F5. **Video & background video** | `videoEmbed` `sourceType:'embed'\|'file'` + poster/loop/muted; `ComponentStyle.backgroundVideo?` for hero atmosphere (muted, poster-first, reduced-motion-safe). | M |

### Layer G — Authoring Velocity *(power is useless if slow)*

| Item | Proposal | Effort |
|---|---|---|
| G1. **Canvas parity, step 1** | Import catalogue tokens/animations CSS into the admin canvas (scoped), set `data-heading-scale`/fonts/theme vars on the canvas wrapper, use the shared style engine. The canvas is currently a ~1000-line parallel mock that hides theme, fonts, and motion while editing. Step 2 (later): render real learner components in the canvas. | M→L |
| G2. **Saved blocks & style presets** | `blocks?: SavedBlock[]` + `stylePresets?: SavedStylePreset[]` on `CatalogueConfig` (zero backend), then institute-scoped sharing. "Save this styled section" → reuse anywhere. | M |
| G3. **Template pack pipeline** | Serializable `PageTemplate` JSON (with styles + `themeHint`) fetched from a remote manifest — ship premium packs **without frontend deploys**. Author 2 flagship packs ("Editorial Light", "Midnight Premium") as the taste showcase. | M |
| G4. **AI section/page generation** | `ai_service` endpoint: prompt + globalSettings + component-schema catalog → validated `Component[]` (reject unknown types/props server-side). Surfaces: "Generate section", "Restyle page to match brand". The pure-JSON schema makes this uniquely cheap for us. | M |
| G5. **Library & DX polish** | Live mini-render thumbnails + categories/search in ComponentLibrary; skin variants in `VariantSwitcher`; Delete/Cmd-C/V/D/Esc/Alt-arrows shortcuts; persistent clipboard; validated JSON mode. | M |

---

## 3. Dependency Map

```
A1 style-engine ──► C1-C6 effects fields ──► StyleEditor preset UI
A2 section shell ──► C3 layers · C5 ornaments · C6 dividers · full-bleed
A3 token sweep ───► B1/B5 themes actually reach content
B2 pairing + B3 loader ──► B4 type scale ──► D7 SectionHeading
B1 ThemePack ────► B5 atmosphere · E5 motion personality · G3 themeHint packs
D1/D2 slots ─────► reuse columnLayout slot recursion + editor slot UI
F1 MediaRef ─────► F2 SmartImage ──► F3 asset library
G1 canvas parity ─► credible authoring of everything above
G4 AI ───────────► needs component registry/schema catalog (G5 groundwork)
```

## 4. Phasing

**P0 — Foundations (2–3 weeks, 1–2 devs).** A1 engine, A2 shell, A3 token
sweep, A4 reduced-motion, B3 font loader, B4 type scale, G1 canvas parity
step 1. *Outcome: themes reach every pixel, canvas is truthful, the platform
is ready to accept effects.*

**P1 — The visible leap (4–6 weeks).** B1/B2/B5 Theme Engine v2 + pairing +
atmosphere with 3–4 crafted packs; C1–C6 effects with curated presets; D1–D7
component upgrades; E1–E5 layout/motion; F1/F2 media refs + SmartImage.
*Outcome: an admin picks "Midnight Premium", drops Hero v2 + curriculum
accordion + persona grid, and gets a page that looks agency-built.*

**P2 — Velocity & scale (4+ weeks).** G2 blocks/presets, G3 remote template
packs, G4 AI generation, F3–F5 asset library/icons/video, E6/E7 motion
authoring + marquee/parallax, G5 DX. *Outcome: a great page in 15 minutes,
not a day; premium packs shipped weekly without deploys.*

## 5. Guardrails (power without ugliness)

1. **Presets-first, raw-values-behind-"Advanced".** Glass/glow/mesh/motion are
   pickers with 3–4 curated intensities; free inputs collapsed.
2. **Theme-bound color surfaces.** Color pickers offer token swatches
   (primary scale + surfaces) before the free wheel; ornaments default to
   primary-derived colors.
3. **Atmosphere caps.** `intensity:'bold'` is the ceiling; no stacking three
   mesh layers at full opacity.
4. **Template-first creation.** New page flow leads with the premium packs;
   blank canvas is the secondary path.
5. **Design-lint for the platform itself.** Renderer code bans raw hex/grays;
   the schema bans arbitrary CSS strings where a preset exists.
6. **Back-compat as law.** Every field optional; absent field ⇒ byte-identical
   render. CI snapshot test on a corpus of real tenant configs.

---

## Appendix — Verified bug-level findings folded in

- Hero renderer silently drops `left.subheading` / `left.tags` that the admin
  template ships (component-templates.ts:30,32) — fixed by D1.
- Per-component `style.typography.fontFamily` faces are never loaded on the
  learner (only the single global family gets a css2 link) — fixed by B3.
- `--heading-h1/h2/h3` tokens have zero consumers — replaced by B4.
- `scroll.parallax` is typed in both apps, implemented in neither — E7.
- columnLayout slot children lose their `ComponentStyle` on the learner — E2.
- `'fullwidth'` hero variant is advertised in `component-variants.ts` but not
  implemented in the renderer — D1.
