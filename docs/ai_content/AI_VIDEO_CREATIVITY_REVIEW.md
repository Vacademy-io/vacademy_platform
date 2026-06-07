<!-- Generated review: AI video pipeline prompt creativity audit. Source: multi-agent workflow wf_e3e65571-5c7 (13 prompt readers + 5 craft-research streams + synthesis + adversarial critique). 2026-06-07. Line numbers in automation_pipeline.py are approximate (1.27MB file); prompts.py / shot_type_cards.py / shot_planner.py citations spot-verified. -->

# The Director's Cut: Why Your Pipeline Builds Competent Templates, and How to Make It Make Films

A review for the founder, written from the output backward.

---

## 1. The Diagnosis: You Built a Conductor, Not a Composer

Your pipeline is one of the most rigorously engineered text-to-video systems I have seen. The shot-type catalog is rich. The sync discipline is excellent. The normalization is robust. The anti-degeneracy guardrails are real. And that is precisely the trap: **every load-bearing creative surface in this system optimizes for a *valid, consistent, brand-safe plan* — never for an *authored* one.**

The clearest tell is in the primary creative brain itself. Per the audit of `shot_planner.py:133`, it defines its own job as:

> "Your job is to be **the conductor** — decide WHAT each shot shows... and how shots flow together."

A conductor interprets a score someone else wrote. Your pipeline has no composer. There is no stage — anywhere, on any tier — where a model is forced to form a **point of view** before it starts slot-filling. The audit is explicit on this: **no emotional-arc, climax, or payoff *concept* is operative in `shot_planner.py`** (the words barely surface, and where `moment`/`recap` exist as `intent_role` enum values they carry no dramatic weight). There is no "big idea" field in the Director (`director_prompts.py`), the writer (`narration_writer.py` / `prompts.py`), the per-shot HTML generator (`shot_type_cards.py`), the imagery layer, the sound layer, or the music layer. The pipeline plans *structure* — beats, shots, durations, emotions-as-enums — with great rigor, and never plans a *thesis*.

Here are the specific structural causes, named. (These are drawn from the file-by-file audit, not independent verification on my part — but the audit quotes line and chapter throughout.)

**Cause 1 — The whole system jumps from REQUEST to LOGISTICS.** `shot_planner.py:139` goes straight from the user request to "1. How many shots total." The seven decisions it lists (138-147) are all traffic control — shot count, shot type, duration, continuity, audio policy. None is "the idea." This is the load-bearing file; if creativity is absent here, no later stage can recover it.

**Cause 2 — Catalogs are framed as closed menus to pick *from*, not vocabularies to compose *with*.** `shot_planner.py:149`: "**SHOT TYPE CATALOG** (choose from these)." `director_prompts.py:80`: "You are the Director of an **educational explainer video**." The framing itself caps ambition: "choose from" nudges a model toward the nearest stock label per beat; "Director of an educational explainer" sets the ceiling at "competent explainer," not "filmmaker."

**Cause 3 — Pacing is arithmetic, and the worked examples anchor a uniform middle.** `shot_planner.py:211` and `director_prompts.py:210`: "body ≈ 7 shots × 2.9s." Every body shot is told to be 2.5–4.0s. This **mathematically forbids tempo contrast** — the accelerando into a climax, the held breath before a reveal, the deliberate dead-beat. The audit names this the single biggest motion-feel killer in the system. Directed editing *lives* in rhythm change; your prompt legislates a metronome.

**Cause 4 — Tone is hardcoded to one register for the entire platform.** `prompts.py:283`: "Tone: upbeat, authoritative, and human." A noir history piece, a deadpan coding bit, a somber documentary, a hype trailer — all flattened. This one line is the biggest house-style trap in the writing layer.

**Cause 5 — Emotion is a 6-color pastel enum, validated for *variety* not *build*.** `prompts.py:304` (curiosity/surprise/awe/urgency/calm/excitement) and `director_prompts.py:611`. The review pass (`prompts.py:426`) only checks the labels are "varied (not monotone)." A model satisfies this by *rotating labels* over monotone prose. The labels lie, and the gate passes them.

**Cause 6 — The bold permissions exist but are buried, hedged, and rationed.** The one genuinely cinematic instruction — "change worlds between acts" — appears at `shot_planner.py:225` as *rule 10*, hedged with "Coherence is usually good." The boldest line in `director_prompts.py` ("Three acts use distinct visual worlds," 565) is buried inside an *example field*, not promoted to a rule. The branded mask reveals are capped at "once per video" (`director_prompts.py:307`). The most powerful tools are framed as rationed exceptions, so a timid model defaults to fade-everywhere-plus-one-obligatory-iris.

**Cause 7 — Creative direction that IS computed gets thrown away before it can act.** This is the most maddening finding. The script LLM already generates `emotion`, `pacing`, and `visual_idea` ("a key visual metaphor") per beat (`prompts.py:304-306, 326`). The Director generates `emotional_beat` per act. And then **none of them are formatted into the per-shot prompt** — `automation_pipeline.py:15319-15338` omits every one. The `style_context` the per-shot designer actually receives is *five lines* of color/font hex (`automation_pipeline.py:14801-14807`). You are paying for creative direction and discarding it at the rendering boundary. The designer renders "urgent" and "calm" shots identically.

**Cause 8 — Sound and music are demoted to wallpaper by design.** `sound_planner.py:3` ("No LLM calls"), `sound_catalog.py:9` ("deterministic"). There is no creative point of view in the SFX loop at all. Music is mandated as "barely-perceptible underscore" at a flat 10% (`director_prompts.py:683`), genre selected by a domain lookup table (709). Silence is never a choice, only an accident of "nothing moved" (`sound_planner.py:94`).

**Cause 9 — The gates can only subtract.** Every review pass (`shot_visual_reviewer.py`) is 100% defect-removal. The rubric explicitly bans taste: "Subjective preferences... are NEVER blocking" (73). "This shot is competent but boring" is, by definition, a taste call — so the reviewer is *constitutionally forbidden* from ever saying it. And `BG_DISCONTINUITY` (164) actively flags the deliberate act-to-act world-shift the Director's own example calls intentional. The gate and the Director are at cross-purposes.

The net: a system that reliably produces a clean, on-brand, correctly-synced, never-broken, **forgettable** explainer. The difference between a Nolan film and an ordinary one is not production polish — you have the polish. It is that one made a *choice* about what the material means and bent every craft decision toward it. Your pipeline never makes that choice.

**One caveat on the diagnosis, because it changes a fix below:** the imagery layer is *not* fully homogeneous. The audit credits `subject_extractor.py` and `reference_prefetcher.py` with genuine per-video subject/character continuity and real-photo prefetch of named entities. So two videos with the same `visual_style` enum differ in their *named-entity imagery and recurring subjects* — the sameness is in the *look* (palette, lighting, grade), not in every pixel. We fix the look, and keep the continuity machinery you already have.

