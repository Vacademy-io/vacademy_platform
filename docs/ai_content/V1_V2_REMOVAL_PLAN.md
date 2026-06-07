<!-- v1/v2 legacy-removal plan for the AI-video pipeline. Source: multi-agent map+audit workflow wf_a0453dc3-4dc (4 mappers + adversarial deletion-safety audit + synthesis). 2026-06-07. STAGE 1 (truly-dead v1: default_shot_mapper.py + STYLE_GUIDE_* prompts) ALREADY EXECUTED. Stages 2-7 (v2 fallback) are GATED on the fallback-policy decision + prod data + a drain window. -->

# Staged Removal Plan: v1/v2 Legacy Code in the AI-Video Pipeline

**Scope verified against working tree** at `/Volumes/shreyash_ex/Vacademy/vacademy_platform/ai_service/app/ai-video-gen-main/` (pipeline) and `app/services/` + `app/routers/` (service/FE-facing). All file:line references below were spot-checked against the live files; where the audit was wrong I corrected it inline.

---

## 1. The one decision that gates everything

**v2 is NOT dead code — it is the live exception fallback.** On every run `_pipeline_v3_enabled()` returns hard `True` (`automation_pipeline.py:10462-10472`), v3 ShotPlanner+NarrationWriter run first, and the entire v1/v2 chain executes *only* when `_run_v3_shot_planning` raises — caught by the `except Exception as _v3_err` at `automation_pipeline.py:3715-3740`, which sets `_v3_runtime_status='v3_with_v2_fallback'` (3725), bills partial usage, and lets execution fall through to the `not _v3_done` branches.

**Tradeoff:**
- **Keep the v2 fallback:** a ShotPlanner/NarrationWriter LLM/parse failure degrades to a shipped (lower-quality, segment-or-Director-rendered) video instead of a hard failure. Costs ~100KB+ of code surface and ongoing maintenance of two divergent render paths.
- **Remove it (hard-fail / v3-native retry):** a v3 LLM failure becomes a failed run (lost credits / no video) unless replaced by a v3 retry. Cleaner codebase, single render path, but a reliability regression proportional to the real-world v3 failure rate.

**Recommended default: KEEP a thin fallback for now; do NOT delete the v2 chain in this pass.** Before removing it, two facts must be gathered (see §7 open items): (a) the production frequency of `_v3_runtime_status='v3_with_v2_fallback'` from `cost_breakdown.json` / cost events, and (b) confirmation no in-flight v2 runs are resumable. If the fallback fires non-trivially, replace it with a **bounded v3-native retry** (re-run ShotPlanner once) *before* deleting v2 — not a straight hard-fail. **Stage 1 (truly-dead v1) is safe to ship today regardless of this decision.**

---

## 2. Truly-dead v1 (safe to remove regardless of the fallback decision)

These have **zero live or fallback reachability** — confirmed by grep against the working tree.

| # | Target | File / location | Verification |
|---|--------|-----------------|--------------|
| 2.1 | **`default_shot_mapper.py`** — entire module (`map_beats_to_shots`, `VISUAL_TYPE_TO_SHOT_TYPE`, `INTENT_ROLE_PASSTHROUGH`, `select_shot_type`) | delete the whole file `app/ai-video-gen-main/default_shot_mapper.py` | grep: zero imports anywhere; only external hit is a stale comment in `beat_planner.py:41`. Not reached even on the v2 fallback (v2 uses `_run_director`, never the mapper). |
| 2.2 | Stale "keep in sync" comment | `beat_planner.py:41` | Drop the line referencing `default_shot_mapper._VISUAL_TYPE_TO_SHOT_TYPE` after 2.1. |
| 2.3 | **`STYLE_GUIDE_SYSTEM_PROMPT`** + **`STYLE_GUIDE_USER_PROMPT_TEMPLATE`** | constants in `prompts.py:665` and `prompts.py:673`; **and** remove both names from the import block at `automation_pipeline.py:284-285` | grep confirms the ONLY references are the two import lines (284-285) — no usage site anywhere. `_generate_style_guide` builds the palette deterministically from `BACKGROUND_PRESETS` and never touches these. Removing the import without removing the constants (or vice versa) is fine, but do both. |

