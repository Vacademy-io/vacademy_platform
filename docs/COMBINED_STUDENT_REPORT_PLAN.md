# Combined Student Report — Implementation Plan (v1 brain + v2 chassis + processed_json graphs)

> **Goal.** Merge the deep, consistent AI analysis of **v1** with the graphs/stats/coverage of
> **v2**, promote the wasted `processed_json` learning insights to first-class graph data, and
> present it all in **one parent-first layout** used by both admin and learner/parent.
>
> **Decisions locked (2026-07-07):** Full unified report · parse `processed_json` into graphs *and*
> feed the AI · one parent-first layout for admin + learner · plan-first.
>
> **Companion docs:** `STUDENT_ANALYSIS_REPORT.md` (v1) · `STUDENT_REPORT_DATA_SOURCES.md` (v2) ·
> `LLM_ANALYSIS.md` (the `processed_json` producer).

---

## 0. Root-cause recap (why v2's AI is thin/inconsistent)

| Symptom | Cause (file evidence) |
|---|---|
| v2 AI reads shallow | Layer-2 LLM sees **only** deterministic aggregate numbers; `ComprehensiveReportLLMService.buildPrompt` (`:334-399`) never includes `processed_json`, learner ops, or v1's texture. |
| v2 output inconsistent run-to-run | Narrate timeout → **no** `ai_insights`, then `ensureInsightsFromFacts` (`StudentAnalysisProcessorService:192`) substitutes a terse template. Two separate LLM calls (`narrate` + `clusterSubjectMarks`), each with independent fallback. |
| Less content than v1 | v2 dropped v1's 6 rich Markdown fields (`learning_frequency`, `progress`, `student_efforts`, `topics_of_improvement`, `topics_of_degradation`, `remedial_points`). |
| `processed_json` wasted | Its graph-ready structures (`topic_analysis`, `blooms_taxonomy`, `confidence_estimation`, `misconception_analysis`) are only dumped as **opaque prompt text** in v1, and **not used at all** in v2. |
| No progress-over-time | `OverviewBuilder` hardcodes `trend=null`/`change=null` for every headline metric. |
| 3 visual languages | v1 markdown dialog · v2 9-tab recharts · v2 single-scroll SVG/CSS card. |

---

## 1. Target architecture (one report)

```
processV2 (renamed conceptually → processCombined; report_version stays "v2", additive)
   │
   ├─ ComprehensiveReportAggregator.collect(...)          [existing collectors, unchanged]
   │     └─ + NEW LearningInsightsCollector               → LearningInsightsSection (from processed_json)
   │
   ├─ ONE unified LLM call  (ComprehensiveReportLLMService.narrate, extended)
   │     inputs : Layer-1 facts  +  aggregated learning insights  +  raw processed_json texture  +  learner ops
   │     outputs: ai_insights  +  v1-style narrative{}  +  strengths/areas  +  overview one-line + parent_summary
   │     (subject-marks clustering folded into the same call OR kept but gated)
   │
   ├─ OverviewBuilder + trend deltas (vs previous student_analysis_process)
   │
   └─ report_json (single enriched ComprehensiveStudentReport shape) → COMPLETED → notify
```

**Versioning strategy (additive, non-breaking):**
- New reports keep `report_version = "v2"` but gain **additive** sections/fields — no migration of old rows.
- **Stop generating v1.** Historical `v1` rows still render through the existing `StudentReportDetailsDialog` (kept read-only for history). Historical `v2` rows render through the unified card (they simply lack the new sections → those sections show "not available").
- All v2 DTO additions are new nullable fields → old stored JSON deserializes fine.

---

## 2. Backend — phased

### Phase B0 — Subject resolution + "never show Unknown/Other" ✅ IMPLEMENTED (2026-07-08)