---

## 2. From the Output Backward: What Director-Grade Feels Like Here

Before fixing prompts, define the target. Here are the felt qualities of a director-grade motion-graphics explainer — each traced to the exact stage that must change to deliver it.

| Felt quality (the output) | What it actually is | The stage that must change |
|---|---|---|
| **"This has a point of view."** | A controlling idea you could state in one sentence; every shot visibly serves it. | NEW Creative Concept stage → threaded into ShotPlanner, NarrationWriter, per-shot HTML, imagery, music. |
| **"It's *about* something, emotionally."** | A from→to arc the prose actually earns, not a label rotation. | `prompts.py` emotion schema (304) + review item 5 (426); `shot_planner.py` intent_role (230). |
| **"The editing breathes."** | Tempo *contrast* — quick cuts building, a held beat before a reveal — plus a cadence with no dead zones. | PACING PROFILE (207-216) + a cadence-budget validator. |
| **"There's an image I can't shake."** | A visual metaphor that IS the explanation, and a leitmotif that recurs and pays off on a schedule. | Creative Concept `visual_metaphor` + `signature_device`; threaded to imagery + per-shot HTML. |
| **"The visuals are talking to me."** | The moving element IS the subject of the sentence; nothing animates that isn't being said. | A beats[] visual-narration lock against existing WORD TIMINGS. |
| **"It sounds *designed*."** | Score that surges and drops; a featured hit on the punchline word; deliberate silence; sound + picture conceived together. | `MUSIC_PLAN_EXTENSION` (678-807) + a new Sound Director + a mixer dynamics array. |
| **"The cuts mean something."** | A match cut where a circle becomes the sun; a J-cut into a reveal; an act-break that announces itself. | `transition_picker.py` (an LLM authors, the picker validates) + vocabulary in `prompts.py` (1755). |
| **"The motion is alive, not parked."** | Anticipation, overshoot+settle, persist-and-morph, one motion-hook you'd rewind for. | `shot_type_cards.py` CORE_PREAMBLE + back-half-motion rule (2279); density validator. |
| **"It commits to a voice."** | One tonal register held across the whole piece — not "upbeat & authoritative" for everything. | `prompts.py:283`; `narration_writer.py:81` brand_voice enum. |
| **"It looks art-directed."** | A coherent palette, lighting key, lens language — a *look*, not an enum string prepended to every prompt. | `prompts.py:372` enum; `automation_pipeline.py:4453, 20570` naive prefix. |

The pattern is unmistakable: **every felt quality of director-grade work traces back to a missing or discarded *intention* — and most route through one absent artifact.** That artifact is the headline.

---

## 3. THE HEADLINE: A Creative Concept / Director's Vision Stage

Add ONE new stage that emits a single machine-readable **Vision Document** that every downstream stage receives as a non-negotiable header. This is the composer you are missing. It is the highest-leverage change in this review, and it is *cheap* — one to four LLM calls.