**Ordering within Stage 1:** do 2.3's import removal first (it's an unused import that would otherwise become an `ImportError` if you only delete the constants), then delete the constants, then 2.1 + 2.2.

> Note: `SCRIPT_SYSTEM_PROMPT` (`prompts.py:248`) is an *unused import* at `automation_pipeline.py:277` (the precomputed default has no call site — only `get_script_system_prompt()` is called, inside v2 `_draft_script`). It is technically droppable independently, but since its sibling `get_script_system_prompt` is v2-fallback-only, I group it in §3 to avoid a half-cut. Conservative bias: leave it until the v2 cut.

---

## 3. v2 fallback code (removable ONLY if the fallback is dropped — see §1)

Do **not** touch any of these until the §1 policy decision is made and the §5 resume window is cleared. They are reachable solely via the `3715` except-block. Targets grouped by cluster; remove a whole cluster atomically.

**3a. Dispatcher / status (remove these FIRST when cutting, replace with hard-fail or v3-retry):**
- The except-fallback dispatcher `automation_pipeline.py:3715-3740` (replace with re-raise or bounded v3 retry).
- The assignment `self._v3_runtime_status = "v3_with_v2_fallback"` at `3725` **only** (the attribute + `'v3'` default at `3005` and the read at `5652` are LIVE — see §4/§7).

**3b. BeatPlanner cluster:**
- BeatPlanner stage `automation_pipeline.py:3742-3799` (gate `if not _v3_done and beat_planner_enabled`, import `from beat_planner import plan_beats, BeatPlanError` at 3756).
- BeatPlanner→Director bridge `3958-4022` (import `to_script_plan_beat_outline` at 3972).
- Instance state `self._beats_v2_plan` (init `3753`, set `3775`, reads `3970`/`4419`).
- **Module `beat_planner.py`** entirely (`plan_beats`, `BeatPlanError`, `to_script_plan_beat_outline`, `BEAT_VISUAL_TYPES`, `BEAT_INTENT_ROLES`) — no importers survive once the above go.

**3c. v2 ScriptGenerator + review cluster:**
- `_draft_script` (def `5683-6091`) and its call sites `3805-3930` (`if not _v3_done:`), `3884` (word-budget regen), `4221` (audio-overrun regen).
- `_review_script` (def `6168`) + two-pass review block `3932-3956`.
- `_repair_beat_narrations` (def `6091`, calls `3953`, `6082`).
- prompts.py exports used only here: `SCRIPT_USER_PROMPT_TEMPLATE` (`250`), `SCRIPT_SYSTEM_PROMPT`/`get_script_system_prompt` (`248`/`237`), `SCRIPT_REVIEW_SYSTEM_PROMPT`/`SCRIPT_REVIEW_USER_PROMPT_TEMPLATE` (`414`/`421`), `build_visual_preferences_script_block` (`511`) — and their imports at `automation_pipeline.py:277-282`.

**3d. v2 Director cluster (large — ~1330 lines + helpers):**
- `_run_director` (def `11111`-~`12440`), call site `4634-4738` (call at `4685`).
- `_run_act_planner` (def `9990`), call `11203`.
- Director-only helpers: `_normalize_director_plan` (call `12018`), `_build_director_reference_image_block` (calls `11966`, `10012`), `_build_article_director_context` (call `11239`), `_enforce_host_coverage_rules` (call `12418`), `_apply_transitions` (call `12195`), `build_emphasis_map`-as-used-at-`11230` (the symbol itself is KEEP — see §4), `_SHOT_TYPE_BG_TREATMENT_DEFAULT` usage at `12144` (lives inside `_normalize_director_plan`).
- director_prompts.py exports used **only** inside `_run_director`/`_run_act_planner`: `DIRECTOR_SYSTEM_PROMPT` (`79`), `SUPER_ULTRA_DIRECTOR_EXTENSION` (`399`), `ACT_PLANNER_SYSTEM_PROMPT` (`590`), `ACT_PLANNER_USER_PROMPT_TEMPLATE` (`623`), `build_act_planner_user_prompt` (`636`), `build_director_user_prompt` (`1330`), `DIRECTOR_USER_PROMPT_TEMPLATE` (`1253`), `STRICT_SOURCE_CLIP_DIRECTOR_EXTENSION` (`816`), `OVERLAY_INFOGRAPHIC_DIRECTOR_EXTENSION` (`838`), `HOST_DIRECTOR_EXTENSION` (`873`), **`build_ai_video_director_block`** (`996`, used only at `11608-11610` inside `_run_director`), `build_visual_preferences_director_block` (`1135`), `_default_screenshot_descriptor` (`1703`), `_DIRECTOR_FAMILY_BIAS` (`944`). **Do not delete `director_prompts.py` the file** — `MUSIC_PLAN_EXTENSION` and `build_emphasis_map` stay (§4).

