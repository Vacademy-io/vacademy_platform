# AI Video Studio — Product Review (2026-06-12)

**Reviewer lens**: product manager, asking "can a real Vimotion user get value out of Studio today, and what stands between the vision and a usable product?"
**Scope**: the Studio pipeline (`/vim/studio/*`, `/external/studio/v1/*`) as shipped through P6b, audited against the actual code (ai_service, frontend-admin-dashboard, render_worker) — not just the tracker doc.
**Companion**: [AI_VIDEO_STUDIO.md](./AI_VIDEO_STUDIO.md) (implementation tracker).

---

## 1. The vision, restated

Studio's bet is genuinely differentiated: **video editing as LLM-orchestrated, user-confirmed tools**. Not "prompt → opaque video" (the AI-gen pipeline) and not "pick a highlight → reel" (reels), but: bring N raw assets, let the AI propose an edit step-by-step (arrangement → cuts → overlays → audio), keep the human in the approve/edit/refine loop at every step, and land in a real editor with versioned, forkable builds. That's a defensible middle ground between Descript (manual, transcript-driven) and full text-to-video (no control). The architecture honors the vision: per-step tool registry with tier gating, deterministic tools where LLMs add no value (silence/filler cuts, captions), confirmed plans as data, immutable build snapshots.

The engineering quality of what exists is high — idempotent builds, lossless confirm persistence, defensive param parsing, unit-tested pure cores. The problem is not quality. The problem is that **the product, as wired end-to-end, did not deliver its core promise**: an edited video you can watch.

## 2. Verdict before this round

**Not usable.** Three classes of blockers, in descending severity:

### 2.1 The output was broken (P0)