> **Status: done & compiling.** New `service/aggregation/SubjectResolver.java` (DB hint → keyword
> inference from name → null). Wired into `AcademicsCollector` (enrich + `buildSubjectPerformance`
> drops unresolved rows), `SubjectMarksCollector` (`collect` enriches items, `deterministicGroup`
> omits unresolved instead of "Other"), and `ComprehensiveReportLLMService` (clustering prompt now
> forbids "Other" and parse drops placeholders). Frontend guard `isRealSubject` added to admin
> `ComprehensiveReportDialog.tsx` + learner `comprehensive-report-card.tsx` (filters
> subject_performance + subject_marks, assessment cell falls back to "—"). Backend `mvn compile`
> clean; frontend design-lint clean.

**Problem (observed in prod):** an assessment named *"Science Part Test - 2"* renders as
**"Unknown"** in *Subject performance vs class* and **"Other"** in the *Marks by Subject* donut,
because subject is taken **only** from the DB hint, which is null here — even though the name
plainly encodes the subject.

Two independent code sites produce the bad labels:
- `AcademicsCollector.buildSubjectPerformance` (`:145`) — `a.getSubject() != null ? a.getSubject() : "Unknown"`. **No inference at all.**
- `SubjectMarksCollector.deterministicGroup` (`:94`) — null subject → `"Other"`. (An LLM clustering step
  exists but is clearly falling back to this deterministic path.)