This is not theory. It is the proven architecture from advertising (the Single-Minded Proposition), film direction (primordial image + dramatic metaphor + motif repetition), Pixar (the color script, pioneered there), and the research literature (LaDi's "LLM as Art Director" with constrained, *enforced* tokens). It is the pattern your own `music_plan` reminder already proves works (`shot_planner.py:993` — "derive from the shots, not a default bed") — applied to the *whole video*.

### 3.1 It must run in TWO phases (this is the implementability fix)

A pure "before the script" stage cannot work, because the color/energy beat map must align to *sections that do not exist yet*. Split it:

- **Phase A — pre-script.** Emits the idea, tonal register, motif system, look-book tokens, and sonic concept. Runs at topic intake.
- **Phase B — post-outline.** Once the script/ShotPlanner has produced the section outline, emits the `beat_map` aligned to those sections, and back-fills `thematic_motif.appears_in_shots` / `payoff_shot`. The `beat_map` then drives **both** per-section scoped CSS variables **and** music/sound energy per section — that dual wiring is the color script's entire payoff.

### 3.2 The exact schema

```jsonc
"vision_document": {
  // ===== PHASE A (pre-script) =====

  // --- THE IDEA (Single-Minded Proposition) ---
  "controlling_idea": "<ONE sentence, no conjunctions/lists. The single most
       surprising/true thing this video argues. NOT a topic summary.
       Bad: 'a video about compound interest.'
       Good: 'Doing nothing is the most powerful financial move you'll ever make.'>",
  "tonal_register": "<ONE from menu: awe | urgency | deadpan-wit | ominous |
       intimate | authoritative | playful | contrarian | elegiac>",
  "emotional_arc": "<from → to, e.g. 'smug certainty → unease → humbled clarity'>",
  "viewer_takeaway_feeling": "<plain words: what they FEEL at the end>",

  // --- THE MOTIF SYSTEM (director tradition) ---
  "visual_metaphor": "<one concrete, HTML/CSS/SVG-animatable image that embodies
       the controlling_idea, e.g. 'a single coin that snowballs into an avalanche
       across the timeline' | 'none'>",
  "thematic_motif": {                 // distinct from brand chrome
    "concept": "<a recurring visual idea, e.g. 'a growing line that compounds'>",
    "appears_in_shots": [],           // FILLED IN PHASE B
    "payoff_shot": null               // FILLED IN PHASE B
  },
  "primordial_image": "<the one iconic image that opens the world>",
  "signature_device": "<one recurring motion/visual gesture, e.g. 'every quality
       gate slams shut as a physical steel shutter'. Placement contract below.>",

  // --- THE LOOK BOOK (emitted AS tokens, not prose — see §3.4 on brand precedence) ---
  "look": {
    "palette": { "--vis-bg": "#0a0e1a", "--vis-fg": "#f5f0e8",
                 "--vis-accent": "#ff5c39", "--vis-muted": "#4a5568" },
    "lighting_key": "low-key chiaroscuro, single hard rim",
    "lens_language": "85mm shallow DOF; occasional 24mm wide for scale",
    "texture_grade": "fine 35mm grain, crushed blacks, desaturated cyans",
    "image_style_default": "<existing 7-enum value, FALLBACK only>",
    "type_mood": "editorial-serif | brutalist-mono | humanist-sans | condensed-display",
    "motion_character": "snappy | weighty | playful | restrained"
  },

  // --- SOUND & MUSIC DIRECTION (the missing sonic POV) ---
  "sonic_concept": "<ONE sentence — what the score is FOR, e.g. 'a calm piano motif
       that fractures into glitching synths when the breach is revealed, then resolves
       once the fix is shown'>",
  "climax_time_s": null,             // FILLED IN PHASE B
  "climax_treatment": "hit | full swell | cut to silence | key change",

  "the_one_shot_they_remember": "<which shot index is the signature moment, and why>",
  "what_to_avoid": "<the obvious/generic treatment to consciously reject,
       e.g. 'do NOT just show students-on-laptops stock footage'>",

  // ===== PHASE B (post-outline) =====
  // one row per act/section
  "beat_map": [
    { "section": 0, "emotion": "ominous", "energy": 0.3,
      "dominant_color": "--vis-bg", "accent_color": "--vis-muted",
      "transition_feel": "slow", "register_shift": null }
  ]
}
```

### 3.3 The placement contracts (so motifs aren't ignored like the logo)

A field nobody is told to *use* gets ignored — exactly how `recurring_motifs` collapsed into logo placement. Bind them:

- **ShotPlanner** must fill `thematic_motif.appears_in_shots` / `payoff_shot`, and: *"The `signature_device` MUST appear in shot 0, a mid beat, and the close. At least 2 shots must instantiate the `visual_metaphor`. A plan whose shots do not visibly execute the `controlling_idea` and `emotional_arc` is a failing plan."*

### 3.4 How the LOOK reconciles with your hard brand-token rules (the contradiction the look-book must survive)

Your per-shot HTML stage is **forbidden from inventing any background color** (must use `var(--brand-bg)`), backgrounds are capped to **≤2 non-media-hero treatments with one primary on ≥75% of shots**, and the palette is locked to brand-primary/brand-accent with a **hard ban on a third color**. A naive look-book would be silently nullified. Three explicit rules resolve it:

1. **Brand colors take precedence where they conflict** (the brand-kit principle). The Vision palette is *additive mood color*, scoped per-act, layered over `var(--brand-*)` — note the `--vis-*` namespace above. It never replaces brand tokens; it tints sections.
2. **The Vision palette is emitted as scoped CSS custom properties per act/section** so it *composes* with brand tokens rather than fighting the no-invent rule.
3. **Reframe the background cap** from "≥75% one treatment across the whole video" to **"≤2 treatments WITHIN an act; act boundaries MAY shift worlds deliberately."** Consistency becomes the floor inside an act; a designed world-shift at a real narrative pivot becomes the encouraged bold move.

### 3.5 The conformance gate — what makes this a contract, not a suggestion

The research is blunt: without runtime enforcement, an upstream vision is a suggestion the downstream model ignores. So the gate is the load-bearing other half of this headline. It runs **after each artifact, pre-render where possible to save image dollars**, and on failure **auto-repairs ONLY the violating artifact with the specific violation named — never a full regen.**

| Check | How | Failure action |
|---|---|---|
| Locked palette hex + font stack present in CSS | regex (LaDi ColorPatterns) | repair that shot's CSS |
| Per-section color matches `beat_map` | scoped-var comparison | repair that section |
| Subject/ingredient consistency | reuse `subject_extractor` IDs | re-anchor that image |
| ≥N `thematic_motif` instances across sections | **LLM/vision judge, NOT regex** — a motif is *visual*, not a keyword; grepping is brittle | flag sections with zero usage; re-direct |
| Music dynamics follow the energy curve | compare `dynamics[]` to `beat_map.energy` | regenerate music_plan |
| Tone register reflected in script | LLM-judge | targeted rewrite |

---

## 4. The Restraint Contract (read this before adding a single bold tool)

Everything below adds expressive range — motifs, hits, world-shifts, mask reveals, expressive transitions. **A Nolan-grade reviewer's warning: restraint is what makes the bold land.** Your own history proves it. The 2026-05 sound demolition (`sound_planner.py:289-294`) killed "whoosh on every cut" because the result was, in users' words, "distracting / funny / unprofessional." That is the empirical proof that *over-firing bold tools is a failure you have already lived*.

So adopt this as a first-class system principle, and pair every "add bold X" with its budget:

> **The diversity floor, the ±40% pacing deviation, the world-shift, the featured hit, the mask reveal, and the expressive transitions are SCARCE BY DESIGN. Their power comes from contrast with a restrained baseline. Reserve each for the 1–3 moments it is earned (act opens, the climax, the metaphor payoff). A bold tool used everywhere becomes the new uniformity.**

Without this, a cheap model told to "compose, diversify, be bold" will recreate the whoosh-spam failure in a new medium.

---

## 5. The Renderer-Constraints Gate (every new primitive must pass this)

Your renderer **seeks `gsap.globalTimeline.totalTime(t)` per frame in headless Playwright** — it does not play in wall-clock time. That makes several otherwise-obvious techniques broken or slow. State this once, and gate every proposed primitive/transition in §8 against it:

1. **GSAP tween/timeline only.** No `setTimeout` / `setInterval` / `requestAnimationFrame` loops / `Date.now()` / runtime `Math.random()` for visible motion — they do not survive per-frame seeking. (anime.js is allowed only via the `_animeR`/`_animeSeek` registry.)
2. **MorphSVGPlugin is a CDN STUB.** True point-interpolation morphing does **not** work. Substitute: stroke-draw (strokeDashoffset) + path cross-fade, or clip-path between shapes.
3. **Animated SVG filters are the #1 perf trap** under per-frame screenshotting (`feGaussianBlur`, `feTurbulence`, `feDisplacementMap` recompute every frame). Keep filter regions tight, cap `stdDeviation`, prefer CSS `filter`, never stack heavy animated filters full-frame.
4. **GSAP Flip and Physics2DPlugin must be confirmed-loaded** in `render_harness.py` before `match_cut`/FLIP and physics particles are usable; otherwise emulate with measured x/y/scale tweens and pre-seeded baked tweens.

This means the `camera_move` motion-blur, `rack_focus` (CSS blur), glow, `match_cut`/FLIP, and `particle_burst` proposals below ship broken or slow if you skip the harness verification. Treat it as a checklist, not a footnote.

---

## 6. Concrete Prompt Upgrades, Stage by Stage

### 6.1 ShotPlanner (`shot_planner.py`) — the planning brain

**A — no big-idea step.** Solved by §3; emit `vision_document` first in the OUTPUT ENVELOPE (333-345).

**B — catalog framed as a closed menu (149).** Before: `**SHOT TYPE CATALOG** (choose from these):`. After: `**SHOT TYPE VOCABULARY** — building blocks to combine and sequence into a distinctive piece, not slots to fill.` Add a **diversity floor**: *"A video of 6+ shots MUST use ≥4 distinct shot types and ≥1 high-craft type (INFOGRAPHIC_SVG, PRODUCT_HERO, DEVICE_MOCKUP, DATA_STORY, PROCESS_STEPS, EQUATION_BUILD) when the topic permits."* (Scarce by design — see §4: the floor is a *minimum*, not a target to overshoot.)

**C — metronome pacing (207-216).** Add a RHYTHM PROFILE: *"PACING IS NOT UNIFORM. Identify your climax/turn shot and place it deliberately. Build toward it with progressively shorter body shots (accelerando) OR a sudden hold on the reveal. At least one body shot must deviate ±40% from the average body duration. Emit a per-shot `pacing_role` ∈ {build, hold, hit, breath}."* Reframe the worked example as "illustrative arithmetic only — do NOT reproduce the uniform 2.9s body." **The highest-ROI prompt-only change in the system.**

**D — intent_role as fill-pattern (230-232).** Rewrite as a dramatic-arc contract: *"INTENT ROLE encodes the DRAMATIC ARC. Every plan must have: a hook that poses a tension; rising explanation/example shots that escalate; ≥1 `moment` that is the payoff (the shot in `the_one_shot_they_remember`); and a close that RESOLVES the exact tension the hook opened and calls back to it. A plan whose ending does not answer its opening is failing."*

**E — thematic motif vs brand chrome (319-331).** Keep `recurring_motifs` for logo/progress-bar; add the separate `thematic_motif` from §3 with its placement contract. Tell image/SVG shots to PREFER the metaphor over a literal depiction when one is set.

### 6.2 Writing layer (`narration_writer.py`, `prompts.py`)

**A — one mandatory tone (`prompts.py:283`).** Delete "Tone: upbeat, authoritative, and human." Replace with an intent×domain **VOICE CARD** carrying `reference_voice` ("Veritasium cold open" | "Attenborough hush"), 3 `signature_moves`, and a `banned_words` list. Examples: story → "hushed, present-tense, sensory, NO CTA, let silence work"; ad → "confident, a little cocky, short declaratives"; history → "a narrator who was THERE, concrete nouns and dates as drama." Expand the `brand_voice` enum (`narration_writer.py:81`) from 3 adjectives to the card.

**B — the 3-hook menu, echoed in generator AND reviewer (`prompts.py:295, 418`).** Add a **BANNED openers** list ("Have you ever wondered," "Imagine a world where," "In today's video," "Did you know") and a hook-forms catalog (cold scene, contradiction/reversal, a single arresting number, a "they told you X" lie-reveal, in-medias-res, provocative question).

**C — emotion as 6-color enum, gated for variety only (304, 426).** Expand the palette (tension, dread, wonder, melancholy, defiance, deadpan, triumph, unease) AND add a per-beat `dramatic_function` ∈ {setup, escalate, withhold, turn, reveal, release, land}. Change review item 5 from "varied (not monotone)" to: *"Does the emotion sequence BUILD — a withhold before a reveal, a calm before a turn? Random rotation FAILS. Name the single biggest turn and verify the prose earns it."*

**D — mandatory CTA/Key-Takeaway/Common-Mistake on every video (286-291).** Gate on the intent field that already exists (363-370): *"If intent ∈ {explainer, tutorial, announcement}: REQUIRED. If intent ∈ {story, trailer, visual_storytelling}: OMIT the worksheet fields. Close on an image or a line that lingers; a CTA here is a failure."* Mirror in `narration_writer.py` rule 6.

**E — explainer-ese transition phrases taught as the good answer (285, 420).** "Now let's look at..." / "Now that we understand X..." are the #1 AI-explainer tell, installed as the target. Add them to the banned list. Add a **"WRITE FOR THE CUT"** rule: *"Some shots want a hard line landing ON the cut; some want the line to END a beat early so the reveal breathes in silence. For KINETIC_TITLE/reveal shots, prefer a fragment. Set up visual punchlines in the PRIOR shot so the reveal shot is near-silent."*

**F — "show don't tell" pass targeting the PROSE.** Every concreteness guard today lives on side fields. Add a review item: *"Flag every sentence that asserts importance instead of demonstrating it ('this is fascinating,' 'surprisingly'). Replace abstract nouns with images: not 'early humans struggled' but 'a winter that killed nine in ten.'"* Banned-phrase list (both writing stages): fascinating, important to note, as we can see, it turns out, at the end of the day, delve, unlock, journey, game-changer.

**G — the retention engine the hook-forms catalog misses: MISCONCEPTION-FIRST + OPEN LOOPS.** This is the strongest single retention lever in the research (Veritasium's PhD finding: stating facts plainly makes viewers *more* confident in wrong beliefs). It complements — does not duplicate — the hook *forms* in (B); forms are about the opening line, this is about the whole-video tension structure. Add a script-stage restructure for explainer intents: *"Open by surfacing the wrong intuition or a hard question → create dissonance → reveal → resolve."* Add a validated `open_loops:[{setup_beat, payoff_beat}]` field, checked for closure (every loop opened must be paid off).

### 6.3 Per-shot HTML / CORE_PREAMBLE (`shot_type_cards.py`)

**A — the per-shot LLM has zero POV.** Solved by a `<CREATIVE_BRIEF>` block (mood from `beat_map`, the shot's role in the controlling idea, `visual_metaphor`, camera intent) at the high-recency end. New rule: *"Urgency → snappier eases, harder cuts. Calm → slower drift, overlapping reveals."* **The #1 lever at the pixel layer.**

**B — default mode is one house style, and cheap models are pinned to it.** Your own comment (340-344) admits the guardrails are "a uniformity tax... outputs converge on a single look" — and that is the tier cheap models run. **Decouple the toggles:** always include the TIMELINE MAP block (481-512 — your single best idea, "what produces choreographed shots instead of decorated ones") and the "3+ ambient motion layers" guidance regardless of tier. Keep only the riskier ban relaxations (shadows/blur/3-levels) gated to ultra.

**C — the canonical drift tween is copied verbatim (36-40).** Naming literal `{x:20,y:-10,scale:1.04,duration:12}` guarantees identical drift across every video. Replace with a ranged menu mapped to mood: *"calm: x/y 8-15px over 14-18s; energetic: 20-30px over 8-12s; lead the eye toward the hero. Do NOT reuse a prior shot's x/y/scale/duration."*

**D — back-half motion is gameable arithmetic (2279-2293).** A 1px drift passes. Replace the 4 canned idioms with a taxonomy of beat TYPES (late reveal, value-change, focus-shift, color-swap, scale-punch, cross-dissolve) and tell the model to choose the type matching the narration's back-half content, synced to the emphasis word from WORD TIMINGS.

**E — bans that strip a director's toolkit (326-333; `prompts.py:1242-1257`).** Convert blanket bans to **intent-gated permissions** even in default mode: *"Shadows/blur/gradients are off by default; enable ONE only if the brief's mood calls for depth/atmosphere and you state which element and why in your TIMELINE MAP. Vertical/rotated type is a HERO device — one per video, on a hook/hero/close shot, only if it stays legible."* Let the deterministic bbox/legibility linters be the safety net.

**F — the two defining "elite explainer" craft contracts the system entirely lacks** (the research names these as *the* qualities that separate world-class explainers from templates). Both map directly onto your existing SVG/GSAP + WORD TIMINGS:

- **VISUAL-NARRATION LOCK (synchronization contract).** Add a `beats[]` alignment pass that pins each tween's start to its narration phrase via the existing WORD TIMINGS: `{vo_phrase, t_start, visual_action, target_element}`. Rule: *"The moving element IS the subject of the sentence. Never animate a concept not being narrated; never narrate a concept without a corresponding visual change."* This kills the "visuals drift independently of VO" templated feel.
- **PERSIST-AND-MORPH (the manim signature).** Give every SVG element a stable semantic id reused across beats; add a `morph()`/FLIP helper (note §5: true morph is stubbed — use stroke-draw + cross-fade). Rule: *"Prefer transforming an existing element into the next idea; matching parts stay, only differences move. Clear-and-redraw only when the concept truly ends."*
- **FOCUS-BY-SUPPRESSION.** Add a per-beat `focus:[ids]` field + a `setFocus()` util that dims/desaturates/shrinks non-focal elements and brightens the focus. Rule: *"Every beat declares its focus; all other elements recede."* The cheapest, highest-clarity motion move there is.

### 6.4 Shot-type cards (`shot_type_cards.py` SHOT_TYPE_CARDS)

**Problem — one canonical worked example per type = "recolor this."** DATA_STORY ships literal "$3.5 BILLION"/"Kleiner Perkins"/fixed bar heights (892-931); cheap models ship the placeholder copy *and* treat the example bar heights as data (a correctness bug). INFOGRAPHIC_SVG locks every diagram to a cream MacBook blueprint (1184-1305).

**Change — split each card into a STABLE `contract` + a ROTATING `recipes` pool:**
- Keep `id/description/contract` (hard tech rules) always-shown.
- Move `html_template`+`script_block` into `recipes: [{name, when, html, script}]` — 3-6 structurally different layouts (DATA_STORY: hero-spike / animated-counter / slope-graph / dot-plot / before-after / decline-emphasis). Seed by shot_id so videos rotate.
- **Strip ALL literal copy** ("$3.5 BILLION") → bracketed slots `[STAT_VALUE]`/`[SOURCE]`.
- **Fix the cards that contradict their own rules:** TEXT_DIAGRAM (the universal fallback, 685-686) and PROCESS_STEPS (974-975) demonstrate `setTimeout`, which **never fires under the frame-seeked renderer** (see §5) — they teach a pattern that ships a *dead, motionless* shot. Rewrite to `gsap.to(..., {delay})`. **A silent-failure bug, not a style nit.**
- **Make `_relax_card_for_aspirational` actually relax the example** (622): today it strips 6 substrings and leaves the full worked template — the biggest sameness anchor — intact at the very tier built to fight templating. Swap the full example for a compressed skeleton (shape + slot names, no literal coordinates/copy).

### 6.5 Transitions (`transition_picker.py` + `prompts.py` TRANSITION_CSS_BLOCKS)

**Preserve the safety property while adding intent.** The picker today is *pure, deterministic, zero-cost, with a fade-floor so it can never regress* — that is a genuine asset, not a bug. The fix inverts *authorship*, not *safety*:

**Change 1 — an LLM authors, the picker validates.** Add a cheap **Edit-Choreographer** call that sees the whole shot list WITH narration/emotion/`beat_map` and authors each transition WITH a reason. **The picker stays as the deterministic validator/safety-net** (normalize + family-sanity + the non-negotiable KINETIC_* rules + the fade-floor): *"if the choreographer gave a valid in-vocab transition, USE IT; fall back to the family heuristic only if missing/invalid."* For cheap models, **run the choreographer twice and keep the higher-variety run** — the regression floor is never sacrificed.

**Change 2 — feed it real content even without the new call.** `emotion`, `pacing`, `emotional_beat` already exist upstream and are dropped before the picker. Add bias rules: surprise/fast → cut/whip_pan; calm/awe/slow → longer dissolve; payoff on an act boundary → circle_iris. Remove the blanket Rule 5 collapse (all world-changes → one vignette_fade).

**Change 3 — add the missing motivated-cut grammar.** The audit reports zero match-cut/smash-cut/J-L-cut/morph anywhere, and that the `zoom_through` comment claims an "overlap window" that does not exist in the composer (so fade/dissolve are incoming-only ramps, not true cross-dissolves). Add `smash_cut` (instant + flash), `dip_to_black/color`, and `match_cut` as a planning concept (Director emits `match_anchor`; per-shot HTML places a persistent element across the cut). **Caveat to scope honestly:** a *true* cross-dissolve requires a real overlap window in `ai_video_composer.py` — that is a **renderer change, not a prompt change**, and should be planned as such (P2).

**Change 4 — stop rationing; budget structurally** (per §4). Replace "use mask reveals sparingly — once per video" with: *"Reserve mask reveals for STRUCTURAL beats — act openers, hook, payoff. Use the SAME reveal style for recurring structural roles (every act opener = blinds_horizontal) so transition grammar becomes part of the brand rhythm."*

**Change 5 — stop silently downgrading intent.** `normalize()` maps every unknown transition to `fade` (102) with no signal. Expand aliases (glitch→smash_cut, swipe→slide_right, morph→circle_iris) and log unknowns so a cheap model reaching for expressiveness degrades to the *nearest* expressive transition.

### 6.6 Sound (`sound_planner.py` + `sfx_palette_planner.py` + `sound_catalog.py`)

**Change 1 — add a Sound Director** (`sound_director.py`, one LLM call): input = beats + narration + `sonic_concept` + sync_points; output = `{sonic_identity, motif:{label, when_to_recur}, silence_windows:[{shot, reason}], featured_hits:[{shot, word, intent}], texture_bed}`. Feed `sonic_identity` + per-cue intent INTO `sfx_palette_planner`.

**Change 2 — make SILENCE and the FEATURED HIT first-class.** Honor `silence_windows` (drop all cues, even scanner ones). Add a `featured` cue tier that *skips* the 0.6 ducking, allows volume up to ~0.9, with a pre-hit beat of dead air. Add roles: `drone_bed`, `riser_to_silence`, `sub_impact`, `heartbeat_pulse`, `reverse_swell`.

**Change 3 — generate the SFX prompt instead of looking it up.** The cue already carries `context={shot_type, text}` (368-420) and *never uses it for the prompt*. Batch unique (label, context, texture) tuples into ONE cheap call. "counter_tick" + "national debt reached forty trillion" → "heavy mechanical bank-vault counter clacking under rising low strings," not the fixed odometer.

**Change 4 — sync to MEANING.** For impact/featured cues, snap `cue['t']` to the nearest high-emphasis word onset (±150ms) — the word timings are already in `words`.

The "we do NOT add filler cues" demolition (289-294) was a correct over-correction (see §4) — but it now means *no* cut is ever underscored. Re-wire the no-op `enrich_transitions` (`sfx_palette_planner.py:557`) so hard act-boundary cuts and iris reveals get ONE intentional riser/impact.

### 6.7 Music (`MUSIC_PLAN_EXTENSION`)

**Change 1 — add `sonic_concept` and force a musical thesis before genre.** *"FIRST write the sonic_concept by reading the emotional arc, THEN derive instrumentation. The domain palette is a starting point, not the answer."*

**Change 2 — feed it the actual emotional arc + sync_points.** The info exists (energy_spike words, act `emotional_beat`) and is never plumbed. *"Your [mm:ss] markers MUST align to these beats. Place a build approaching the climax at {climax}; mark the highest-emphasis moments with an accent."*

**Change 3 — replace flat 10% with a DYNAMICS ARC — and name the required engineering.** *"The mix is DYNAMIC — the bed sits low (~10%) under speech and may swell (up to ~45-55%) in narration gaps, on the hook, and at the climax."* This is **not prompt-only**: add a `dynamics:[{time_s, level}]` field that **`audio_mixer` reads to automate bed gain instead of the constant 0.10**. Justify the layer-cap relaxation honestly: the "2-3 layers max" rule exists because **Lyria masters loud and over-arrangement turns to mush at low mix** — so allow 4-5 layers only for ≤6s at a marked climax, then strip back. **Provider caveat:** the `fal-elevenlabs` degrade path collapses the timestamped arc to one looped 22s bed (`music_generator.py:597-608`) — the dynamics arc **silently evaporates on that provider**. Document it; the arc is Lyria-path only.

**Change 4 — add a hit/build/drop vocabulary and a NON-soft example.** All three current examples end soft, teaching the model that scores resolve gently. Add Example D (tension/reveal): "...cut to near-silence, just a held drone... single deep impact hit as the answer lands."

**Change 5 — unify with sound.** Plumb `climax_time_s` into both, so the biggest SFX impact lands ON the musical hit.

### 6.8 Imagery (`automation_pipeline.py` + look-dev)

**Change 1 — the Vision `look` block replaces the enum** as the load-bearing field (enum stays a coarse fallback). Replace the naive `f"{image_style}, {prompt}"` prefix (4453, 20570) with a composed brief injecting `look.palette` + `look.lighting_key` + `look.texture_grade` + the section's `beat_map` color. (Keep `subject_extractor`/`reference_prefetcher` exactly as-is — they already give per-video subject continuity, which this does not touch.)

**Change 2 — per-act look shifts as a first-class field.** Add Director output `look_per_act:[{act_index, palette_shift?, lighting_shift?, image_style?}]`. The Director already *wants* act-to-act world shifts (224-228) but is stuck in freeform `continuity_notes`.

**Change 3 — a cinematography vocabulary card.** Expand IMAGE_PROMPT_GUIDELINES (239-247: only "close-up/wide/aerial" + 3 lighting phrases) into shot sizes, lenses, camera height/angle, lighting setups, DOF, grade, atmosphere. For AI_VIDEO_HERO (most expensive asset, *least* direction — `director_prompts.py:1066`), add a camera-move grammar (push-in, dolly, crane, whip-pan, rack-focus) and require one move + one shot size + a begin→end motion progression.

**Change 4 — wire emotion + visual_metaphor into the IMAGE prompt.** Map emotion → lighting/palette (urgency → hard side light, cool cast, tight crop; awe → wide scale, backlight, haze, warm key).

### 6.9 Structure & cadence: two complements to the RHYTHM PROFILE

The RHYTHM PROFILE (§6.1-C) fixes shot-*duration* contrast. Two named, quantified research levers fix what it doesn't:

- **ANCHOR-BRIDGE + the 30-60s PROMISE.** Front-load a hero "promise" visual in the first 30-60s, then alternate concrete **anchors** (cinematic stock/AI media) with explanatory **bridges** (diagrammatic SVG/GSAP). This is also a **cost+craft routing rule** your imagery layer lacks: *spend on cinematic media at anchors and reveals; use SVG for bridges.* Add per-section `type: anchor|bridge` to the outline.
- **PATTERN-INTERRUPT CADENCE budget.** A meaningful visual change every 3-5s (tighter in the hook zone, a deliberate calm beat before reveals). Add a validator that flags dead zones > N seconds. This is the lever that prevents "fade in then sit" *across a long video* — duration contrast alone doesn't.

### 6.10 Cultural context (`cultural_context.py`) — a quick aside

Localization is currently pure noun-tagging ("Indian classroom") with zero visual grammar. Turn the same cheap Flash call (currently `{region, confidence}` only) into an art-direction pack: `{palette_motifs, visual_motifs, avoid}` tailored to the topic, plus an anti-over-tagging rule ("localize MOOD and MOTIF, not every noun"). Near-zero added cost.

---

## 7. The Cheap-Model Strategy: Spend Calls to Buy Taste

You will spend MORE LLM calls on MiniMax/Qwen to get quality. Today you spend the *fewest* calls exactly where quality is worst — the free/standard single-shot path ships the cheap model's first, most-generic idea. The research is unambiguous: **mode collapse is structural (RLHF typicality bias), within-model variance is large (10-34% of variability is free from re-sampling), and divergent→convergent is the dominant winning architecture.** Raising temperature alone is weak; *generate N and select* is strong.

A calibration note so you don't over-engineer: the cheap-vs-frontier gap is **small on clean instruction-following** (Qwen3-2507 ~88.5 vs Claude-4-Sonnet ~88.4 on IFEval) and **concentrated in compositional/perturbed instructions and JSON reliability.** So the scaffolding's job is narrow: inject a POV cheap models can't originate, force divergence, and protect format — not to compensate for a uniform capability deficit. (Also: the LongGenBench short-context robustness result is measured on *Gemini-Flash*, not MiniMax — don't assume MiniMax inherits it; verify before relying on long single-pass generation.)

### 7.1 The named diversity levers (higher-ROI than brute best-of-N)

- **VERBALIZED SAMPLING — the top lever.** Training-free, model-agnostic (Qwen/Llama/Gemini/Claude), **1.6–2.1× creative diversity with no quality loss**, recovers ~66.8% of base diversity, and crucially surfaces tail responses **in ONE call** — far cheaper than N separate generations. Use it for narration and shot ideation: *"Generate 5 distinct options, each in a `<response>` tag with its probability; sample the tails."*
- **DENIAL PROMPTING — the enforcement mechanism for your own "don't repeat the previous shot" goal.** *"You may NOT reuse the composition/motion/color approach you just used."* Apply across a video's shots so each is forced to a new strategy.
- **RANDOM-CONCEPT / OBLIQUE-STRATEGIES injection — a near-free repo asset.** A small JSON deck sampled at ideation ("what if it had to be silent?") with a random concept word; empirically raises unique-response count and entropy.
- **DIVERSE-ORDINARY-PERSONA role-storming.** Counter-intuitively, *ordinary* personas (a 9-year-old, a museum exhibit designer, a skeptical teacher) out-diversify famous-genius personas because they inject more distinct cues.
- **CROSS-VIDEO rotation — the lever against catalog-wide sameness.** Rotate the persona AND the few-shot exemplar set *across videos*. This attacks "every video looks the same" — a *distinct axis* from within-video diversity.

### 7.2 The pattern, per stage

The unifying principle: **reserve a frontier model for the two taste-critical steps (PLAN and final REVIEW); let cheap models do the high-volume executor work — wrapped in divergence + selection + grounded critique.** And always **split NL-from-Format** (generate code/narration free-form, extract/validate separately — format restriction costs 10-15% reasoning).

- **Stage 0 — Creative Concept (Vision Document):** 3× brief generation at temp ~0.9 (safe / bold / minimalist) + 1 selector ("pick the boldest viable; reject any that just restates the topic"). **The single highest-ROI spend.**
- **Stage 1 — Script:** 3× via Verbalized Sampling at temp ~0.9 (each "take a different angle") + 1 boldness-rubric critic (gate on fit, then **maximize** originality) + 1 merge ("take this one's hook, that one's example, keep one voice").
- **Stage 2 — ShotPlanner:** hot ideation call (temp ~0.9) for the brief/metaphor; cool plan-emission call (temp ~0.5) for valid JSON; + 1 variety+boldness audit ("count distinct shot types/transitions; return PASS or a patch").
- **Stage 3 — Per-shot HTML:** N-best **for hero/hook/close only** — 3× each seeded with a different angle + 1 art-director judge. Skip body shots for cost.
- **Stage 4 — Grounded critic (tools, not vibes):** self-critique rubber-stamps errors, so ground it. You have deterministic verifiers: parse, eslint inline JS, **detect setTimeout** (renders dead — see §5), asset-URL resolves, total animation time == shot duration, screenshot diff for motion presence. Feed failures to a cheap refine call (max 2 loops); escalate the single failing shot to the frontier model only if still broken.

### 7.3 Cost: order-of-magnitude, not a line-item budget

The per-call figures are rough (the audit gives ~$0.001 per cheap call; cassetteai SFX is $0.03-0.06/video; Lyria + Seedream + render dominate). The honest framing: **adding the full divergent→select→critique scaffolding across all stages costs on the order of a few cents of cheap LLM calls per video — a rounding error against your existing Lyria + image-gen + render spend.** Do not present it as a precise budget; present it as "cents, to buy a divergent, selected, audited spine instead of a cheap model's first generic idea."

### 7.4 Cheap-model guardrails (from the research)

- **Decompose compound instructions** — reliability drops up to ~62% under perturbation. One constraint per call.
- **Curate 3-5 gold few-shot exemplars per stage** — value saturates at ~5; cheap models need them more than Claude does. **Promote frontier outputs that pass review into the per-stage, per-shot-type exemplar set** — an ongoing, self-improving floor (one of the cheapest durable quality compounders you have).
- **Compact story-bible context** — never pass the full transcript; pass a ≤300-token running bible + current shot.
- **Constrained decoding where you self-host** (Outlines/XGrammar/GBNF) on the *formatting* calls only — cuts JSON errors 32%→0.4%.
- **Best-of-N: cap at 3-8, swap candidate positions, use explicit pairwise rubrics** — judges have position/verbosity/self-preference bias; a cheap model can judge adequately even when it can't generate well.

---

## 8. Reframe the Gates: From Defect-Removers to a Director's Eye

The review tier is mature engineering aimed the wrong way — 100% subtractive, taste explicitly banned (`shot_visual_reviewer.py:73`), with a closed 16-code defect vocabulary that silently drops any creative note (354-357).

**Add a 5th gate — `shot_creativity_critic.py` (PROMPT_VERSION 'c1')** — that can ELEVATE, not just block. Same ship-original-on-regression safety as the existing gates (it can never degrade a shot). Scores 0-5 on:
- **BIG_IDEA** — one memorable visual idea, or a default centered title?
- **MOTION_HOOK** — one moment you'd rewind for (a reveal/transform/anticipation beat), or everything fades in and parks? (Fixes the "6 fade-ins pass the density gate" failure — the current MOTION rule only checks "has anything changed?" at 144.)
- **BEAT_DELIVERY** — does the frame embody the Director's `emotional_beat`? ("This act is SURPRISE — does this frame deliver surprise, or is it a safe centered headline?")
- **COMPOSITIONAL_TENSION** — dynamic asymmetry/scale-contrast, or dead-centered?

Fire ONE elevation regen when `min(score) < 3` AND the shot is hero/hook/close (per §4: scope the spend to the moments that matter). The corrective prompt EXPANDS latitude ("you may break the centered layout; try this bolder idea; keep sync/palette/legibility, everything else is open") — the opposite of the current correctives that re-clamp to the house style ("3 acknowledged escapes rather than freewheeling," 8662).

**Over-suppressing forbid-rules to fix:**
1. **Vertical/rotated type, banned across three layers** (`prompts.py:1242`, regex net `automation_pipeline.py:9225`, corrective 16687). → Convert to a budget: one rotated/vertical element per video on a hero shot, *only if it passes bbox + legibility* (the linters already guarantee that). Banned because cheap models did it *badly* — but that conflates "bold but unpolished" with "defect."
2. **BG_DISCONTINUITY flags the deliberate world-shift** (164). → Pass `transition_in`/act label in; if the shot is an act-opener with an act-break reveal, the sharp background is INTENTIONAL — don't flag.
3. **Blanket effect bans** (326-333). → Intent-gated, as in §6.3-E.
4. **"Never use the same shot type 3 times in a row"** (`director_prompts.py:204`). → Real cinema sometimes WANTS three hard cuts of the same form (three rapid F=ma variations hammer the point). Allow intentional repetition when declared as a device.

---

## 9. Vocabulary Expansion: New Skills, Transitions, Sonic Moves

Your `skills/motion_primitives/` registry is excellent plumbing (zero-config auto-discovery, static fallbacks, orientation-aware, co-designed audio_events) starved of content. The richer vocabulary lives in freeform card prose that **zero skills use**. **Every addition below must pass the §5 renderer gate** — that is not optional.

**Motion skills (P1 — the "Nolan vs template" difference):**
1. **`kinetic_mask_title`** — split to word/line, mask-rise (translateY 110%→0 inside overflow:hidden), per-unit stagger, scale-pop on the operative word. Generalize the hardcoded `quote_callout` slam-text into a reusable primitive. The research's single most premium *text* move; wire as the default KINETIC_TITLE renderer.
2. **`svg_draw_on`** — strokeDasharray=pathLength, tween strokeDashoffset→0, ease:'none'. (DrawSVG by hand.)
3. **`shape_swap`** — MorphSVG substitute (§5: plugin is a stub — true morph does NOT work): cross-fade two paths or animate clip-path.
4. **`clip_reveal`** — iris / barn-door / clock-wipe / diagonal-wedge.
5. **`parallax_scene`** — translateZ depth layers under a static perspective parent.
6. **`camera_move`** — push-in / pull-out / whip-pan / dolly-zoom on the wrapper. *(Whip-pan motion-blur is a perf risk under seek — §5; cap blur radius, prefer CSS filter.)*
7. **`rack_focus`** — CSS blur-pull between FG/BG when narration shifts subject. *(CSS filter, not SVG feGaussianBlur — §5.)*
8. **`particle_burst`** — DETERMINISTIC only (pre-seeded, baked into timeline tweens; NO canvas-confetti/rAF/runtime Math.random — §5). *Requires Physics2DPlugin confirmed-loaded, else emulate.*

**Cross-temperature craft (P1):**
- **CustomEase named library** — register `brandSettle`/`brandPop`/`brandSpring`/`brandBounce` once; map ease→emotion; mandate `ease:'none'` for all data/counters/draw-ons.
- **Advanced stagger** — generalize `stagger_list` into `stagger_reveal` with `{from:'center'|'edges', grid, axis, amount}`.

**Transitions (P0/P1):** `match_cut` (planning concept via `match_anchor`), `smash_cut` (+ flash), `dip_to_black/color`. *(TRUE cross-dissolve needs a composer overlap window — a renderer change, P2.)*

**Sonic moves (P1):** featured HIT on the punchline word; deliberate SILENCE windows; `drone_bed`; `riser_to_silence` into a reveal; score swell into climax (dynamics arc); a leitmotif that returns transformed.

**House-style knobs (P2):** `type_mood`, `palette_mood` (a 3rd spot color, brand-precedence per §3.4), `motion_character`. Replace validator-driven back-half drift with intentional held-beats (`hold`/`slow_push`/`settle`/`pulse`).

**Catalog reframing (P0, free):** Change `skill_registry.py:160` and the template "when to use" block from "use a template when content fits" to: *"Default to directing the shot yourself to match its intent. Reach for a template ONLY when you genuinely cannot improve on it or sibling-shot consistency demands it. Never use the same template twice unless it's an intentional motif."* Add a soft cap (~30% of shots templated). Today the framing biases cheap models toward the safe lane that *removes the LLM from exactly the shots they tag* (templates skip the per-shot call).

---

## 10. Roadmap

**Dependency note up front:** The Vision Document is a **hard prerequisite** for most P1 work — the Edit-Choreographer reads its `beat_map`, the Sound Director shares its `sonic_concept`, the look-dev replaces the enum with its `look` block, the creativity critic checks `emotional_beat` delivery. The Week-1 quick win #1 (threading already-computed `emotion`/`visual_idea` into the per-shot prompt) is a **strict down-payment on that same plumbing** — the exact wiring the Vision Document will reuse. Sequence accordingly.

### Do this week (prompt-only / small-diff, high payoff, near-zero cost)

1. **Stop discarding computed direction.** Format `emotion`, `pacing`, `visual_idea`, and the act `emotional_beat` into `PER_SHOT_USER_PROMPT_TEMPLATE` (`automation_pipeline.py:15319`). You pay for these and throw them away at 15338. *Lowest effort, immediate lift — and the first slice of the Vision plumbing.*
2. **Fix the setTimeout cards.** Rewrite TEXT_DIAGRAM (685) and PROCESS_STEPS (974) to `gsap.to({delay})`. These ship *dead* shots under your seek-based renderer — a correctness bug.
3. **Delete the one-tone line** (`prompts.py:283`) and gate CTA/Key-Takeaway/Common-Mistake on the intent field that already exists.
4. **Add the banned-openers + banned-phrases lists** to both writing stages and the review pass.
5. **Reframe the catalogs** from "choose from" to "compose with" (`shot_planner.py:149`, `skill_registry.py:160`), with the diversity floor.

### P0 — Structural foundation (1-2 sprints; transforms the ceiling)

- **The Creative Concept / Vision Document stage** (§3), two-phase, with the conformance gate (§3.5) and the brand-precedence reconciliation (§3.4). *The headline; everything else compounds off it.*
- **Adopt the Restraint Contract** (§4) and the **Renderer-Constraints Gate** (§5) as written policy before any vocabulary work begins.
- **Replace metronome pacing with the RHYTHM PROFILE** (§6.1-C). Highest motion-feel ROI, prompt-only.
- **Promote dramatic-arc intent_role + emotional build** (§6.1-D, §6.2-C).
- **Two-temperature ShotPlanner + NL-to-Format split everywhere** (cheap-model prerequisite).

### P1 — The cheap-model engine + the director's eye (2-4 sprints; depends on P0 Vision Document)

- **Divergent→select→critique architecture** with Verbalized Sampling, Denial Prompting, oblique-strategies, and cross-video rotation (§7).
- **The creativity critic gate** (§8) + reframe BG_DISCONTINUITY + intent-gate the bans.
- **Edit-Choreographer** (LLM authors, picker validates — §6.5) + **Sound Director** (§6.6) + **dynamic music** incl. the mixer `dynamics[]` array (§6.7).
- **Look-dev: Vision `look` block replaces the image enum** (§6.8) + wire emotion/metaphor into image prompts.
- **The three elite-explainer craft contracts:** visual-narration lock, persist-and-morph, focus-by-suppression (§6.3-F).
- **Misconception-first + open-loops** retention contract (§6.2-G); **anchor-bridge + cadence budget** (§6.9).
- **Card recipes pool** + strip literal copy + fix `_relax_card_for_aspirational` (§6.4).
- **Top motion skills:** `kinetic_mask_title`, `svg_draw_on`, `clip_reveal`, CustomEase library, advanced stagger (§9).

### P2 — Depth & polish (ongoing)

- Match-cut / smash-cut / **TRUE cross-dissolve (needs the composer overlap window — a renderer change)**.
- House-style knobs, per-act look shifts, parallax/camera-move/rack-focus skills (after harness verification per §5), deterministic particles.
- Cultural-context art-direction pack; AI_VIDEO_HERO camera-move grammar; multimodal look-coherence critic over generated imagery.
- Retire `beat_planner.py`'s body; consolidate the shared creative vocabulary into one module so the fallback path inherits the same spine as v3.

---

## Closing

You have built the hardest 80%: a robust, well-instrumented, production-grade rendering and orchestration system with genuinely rich craft scaffolding. What is missing is not capability — it is **authorship**. Every prompt in this pipeline answers "what does a valid plan look like?" and none answers "what is this video's *take*?"

The fix is not to loosen the rails — cheap models go off the rails when freed, and your own whoosh-spam demolition proves bold tools over-fire without a budget. It is to give the system a POV to execute, hold it to that POV with a conformance gate, spend cheap calls to diverge and select against it — and reserve every scarce bold move for the one or two moments it is earned. One upstream Vision Document, a rhythm that breaks its own metronome, transitions and sound that mean something, three craft contracts that lock motion to meaning, and a critic finally allowed to say "competent but boring." That is the entire distance between a conductor and a composer — and between a competent template and a directed film.