**3e. v2 monolithic TTS call-sites (NOT the method):**
- Script-stage monolithic-TTS block `4143-4279` (`elif do_tts:`, call `4147`), the nested audio-overrun retry, and the monolithic call sites `4239`, `4950` (per-shot-TTS except fallback), `5109` (segment-empty fallback). **`_synthesize_voice` (def `6345`) itself is LIVE — KEEP** (§4).

**3f. v1/v2 segment-HTML cluster:**
- `_generate_html_segments` (def `17408-19285`), call `5153` (else of the per-shot/segment split).
- `_validate_html_segment` (`6231`), `_repair_html_segment` (`6268`), `_ensure_segment_coverage` (`19286`) — all called only inside `_generate_html_segments`.
- prompts.py exports used only here: `HTML_GENERATION_SYSTEM_PROMPT_CLASSIC` (`1407`), `HTML_GENERATION_SYSTEM_PROMPT_ADVANCED` (`701`), `HTML_GENERATION_SYSTEM_PROMPT_TEMPLATE` (`1443`), `HTML_GENERATION_USER_PROMPT_TEMPLATE` (`1502`), `_get_fewshot_examples` (`1330`), `SEGMENT_CONTEXT_ADDON` (`653`), `HTML_GENERATION_SAFE_AREA` constant (`1500`, the precomputed one — the **function** `get_html_generation_safe_area` stays, §4).

**3g. v2 tier flags (only after 3b-3f are gone) — per-flag, NOT en masse:**
- Safe to drop: `two_pass_script`, `beat_planner_enabled`, `director_two_pass`, `transition_picker_enabled` from `QUALITY_TIERS`.
- `use_director` — removable, but first clean the diagnostic read at `4097` and the OR-expression at `4125`; reads are `.get()`-safe so won't crash, but leaving the key is harmless.
- **Do NOT drop `director_emphasis_map`** — read on the live v3 html path (`5067-5074`). **Do NOT drop `tts_per_shot_enabled`** — part of the v3 TTS-defer gate (`4124`, set True on all tiers).

**3h. Service/manifest fallback plumbing (after pipeline cut):**
- `script_plan.json` element of the resume download loop `video_generation_service.py:993` (keep `shot_plan.json`).
- `script_plan.json` upload manifest entry `video_generation_service.py:1681` (keep `shot_plan.json` at `1682`).
- `director_plan.json` resume download `video_generation_service.py:1054-1080` — **only if** §5 confirms no v3 path reads it (the v3 branch prefers `shot_plan.json`).

---

## 4. MUST-KEEP shared helpers that look legacy (DO NOT DELETE)

These carry v1/v2-flavored names or live in director_prompts/prompts but are on the **live v3 path**. A naive "delete everything labeled v2" breaks every successful v3 run.