**Fix — a shared `SubjectResolver` used by BOTH collectors**, applied in this precedence:
1. **DB subject hint** (`a.getSubject()` / slide subject) — trust when present & non-blank.
2. **Deterministic keyword inference from the item name** — cheap, reliable for obvious names.
   Map on normalized tokens: `science→Science`, `phys/optics/magnet/newton→Physics`,
   `chem→Chemistry`, `bio→Biology`, `math/maths/algebra/geometry/calculus→Mathematics`,
   `english/grammar/literature→English`, `social/history/geography/civics→Social Studies`, etc.
   (Curate the map with the institute's real subject list where available.)
3. **(Optional, later) Linked-course inference** — have the assessment_service
   `assessment-history` endpoint also return the assessment's linked subject/course
   (`package_session`/subject mapping). Requires a small cross-service field addition; note as a
   follow-up, not blocking.
4. **Unresolved → `null`, and OMIT rather than label.** This is the UX rule the user asked for:
   - `subject_performance`: **drop** rows whose subject is unresolved; if none resolve, hide the
     "Subject performance vs class" sub-section entirely (the marks still appear in the assessment list).
   - `subject_marks`: only emit resolved subjects; **never** emit an "Other"/"Unknown" bucket. If a
     single item can't be resolved, it simply doesn't get a subject donut — it's still counted in the
     overall academics average and shown in the assessment list.
   - The LLM clustering prompt (`buildSubjectMarksPrompt`) must be told: **return `null` subject when
     you genuinely cannot infer one — do NOT force "Other"** (currently it's nudged toward "Other").

**Result:** "Science Part Test - 2" → **Science** (from name); a truly context-free item → no subject
label anywhere, instead of a jarring "Unknown"/"Other". This same `SubjectResolver` also feeds the
strengths/areas + topic sections in the combine, so subjects are consistent across the whole report.

### Phase B1 — `processed_json` → structured graph data (biggest win) ✅ IMPLEMENTED (2026-07-08)

> **Status: done & compiling.** New `LearningInsightsSection` DTO + `LearningInsightsCollector`
> (parses `topic_analysis`, `blooms_taxonomy`, `confidence_estimation`, `misconception_analysis`
> across up to 50 processed attempts in range → aggregated topic-mastery / Bloom's / confidence /
> misconception structures, all recomputed in Java). New repo method
> `ActivityLogRepository.findAllProcessedLogsForInsights` (LIMIT 50). New `ReportModule.LEARNING_INSIGHTS`
> key (defaults ON). Wired into `ComprehensiveReportAggregator` (own future, `available=false`
> fallback) and `ComprehensiveStudentReport.learningInsights`. `mvn compile` clean. Frontend render
> (F1) still pending — data is produced but not yet displayed.

**New:** `service/aggregation/collectors/LearningInsightsCollector.java` + DTO
`dto/comprehensive/LearningInsightsSection.java`.

- **Read:** all `processed` `activity_log` rows in range (extend
  `ActivityLogRepository.findProcessedLogsForAnalysis` — today it `LIMIT 5`; add an unlimited/param
  variant so aggregation is representative). READ-ONLY, same isolation rules as other collectors.
- **Parse & aggregate** each row's `processed_json` (fields per `LLM_ANALYSIS.md` /
  `StudentAnalyticsLLMService.createStudentAnalysisPrompt`):
  - `topic_analysis[]` → merge by topic: Σ`questions_count`, Σ`correct`, weighted `accuracy`,
    avg `avg_time_seconds`, dominant `mastery_level` → **Topic Mastery** list (chart + grounds strengths/weaknesses).
  - `blooms_taxonomy{6 levels}` → Σ`{total,correct}` per level → **Bloom's profile** (radar).
  - `confidence_estimation` → Σ buckets (`high_confidence_correct`, `high_confidence_wrong`,
    `low_confidence_correct`, `guessed_correct`) + avg `overall_confidence` → **Confidence** (donut/quadrant).
  - `misconception_analysis[]` → collect `{question_summary, misconception, remediation}` (cap ~8,
    newest first) → **"What to fix"** cards.
  - Optionally roll `strengths`/`weaknesses` maps as corroborating signal.
- **Section shape (snake_case):**
  ```
  learning_insights: {
    available: bool,
    attempts_analyzed: int,
    topic_mastery: [ { topic, questions, correct, accuracy, avg_time_seconds, mastery_level } ],
    blooms: [ { level, total, correct, accuracy } ],           // 6 fixed levels
    confidence: { overall, knows, guesses, high_conf_wrong, buckets{...} },
    misconceptions: [ { topic, misconception, remediation } ]
  }
  ```
- **Wire-in:** add to `ComprehensiveReportAggregator.collect` fan-out (own future, `available(false)`
  fallback, 60s cap). Fold under a new `ReportModule` key `learning_insights` (defaults ON) or under
  `activity` to avoid a new toggle — **recommend new key** so admins can exclude it.
- **Add field** `learningInsights` to `ComprehensiveStudentReport` (nullable, additive).

### Phase B2 — one unified, consistent LLM call ✅ IMPLEMENTED (2026-07-08)

> **Status: done & compiling.** New `NarrativeSection` DTO (v1's 6 rich-Markdown fields) +
> `ComprehensiveStudentReport.narrative`. `ComprehensiveReportLLMService.buildPrompt` now feeds
> `learning_insights` (+ subject_marks) into the facts and asks for BOTH `ai_insights` AND a
> `narrative` object in ONE response; `parseInsights` parses `narrative` (lifted via
> `AiInsightsSection.narrative` @JsonIgnore → `report.narrative` in `processV2`). Deterministic
> fallback confirmed gap-fill-only (never overwrites LLM output) and now also seeds strengths/areas
> from `learning_insights.topic_mastery`. `mvn compile` clean. (Subject-marks clustering left as its
> own guarded call for now — folding into the single call is a later optional refinement.)

Rework `ComprehensiveReportLLMService.narrate` (do **not** touch v1's `StudentReportLLMService`; it stays for history):

- **Enrich the prompt** (`buildPrompt`): keep the Layer-1 `factsOnly` JSON **and** append:
  - the aggregated `learning_insights` section,
  - a compact digest of the raw `processed_json` (top misconceptions + per-topic accuracy) — the
    "texture" v1 had, but pre-summarized so it's cheaper than v1's raw dump,
  - learner-operations summary (as v1 did).
- **Expand the output schema** to also return v1's narrative block:
  ```
  narrative: {
    learning_frequency, progress, student_efforts,
    topics_of_improvement, topics_of_degradation, remedial_points   // rich Markdown
  }
  ```
  Add `NarrativeSection` DTO + `narrative` field on `ComprehensiveStudentReport`. Parse alongside the
  existing `ai_insights` fields in one response.
- **Consistency fix:** deterministic fallback (`ensureInsightsFromFacts`) becomes **gap-fill only** —
  it may fill an *empty* field but must never overwrite a populated LLM field. One call means one
  failure surface; on total failure we still ship facts + graphs (unchanged guarantee).
- **Subject-marks clustering:** fold into the same call (ask for `subject_marks` in the same JSON) to
  drop the second round-trip, *or* keep `clusterSubjectMarks` but only when `academics` present.
  Recommend folding in — fewer calls = fewer partial states. Percentages still recomputed in Java.

### Phase B3 — trends over time ✅ IMPLEMENTED (2026-07-08)

> **Status: done & compiling.** `processV2` now calls `enrichTrends(report, process)` after
> aggregation (before narration, so the LLM sees trends too). Uses the existing
> `StudentAnalysisProcessRepository.findMostRecentPriorV2Report` (READ-ONLY), deserializes the prior
> report, maps prior `headline_metrics` by key, and sets `trend` (up/down/steady) + `change`
> ("+5% vs last") on numeric current metrics — leaving existing change labels (e.g. study_time
> "~N min/day") intact. No prior report / unparseable → trends stay null (unchanged behavior).
> `mvn compile` clean.

- In `OverviewBuilder` (or the processor before it), load the **most recent prior COMPLETED**
  `student_analysis_process` for the same user, deserialize its headline metrics, and set
  `trend`/`change` on the new metrics (attendance %, avg score, completion %, study time).
- Guard: no prior report → `trend=null` (current behavior). Cheap single query, big parent value.

### Phase B4 — collapse to one payload shape

- Confirm the backend emits only the "new" `V2ReportData`-compatible shape (it already does — `meta` +
  `overview.headline_metrics` present). Remove any code path emitting the legacy 9-tab shape.
- `data_notes` gains a line about `processed_json`-derived insights + trend basis.

---

## 3. Frontend — one parent-first layout ✅ IMPLEMENTED (admin + learner, 2026-07-08)

> **Shipped:** `StudentReportCard.tsx` + scoped `report-card.css` (`.vsr`, light-only "paper document")
> reproducing the prototype pixel-for-pixel (hero verdict, KPI row w/ trend arrows, Bloom's radar +
> confidence donut as inline SVG, topic-mastery bars, subject donuts + class-avg markers with
> Unknown/Other filtered, misconception cards, sparkline, achievements, collapsible narrative via
> react-markdown). Accent = institute `theme_color`. Wired into admin `ComprehensiveReportDialog` and
> learner `my-reports/$processId` (+ Download PDF). Verified via scoped-CSS harness screenshot; 0
> design-lint errors; typechecks clean in both apps.

> **Visual prototype (2026-07-08):** a self-contained HTML mock of the target parent-first layout was
> built and published as an Artifact (serif-heading "report card" treatment, teal accent, light+dark
> themes, all charts as inline SVG: Bloom's radar, confidence donut, topic-mastery bars, subject
> donuts with class-average markers, misconception "what to fix" cards, study sparkline, collapsible
> detailed analysis). It renders the FULL combined data model including the new `learning_insights`
> and `narrative`. Use it as the visual spec for F1. Source:
> `scratchpad/student-report-prototype.html`.

**Standardize on the single-scroll card** (`StudentReportCardAdmin` / learner `comprehensive-report-card.tsx`)
and **retire**: the old 9-tab branch in `ComprehensiveReportDialog.tsx`, and v1 `StudentReportDetailsDialog`
**for new reports** (keep it only for historical `report_version==='v1'` rows).

- **One charting engine — recharts** everywhere. Replace the hand-rolled absolute-positioned div bars
  (`daily_study_minutes`) and the brittle hardcoded-circumference SVG donuts with recharts
  `AreaChart`/`RadialBar`/`RadarChart`/`BarChart` wrapped in the shadcn `ChartContainer`.
- **New visuals from `learning_insights`:**
  - Bloom's **RadarChart** (6 levels, accuracy).
  - Topic-mastery **horizontal bar** / heat bars (accuracy per topic, color by mastery_level).
  - Confidence **donut** (knows vs guesses vs high-confidence-wrong).
  - **"What to work on next"** cards: misconception → remediation (+ merge prioritized recommendations).
- **Deep narrative** (`narrative.*`) rendered with the existing `react-markdown` setup inside an
  expandable **"Detailed analysis"** accordion — depth on demand, not a wall by default.
- Update `types/student-analysis.ts`: add `learning_insights` + `narrative` to `V2ReportData`; keep the
  type guard but simplify (single v2 shape).

### PDF ✅ IMPLEMENTED (2026-07-08)

> `StudentReportPdfService` (openhtmltopdf, CSS 2.1, no JS) restyled to the report's palette + serif
> headings + verdict/KPI/card aesthetic (single `<style>` block → restyles all sections at once). Added
> the **Learning Insights** section (Bloom's radar + confidence donut as **static inline SVG generated
> in Java** — no `viewBox`, `xmlns` set, so it survives the jsoup XHTML sanitiser + Batik; plus
> topic-mastery bars + misconception rows) and the **Detailed analysis** section (narrative via a
> minimal Markdown→HTML converter). Registered `BatikSVGDrawer`; added `openhtmltopdf-svg-support:1.0.10`
> (+ transitive Batik) to `pom.xml`. Compiles offline. **Visual note:** the actual rendered PDF could
> not be verified in-session (needs a running service + a completed report); confirm the SVG charts on
> first real render — CSS-bar fallback is a quick follow-up if Batik misrenders.

### Section order (parent-first, top → bottom)
1. **Hero verdict** — status badge + grade + `overview.one_line` + `parent_summary` (plain language).
2. **At a glance** — `headline_metrics` KPI tiles **with trend arrows** vs last period, sentiment color.
3. **Thinking skills** — Bloom's radar + confidence donut (the "how they think", not just scores).
4. **Subjects & marks** — subject_marks donuts / academics bars **with class-average comparison** (data already exists, currently dropped). **Render guard:** skip any subject row/donut whose label is null/"Unknown"/"Other" (defense-in-depth for the B0 backend rule); hide the whole sub-section if nothing resolves.
5. **Topic mastery** — strengths (green) / areas-to-improve (amber) bars, grounded in `topic_analysis`.
6. **What to work on next** — misconceptions + remediation + prioritized recommendations (action-oriented).
7. **Habits & consistency** — study-time area chart, streak, attendance donut, live-class attendance.
8. **Progress & achievements** — course completion, certificates/badges.
9. **Detailed analysis** (collapsible) — v1 narrative Markdown + cross-domain insights.

---

## 4. Isolation, risk, rollout

- **Additive only.** New nullable DTO fields/sections; old stored JSON deserializes unchanged. No DB
  migration required unless we choose to persist a `report_version="v3"` marker (optional; not needed).
- **v1 untouched at runtime.** `StudentReportLLMService` + `StudentReportDetailsDialog` remain for
  historical rows; we only stop *initiating* v1.
- **Per-collector isolation preserved.** `LearningInsightsCollector` failure → `available:false`, never
  fails the report (existing aggregator contract).
- **Cost:** parsing `processed_json` is local CPU; one merged LLM call is *cheaper* than v2's current two.
  Extending the processed-logs query beyond 5 rows: cap (e.g. 50) to bound tokens.
- **Testing:** (a) unit-test the `processed_json` aggregator with real sample blobs; (b) golden-file the
  merged report JSON; (c) run end-to-end for a student with rich activity + one with none (empty-window
  graceful degrade); (d) verify historical v1 + old-v2 rows still render.

---

## 5. Build order (suggested PRs)

1. **B1** LearningInsightsCollector + DTO + aggregator wire-in + repo query (backend, self-contained, testable alone).
2. **B2** Unified LLM prompt/schema + narrative section + gap-fill fallback.
3. **B3** Trend deltas.
4. **F1** Frontend: `learning_insights` + `narrative` types, new recharts visuals, parent-first section order.
5. **F2** Retire 9-tab path + route v1 dialog to history-only; unify charting engine.
6. **B4/cleanup** + docs update (fold into `STUDENT_ANALYSIS_REPORT.md` / `STUDENT_REPORT_DATA_SOURCES.md`).
```