- **Every rendered Studio MP4 was silent.** The timeline builder assumed the render worker captures the unmuted `<video>` clip audio in the browser; in reality the worker strips source-clip tags before rendering (frames composite via OpenCV, Playwright screenshots are silent), explicitly skips `data-source-clip` in its audio collector ("composited separately" — a path that doesn't exist), and Studio submits a deliberately *silent* master MP3. Editor preview played audio fine — so a user would edit a talking video, render, and download a mute file. This invalidated the entire funnel and was flagged only as "⚠ staging verify".
- **One transient render failure permanently bricked a build.** Render failure flipped the build row to `FAILED`; the render endpoint only accepts `AWAITING_EDIT|RENDERED`; no recovery path existed. The user's edits were intact in S3 but unreachable.
- **Render was fire-and-forget on the project page**: no polling while rendering (the page only polls during builds), failures surfaced as a transient toast, a completed render appeared only after a manual refresh, and a worker "completed" response without a video URL left the build in silent limbo.

### 2.2 Shipped features were unreachable (P1)

- **The tier system is dead plumbing.** `_tier_of` reads `project.config["tier"]`, which no code path ever writes — every project is `free`. Consequence: `propose_titles` and `propose_text_overlays` (the P6a Overlays step, an entire shipped phase) **never appear for any real user**. The Overlays step degrades to a captions toggle.
- **The wizard advertised an Audio step ("Music + SFX + transitions") that never ran** — the stepper showed it, the flow skipped overlays → build, and the step silently turned green. The audio step existed in every contract layer (enum, SQL, intent prompt, model routing) but had zero tools, zero build-stage consumer.
- **The editor was partially wired for `kind=studio`**: frame save worked, but the Render button hit the AI-video endpoint with a build id (always fails), the audio-tracks panel 400'd on add (wrong pipeline endpoint), thumbnail picker broken, and the Back button dumped users into the AI-gen production view with a studio build id — a dead screen.

### 2.3 Funnel dead ends (P2)

- A project abandoned mid-wizard was unrecoverable from the UI (no resume/re-plan CTA anywhere; "No builds yet" with no action).
- No back-navigation between wizard steps; plan-step LLM failure leaves an empty list with no retry (confirm then silently records `skipped`).
- Caption words go stale after editor timing edits (words.json is never remapped; captions drift in the final MP4).
- Cut rows show raw timecodes with no transcript context — a non-technical user can't judge what "v1 0:42–0:47" removes.
- The editor deep-link leaks the institute API key in the URL.
- `decisions`/`operation_order`/`skipped` are persisted but never consumed — harmless, but the FE must (and does) bake edits into `operations`, so the audit-trail surface is theater for now.

## 3. What was completed in this round (2026-06-12)

Scoped to "make the core promise true": every build gets a real soundtrack, the advertised Audio step exists, and the funnel's dead ends are fixed.

1. **Silent-MP4 fix — `ASSEMBLE_AUDIO` build stage.** A new pure ffmpeg command builder (`studio_master_audio.py`) assembles the master audio track from the composed timeline's SOURCE_CLIP entries (`-ss/-t` HTTPS range reads → `adelay` → `amix` over an `anullsrc` duration anchor — the proven reels recipe). Uploaded as `ai-studio/{build}/master_audio.mp3` → `s3_urls.audio`; the render service now submits it as the worker's `audio_url` (silent fallback kept for image-only builds). Captions stay aligned because the words track already lives on the same composed clock. Fail-loud: a soundtrack failure fails the build visibly instead of shipping a mute video.
2. **P7 Audio step, end-to-end.** `propose_bgm` (LLM, one music bed: mood + description + volume; honors `bgm_policy`) and `propose_sfx` (deterministic whoosh stingers at segment changes or every cut; honors `sfx_policy`); BGM generated via the fal/ElevenLabs bed client (loop-extended to video length) or a user-supplied URL (`manual_bgm`), attached as `meta.audio_tracks` — which the render worker already mixes and the editor already previews, zero worker changes. FE `AudioStep` with BGM/SFX cards, refine box, config-always-rides confirm; wizard now runs ingest → arrangement → cuts → overlays → **audio** → build; BuildStep shows "Building soundtrack".
3. **Render reliability.** Render failures return the build to `AWAITING_EDIT` with a `[RENDER] …` error message (retryable); previously-bricked `FAILED` rows with intact timelines are renderable again; completed-without-URL and 30-min-timeout cases now write visible errors; the project page polls during renders and shows inline per-row errors with retry.
4. **Editor coherence for studio.** Audio-tracks panel works (new studio audio-track endpoints + kind-aware FE client); Back returns to the studio project page; the broken Render/thumbnail affordances are hidden for `kind=studio` (rendering lives on the project page).
5. **Funnel**: resume-wizard (`/vim/studio/new?projectId=…` jumps to the first unconfirmed step) + "Resume planning" CTA on build-less projects.
6. **Tier unblock (interim)**: default tier is now `premium` (env-overridable `STUDIO_DEFAULT_TIER`) so the shipped Overlays toolset and the new Audio toolset are actually reachable. Real institute-tier resolution remains open (below).

## 4. What I deliberately did NOT build (and why)

- **Visual transitions (`propose_transitions`).** The worker composites footage under luma-keyed HTML — dark/semi-transparent overlay pixels are keyed out, GSAP entrance tweens animate only the overlay layer, and there is no inter-entry crossfade in the worker. Honest visual transitions need worker-side support (xfade or compositor changes). Shipping fake "transitions" that work in preview but not in the MP4 would repeat the silent-render mistake. Wizard copy now says "Music + sound effects"; transitions are re-scoped to P8 with a worker dependency called out.
- **BGM ducking under speech.** BGM rides as an editable audio track (user can tweak volume in the editor); the worker doesn't sidechain-duck tracks against narration. Default volume is low (0.12). Baking ducked BGM into the master (reels-style) trades away editability — wrong default for an *editing* product. P8 candidate.
- **Lyria long-form music.** v1 uses the ElevenLabs bed (≤22 s loop-extended, ~$0.04, deterministic cost) — the Lyria path (3-min generations, Vertex creds, chunk concat) is a quality upgrade, not a usability gate.

## 5. Open product risks, ranked (the honest backlog)

| # | Risk | Why it matters | Suggested phase |
|---|---|---|---|
| 1 | **Staging verification of the full A/V render** (master audio, BGM mix, whoosh timing, caption alignment, luma-key legibility) | Everything audio is pure-tested only; no ffmpeg/worker in dev. The silent-MP4 bug survived precisely because this gap existed. Should be the next action, before any new feature. | now |
| 2 | **Caption drift after editor edits** — words.json is never remapped after frame add/update/delete/reorder; master audio now has the same property (built at build time, not re-synced to editor timing edits) | A user who trims a shot in the editor renders captions *and audio* misaligned to the visual cut. Mitigation: rebuild words + master audio at render time from the live timeline (transcripts + sources are all addressable). | P7.5 — highest-value correctness follow-up |
| 3 | **Real tier resolution** — `STUDIO_DEFAULT_TIER=premium` makes everything free-of-charge | Fine for beta; unpriced LLM + music spend at scale. Needs institute plan lookup + the P10 credits/metering slice (cost preview exists platform-wide per the credits initiative). | P10, before paid launch |
| 4 | **No cut-context for users** — timecodes without transcript text in CutsStep | Users can't confidently approve cuts; the transcript is already in the manifest. Show the words being cut. | P9 polish |
| 5 | Wizard back-navigation + re-plan from detail page (confirmed_plan is pre-fillable; today re-entry re-plans and clobbers) | "User confirms each step" is the product thesis — one-way doors undermine it. | P9 |
| 6 | API key in editor deep-link URL | Key hygiene; move to store/context handoff. | P9 |
| 7 | Multi-pod render/build idempotency guards (process-local sets) | Single-pod assumption is fine today; documented. | when scaling |
| 8 | `ai_studio_operation_logs` written by nobody | Either wire the audit trail (it's the analytics goldmine for "what does the AI get wrong") or drop the table. | P10 |

## 6. PM bottom line

The vision is right and the architecture matches it — the per-step propose→confirm→build loop with versioned builds is exactly the shape an AI editor should have, and it composes cleanly (the audio step landed with zero router changes, as designed). The failure mode to guard against is now visible in hindsight: **phases were declared "shipped" against dev-verifiable logic while the only thing the user actually receives — the rendered MP4 — was never exercised**. Two process changes follow: (1) a staging render must be part of every phase's definition-of-done; (2) features gated on plumbing that doesn't exist yet (tiers) should fail loudly in dev, not silently degrade.

With this round, the funnel is coherent: ingest → arrange → cut → overlay → **score** → build → edit → render → an MP4 with the user's footage, voice, music, and captions. The next dollar of effort goes to staging verification and render-time re-sync (risk #1/#2), not new capabilities.