**In `automation_pipeline.py`:**
- **`_run_per_shot_tts_v2`** (def `7205`) — the `_v2` suffix is historical; it is the **only** per-shot TTS engine, invoked on live v3 at `4852` and inside `_v3_check_audio_overrun_and_regen` at `10742`. KEEP (rename optional).
- **`_synthesize_voice`** (def `6345`) — shared TTS primitive; called by the v3 per-shot path via `_synthesize_voice_for_shot` (`6933`) and externally by `sentence_tts.py:99`. KEEP the method; only the monolithic call-sites in §3e go.
- **`_generate_html_per_shot`** (def `14823-17407`) — the canonical v3 renderer; also the live editor's `single_shot_generator` target. KEEP.
- **`_decompose_shot`** (def `12441`, call `14987`) — rides the live v3 renderer via the externally-plumbed `sub_shots_enabled` flag (`2768/2886`). shared_v3, NOT v2-only. KEEP (the prompt's grouping with `_apply_transitions` is wrong — they have opposite classifications).
- **`_v3_check_audio_overrun_and_regen`** (def `10606`, call `5029`), **`_run_v3_shot_planning`** (def `10823`), **`_pipeline_v3_enabled`** (def `10462`), the **v3 resume branch** (`4038-4066`), the **HTML-stage Director-skip** (`4575-4633`), the **`director_done` sub_stage emission** (`4618-4633`, consumed by `ai_video_repository.py:520` and the FE). KEEP all.
- **`_v3_runtime_status` attribute + `'v3'` default** (`3005`) and its read at `5652` (feeds `cost_event_tracker.build_report` → `cost_breakdown.json`). KEEP — only the `3725` fallback assignment is removable.
- **`_segment_words` / `_segment_words_by_beats`** (def `7940`/`8002`) and their call at `4439-4445` — the `segments` output is discarded on v3, BUT the same block computes **`_current_chapters`/`_current_glossary`** (`4449-4463`) which ship in the timeline (read at `5395-5396`). Do NOT naively delete the call — chapter/glossary derivation must be preserved or migrated onto the v3 shot plan first.
- **`TOPIC_SHOT_PROFILES`** (imported `293`, read at `4371-4379` in run()) — sets `_current_subject_domain`, read live at `2318`, `12811`, etc. shared_v3. KEEP. (The `17619` usage is v2-segment-only and dies with 3f.)
- **`BACKGROUND_PRESETS`** (import `292`, used at `5454` run-level). KEEP.

**In `director_prompts.py` (file STAYS):**
- **`MUSIC_PLAN_EXTENSION`** (`678`) — imported live by `shot_planner.py:990` (v3 ShotPlanner). KEEP.
- **`build_emphasis_map`** (`24`) — imported live at `automation_pipeline.py:5073` on the v3 html path (post per-shot TTS, for ultra/super_ultra). KEEP. (Note: the v2 use at `11230` dies with `_run_director`, but the symbol must survive.)
- ⚠️ **Correction to the prompt:** `build_ai_video_director_block` is **NOT** a must-keep. It is used **only** at `automation_pipeline.py:11608-11610 inside `_run_director`** (verified) — it is fallback-only (listed in §3d). Do not preserve it as shared.

**In `prompts.py` (file STAYS):**
- **`PER_SHOT_USER_PROMPT_TEMPLATE`** (`1704`, used `15456`), **`TRANSITION_CSS_BLOCKS`** (`1770`, used `15230`/`15454`), **`build_visual_preferences_shot_block`** (`604`, used `15521` + live in `video_generation_service.py:3553`), **`get_html_generation_safe_area`** function (`1445`, used `14868`). KEEP — all on the shared per-shot path.

**Other modules:**
- **`single_shot_generator.py`** (`generate_one_shot`) — live editor "insert shot in gap" feature, wired via `sentence_clip_service.py:1726` → `insert_shot_external` router endpoint. NOT in pipeline-version scope. KEEP.
- **`SHOT_TYPE_BG_TREATMENT_DEFAULT`** in `shot_planner.py:95` (used `672`) — live v3. KEEP. (The mirror `_SHOT_TYPE_BG_TREATMENT_DEFAULT` in `automation_pipeline.py:8692/12144` dies with `_normalize_director_plan` in §3d.)
- Shared v2-Director helpers co-used by v3 ShotPlanner grounding: `build_catalog_for_director`, `audio_policy_planner`, `host_injector`, `reference_prefetcher`, `subject_extractor`, `shot_template_registry`. Verify each is still reached by v3 before assuming dead — several are shared.

---

## 5. Resume + historical-video compatibility risks

The v3 source-of-truth on disk/S3 is **`shot_plan.json`**; the v2-era artifacts are **`script_plan.json`** and **`director_plan.json`**. Live v3 runs persist `shot_plan.json` (`automation_pipeline.py:10572`); a clean v3 run never writes `script_plan.json` (it's written only by `_draft_script:6084` and the input-video branch `3406`).

**Risks and preservation:**
1. **In-flight v2 runs** (paused mid-HTML / at script-review) resumed after a v2 cut will hit a missing import or a synthesized stub. The resume loop downloads both plans (`video_generation_service.py:993`) and the pipeline loads `director_plan.json` at `4636` / `23632`. **Mitigation:** set a drain/cutover date; complete or abandon non-terminal v2 runs before deleting `_run_director` / `_generate_html_segments` and their resume readers.
2. **Silent degradation on resume:** when plans are absent the planner "falls back to a synthesized stub" rather than erroring. After a v2 cut a historical v2 video resumed without `shot_plan.json` could silently produce degraded output. **Mitigation:** keep the v3 resume branch (`4038-4066`, `4583-4617`) intact; consider making missing-plan resume hard-fail loudly.
3. **`director_plan.json` dual-use:** `automation_pipeline.py` writes it as a checkpoint mirror on v3 too. **Must confirm no v3 resume path READS it** (the v3 branch prefers `shot_plan.json` at `4588`) before removing the `4636`/`23632` readers. Until confirmed, **keep the readers even after the v2 generator goes** — readers for old on-disk plans are cheap insurance.
4. **Re-render of completed videos is version-independent:** `/render/{video_id}` (`external_video_generation.py:2118`) renders from persisted `timeline.json` + `narration.mp3` and re-runs no planner — so re-rendering a historical v2 video needs zero v2 code. Worth one explicit confirmation that `timeline.json` shape is identical from both paths (it appears to be — both feed the unified `_director_plan` → per-shot HTML → timeline).
5. **FE audit-panel (cosmetic only):** historical rows with `pipeline_version='v2'` are drawn by `build-pipeline-graph.ts`/`stage-vocab.ts` v2 nodes; `detectPipelineVersion()` defaults unknown→`'v2'`. Removing the v2 diagram branch mis-renders the developer audit panel for those records but does NOT affect the player/editor. Decide the historical-display policy before touching FE diagram code (§7).
6. **Build copy:** `render_worker/.build/ai-video-gen-main` is a vendored copy of these modules. If the cut ships, that copy must be regenerated or it diverges.

---

## 6. Staged, low-risk execution order (verify after each stage)

**Verification harness (run after every stage):**
```
python -m py_compile automation_pipeline.py beat_planner.py prompts.py director_prompts.py    # ast/syntax
python -c "import ast,sys; [ast.parse(open(f).read()) for f in ('automation_pipeline.py','prompts.py','director_prompts.py')]"
python -c "import automation_pipeline"          # import smoke (catches dangling imports)
# plus: the ai_service registry/import tests + a v3 smoke gen on free + ultra tiers
```

**Stage 0 — Baseline.** Capture `_v3_runtime_status='v3_with_v2_fallback'` frequency from prod cost events / `cost_breakdown.json`. Confirm no resumable non-terminal v2 runs. *No code change.* This unblocks §1.

**Stage 1 — Truly-dead v1 (ship today, no policy needed).**
1. Remove `STYLE_GUIDE_*` from the import block `automation_pipeline.py:284-285`, then delete the constants `prompts.py:665,673`.
2. Delete `default_shot_mapper.py`; drop the stale comment `beat_planner.py:41`.
*Verify:* py_compile + `import automation_pipeline` + import smoke. Expect green; nothing referenced these.

**— GATE: §1 policy decision + Stage 0 data. Stop here unless removal is approved. —**

**Stage 2 — Replace the fallback dispatcher (behavior change).** Rewrite `automation_pipeline.py:3715-3740` to re-raise or do a bounded v3 retry; remove the `3725` status assignment (keep attribute + `'v3'` default + `5652` read). *Verify:* v3 smoke gen still succeeds; induce a ShotPlanner failure and confirm it now hard-fails/retries (not v2). Confirm `cost_breakdown.json` still stamps `pipeline_version='v3'`.

**Stage 3 — Dead-code-eliminate the now-unreachable `not _v3_done` branches.** With the dispatcher gone, `_v3_done` is always True. Remove cluster 3b (BeatPlanner + bridge + `_beats_v2_plan` + `beat_planner.py`), then 3c (`_draft_script`/`_review_script`/`_repair_beat_narrations` + their prompts imports). *Verify after each cluster:* ast.parse + import smoke + v3 gen on premium/ultra (two-pass tiers).

**Stage 4 — Remove v2 Director cluster (3d).** Delete `_run_director`, `_run_act_planner`, the four Director helpers, `_apply_transitions`, and the director_prompts v2-only exports — **but first** confirm each shared helper (`build_catalog_for_director`, `reference_prefetcher`, `subject_extractor`, etc.) is still reached by v3. **Keep `MUSIC_PLAN_EXTENSION` + `build_emphasis_map`.** *Verify:* `import director_prompts` + `import shot_planner` (must still resolve `MUSIC_PLAN_EXTENSION`); v3 gen on ultra/super_ultra (emphasis-map path).

**Stage 5 — Remove monolithic-TTS call-sites (3e) + segment-HTML cluster (3f).** Keep `_synthesize_voice` and `get_html_generation_safe_area`. *Verify:* v3 gen on free/standard (no-Director tiers) — confirm per-shot HTML + per-shot TTS still run; audio present, chapters/glossary still in timeline.

**Stage 6 — Tier flags (3g) + service plumbing (3h).** Per-flag removal (keep `director_emphasis_map`, `tts_per_shot_enabled`). Drop `script_plan.json` resume/manifest entries; drop `director_plan.json` resume **only if §5.3 confirmed**. *Verify:* full registry tests + a resume smoke test of a fresh v3 run.

**Stage 7 — Rebuild the `render_worker/.build` vendored copy** and (separately, gated on the §7 FE policy) prune FE v2 diagram code. *Verify:* FE typecheck/lint/build.

---

## 7. Symbols the audit marked KEEP_still_live / needs_human_decision — DO-NOT-DELETE / resolve first

**KEEP_still_live (do not delete; rewrite call-site only if inlining):**
- `_resolve_pipeline_version` — `app/services/video_generation_service.py:26-40`. Live call at `1426` stamps `user_selections.pipeline_version='v3'` unconditionally on every gen-start. Body is a constant `return "v3"`, but the call is live. Keep, or inline `"v3"` at `1426` if removing.

**needs_human_decision (resolve before the relevant stage):**
1. **`_v3_runtime_status` / `'v3_with_v2_fallback'`** — attribute + `'v3'` default (`3005`) + read (`5652` → `cost_event_tracker.py:240,294`) are LIVE and must stay. Only the `3725` assignment is removable, and only as part of Stage 2. The string `'v3_with_v2_fallback'` has no consumers outside `automation_pipeline.py` (service writes a constant `'v3'`; FE only handles `'v2'|'v3'`).
2. **v2-only tier flags** — MIXED. Safe to drop: `two_pass_script`, `beat_planner_enabled`, `director_two_pass`, `transition_picker_enabled`. **MUST KEEP: `director_emphasis_map`** (live v3 read at `5068`) and **`tts_per_shot_enabled`** (v3 TTS-defer gate at `4124`). `use_director` needs the `4097`/`4125` diagnostic/gate reads cleaned first.
3. **Monolithic `_synthesize_voice` as a "ship-anyway" safety net** — invoked at `5109` even on v3 when the shot plan is empty. Decide: keep it as a v3-independent last resort, or remove it with v2 and let empty-plan runs fail. (The **method** stays regardless — `sentence_tts.py:99` + the v3 per-shot path depend on it.)
4. **FE `detectPipelineVersion()` default** (`derive-pipeline-state.ts:701-721`, unknown→`'v2'`) and the `build-pipeline-graph.ts`/`stage-vocab.ts` v2 nodes — **historical-display policy decision**: keep the v2 diagram for accurate audit of historical `pipeline_version='v2'` rows, or relabel them v3. Cosmetic/forensic only; no player/editor impact. Gate Stage 7 FE work on this.
5. **`director_plan.json` dual-use** (§5.3) — confirm no v3 resume READS it before removing the readers.
6. **`TOPIC_SHOT_PROFILES`** — audit marked "uncertain"; I verified it IS read on the clean v3 path (`4371-4379` sets `_current_subject_domain`, consumed live at `2318`/`12811`). Reclassify **shared_v3 / KEEP**. The `17619` usage is v2-segment-only.

**Conservative-bias reminder:** Stage 1 is the only block that is unconditionally safe. Everything in §3 is a *fallback*, not dead code — removal is a reliability/product decision, not a mechanical cleanup. Never delete on name alone (`_run_per_shot_tts_v2`, `_v2_tts_deferred`, `concat_source='per_shot_v1'`, the `tts/` "Phase B/v2" comments are all LIVE v3).
