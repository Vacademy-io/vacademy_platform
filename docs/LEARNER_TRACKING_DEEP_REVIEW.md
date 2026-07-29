# Learner Tracking Deep Review — Correctness Audit + Configurability Inventory

> **Date:** 2026-07-28. Produced by a three-way code audit: backend math (`admin_core_service`),
> learner-app tracking (`frontend-learner-dashboard-app`), and the settings/consumer landscape.
> Companion to [`LEARNER_PROGRESS_TRACKING.md`](LEARNER_PROGRESS_TRACKING.md) — this document
> verifies that doc's claims, adds **new** findings it missed, and inventories every hardcoded
> threshold that should become institute-configurable.
>
> **Status update (2026-07-29):** the common-to-all-institutes fixes have been implemented on main:
> R-1 (ownership checks on `ActivityLogService` + token-derived identity on all five interactive
> paths), R-2 (bounded default `taskExecutor` in `config/DefaultAsyncConfig.java`), R-3 (batch video
> recompute now merged-union, NULL-skipping), R-6 (concentration: null-safe service outside the
> rollback path, per-minute-rate formula replacing the log-saturated one, real metrics threaded from
> the video players through `useVideoSync`, per-slide metric storage), R-7 (quiz status filters +
> quiz-scoped numerator), R-8 (end≥start guard in the segment merge), R-10 (batch recompute covers
> the changed level and the course), R-13 (doc % NULL not 0 on missing page count), R-14 (breadcrumb
> upserts refuse re-parenting), R-15 (audio breadcrumbs upsert), R-17 (AUDIO branch in slide
> move/copy + trigger), B-P5 (migration `V409` dedupe + unique index, atomic `ON CONFLICT` upsert),
> R-4 (failed syncs retry instead of erasing the buffer), R-5 (audio endpoint URL was a 404 —
> fixed to the real route with all four cascade ids; open segment closed on tick/unmount),
> R-11 (`togglePlay` delegates to media events), R-12 (Capacitor `appStateChange` flush in
> video/audio/pdf sync hooks).
>
> **Configurability shipped:** new `LEARNER_TRACKING_SETTING` institute setting (generic strategy,
> no backend code) + admin UI at Settings → LMS → Learner Experience → **Learner Activity**
> (completion threshold, page/action dwell, content-aware reading time for single-page docs, idle
> popup enable/delay, hard pause). Learner app reads it via
> `src/services/learner-tracking-settings.ts` (24 h cache, defaults = old constants) and
> `getSlideCompletionThreshold()` now backs all former `SLIDE_COMPLETION_THRESHOLD` call sites.
>
> **Still open (product decisions needed):** B-P2/`VIDEO_QUESTION` cascade formula, presentation
> slides (instant-100% path vs never-synced Excalidraw path), R-16 SCORM client-trust,
> R-20 quiz batch-id resolver, R-9 engaged_ms freeze/unit mixing, B-P3 prod backfill,
> certificate-threshold two-key unification, popup countdown (still 59 s), and the decorative
> popup answer. See Part D.

---

## Part A — Verdicts on the known bugs (B-P1…B-P12)

| ID | Verdict | Notes |
|---|---|---|
| B-P1 Excalidraw never syncs | ✅ Confirmed, **with a twist** | `presentation-tracking-store` / `ExcalidrawViewer` / `deck-player` / `split-screen-html-video-slide` emit **no network activity** (stuck 0%). But `presentation-viewer.tsx` + `usePresentationSync.ts:102` hardcode `percentage_watched: 100` and sync **500 ms after mount** — so depending on which component renders, a presentation slide is either permanently 0% or instantly 100%. Both are wrong. |
| B-P2 VIDEO_QUESTION never aggregated | ✅ Confirmed + worse | `SlideService.java:450-456` *does* fire a batch trigger for VIDEO_QUESTION on move/copy, which falls into the DOCUMENT `else` branch of `updateLearnerOperationsForSlideTrigger` — wrong-by-construction (returns null in practice). |
| B-P3 backfill not run | Unverifiable from source | Runbook exists; ask ops. |
| B-P4 hardcoded 1-min windows | ✅ Confirmed | And compounded by NEW-7: `engaged_ms` freezes at that first fabricated window forever. |
| B-P5 duplicates + read-then-write | ⚠️ Half-refuted | No unique index and non-atomic upsert confirmed. But `NonUniqueResultException` **cannot happen** — `LearnerOperationRepository.java:12-23` is `ORDER BY updated_at DESC LIMIT 1`. Duplicates silently split-brain instead, which is worse: the chapter query SUMs all duplicate rows while COUNTing the slide once → inflated chapter %. And `ORDER BY updated_at` is meaningless because of B-P6. |
| B-P6 `updated_at` never written | ✅ Confirmed | Also true of `activity_log`. |
| B-P7 doc % can exceed 100 | ✅ Confirmed | |
| B-P8 re-parenting fixed | ⚠️ Partially | Fixed only for document/video/audio (`LearnerTrackingService.java:123-145`). **Not** fixed for question/quiz/assignment/assessment/video-question (see NEW-1). Breadcrumb-level re-parenting still possible (NEW-11). |
| B-P9 assignment trusts client userId | ✅ Confirmed, under-scoped | Same hole on QUESTION, QUIZ and VIDEO_QUESTION controllers. ASSESSMENT is clean. |
| B-P10 dead enum values | ✅ Confirmed | |
| B-P11 grading never affects progress | ✅ Confirmed | |
| B-P12 subject rollup unscoped | ✅ Confirmed + extended | The **module** query also has no package-session id predicate (joins `chapter_package_session_mapping` for status only), and the package-session query doesn't filter `subject_session` mapping status. |

Doc erratum: §5 claims percentage writers produce `"null"` strings — they can't (null returns early).
The `"null"` strings come from the **bookmark** writers (`String.valueOf(null Long)`) at
`LearnerTrackingAsyncService.java:327-328, 373-374, 80-81`.

---

## Part B — New findings, severity-ranked

### 🔴 Critical

**R-1 — Cross-learner activity overwrite on all interactive slide endpoints.**
`ActivityLogService.java:37-48` (used by QUESTION, QUIZ, ASSIGNMENT, ASSESSMENT, VIDEO_QUESTION)
saves/updates an activity by **client-supplied id with no ownership or slide-binding check** — the
exact hole PR #2361 closed in `LearnerTrackingService` was never applied here. A learner posting
another learner's `activity_id` overwrites their times and `percentage_watched`, and for quiz the
service **deletes and replaces** the victim's `quiz_slide_question_tracked` answer rows
(`QuizSlideActivityLogService.java:29`). Related: QUESTION/QUIZ/ASSIGNMENT/VIDEO_QUESTION
controllers bind a bare client `userId` request param that becomes `activity_log.user_id` (B-P9 was
scoped to assignment only).

**R-2 — The tracking cascade runs on an unbounded thread-per-task executor.**
`Executors.newFixedThreadPool(10)` at `LearnerTrackingAsyncService.java:40` is **dead code — never
referenced**. Because other `Executor` beans exist (`workflow/config/AsyncConfig.java`,
`TelephonyAsyncConfig.java`), Spring Boot's default `applicationTaskExecutor` is not created and
unqualified `@Async` falls back to `SimpleAsyncTaskExecutor` — a **new thread per invocation**. A
class-wide quiz submission or one `updateLearnerOperationsForBatch` spawns hundreds of threads each
holding DB connections → Hikari exhaustion, and far more write-race pressure on B-P5 than "10
threads" implies. Fix: a bounded `@Bean("taskExecutor")` or `@Async("trackingExecutor")`.

**R-3 — Batch recompute uses a different, inflated video formula and the monotonic guard makes it permanent.**
Live path: merged-union of watched segments. Batch/trigger path
(`ActivityLogRepository.getPercentageVideoWatched:29-51`, `getPercentageHtmlVideoWatched:53-75`,
reached from every slide edit/move/copy): **`MAX(end) − MIN(start)` span**. Watch 10 s at the start
+ 10 s at the end of a 30-min video, then have an admin rename the slide → 100%, locked in forever
by the B9 guard. Silently falsifies completion (and certificates) for whole batches.

**R-4 — A failed sync destroys the learner's local progress buffer.**
`useVideoSync.ts:348-352, 370-374` (and the same shape in `usePdfSync.ts:88-114`): on POST
rejection the activity is dropped from `updatedActivities`, then storage is overwritten with that
array — one 500/timeout on the 60 s tick erases the un-synced watched segments. Also
`useVideoSync.ts:223-228` / `useAudioSync.ts:182-187` prune all but the last SYNCED activity.

**R-5 — Audio: continuous listens are lost, and audio never rolls up past the slide.**
(a) `audio-player.tsx` only creates a segment on pause/seek/skip/speed/ended — an uninterrupted
40-min listen followed by tab close = **0%** (periodic sync no-ops on empty buffer; unmount sync
doesn't close the open segment). (b) The audio activity endpoint
(`useAudioSync.ts:196-206`, `constants/urls.ts:102`) sends **none of the four cascade ids** — audio
progress can never move chapter/module/subject/course. This contradicts the companion doc's
cheat-sheet row for Audio.

**R-6 — The concentration score is garbage end-to-end.**
Four independent breakages compound:
1. **Backend formula saturates**: `ConcentrationScoreCalculator.java:28-37` multiplies a 0–1 base
   score by `log(activityLength+1)` (≥4 at 60 s) before clamping to 100 — essentially every stored
   row is `100.0`. The metric shown in learner reports, batch reports, parent PDFs and LLM
   analytics is a constant.
2. **Video metrics never arrive**: `useVideoSync.ts:310-319, 161-169` hardcodes
   `concentration_score: 0, tab_switch_count: 0, pause_count: 0` at sync time, discarding
   everything the players computed.
3. **Fabricated inputs**: quiz/question/assignment submits send `concentration_score: 100,
   tab/pause: 0`; Jupyter sends `0`; document viewers send `pause_count: missedAnswerCount` (a
   different metric).
4. **NPE + rollback**: `ConcentrationScoreService.java:16-29` dereferences the DTO and
   `getEndTime()` without null checks and throws on `activityDuration <= 0` — as the *last*
   statement of the `@Transactional` document/video/audio writers. A zero-length final flush (tab
   close) or a payload missing `concentration_score` 500s and **rolls back the learner's page
   views** for that window.

### 🟠 High

**R-7 — Quiz percentage: inconsistent status filters and unscoped join.**
`ActivityLogRepository.java:77-102`: denominator counts only ACTIVE questions; numerator counts
tracked responses with **no status filter** (deleted questions still count) and checks
`qq.quiz_slide_id IS NOT NULL` instead of `= qz.id`. Adding questions after a learner hits 100% is
also frozen out by the monotonic guard; a quiz whose questions are all inactive silently no-writes.

**R-8 — Inverted segments subtract watch time.**
`getUniqueWatchedDurationMillis` (`LearnerTrackingAsyncService.java:379-404`) has no `end ≥ start`
guard (the engaged_ms SQL does, three times). A seek-race segment `{start: 400s, end: 395s}`
contributes **−5 s**; totals can go negative, and a negative percentage passes the write guard and
the rollup regex, dragging chapter averages down.

**R-9 — `engaged_ms` is frozen at first insert for interactive slides and mixes units elsewhere.**
`ActivityLog.java:139-142` only computes when null → a quiz opened with the fabricated 60 s window
(B-P4) reports 60 s forever regardless of real time. And for video/audio, `engaged_ms` unions
**media-timeline offsets** with document wall-clock times (`computeEngagedMsFromBreadcrumbs`), so
2× playback = 2× "engaged" time. The leaderboard (`LeaderboardService.java:197`) is pure
`SUM(engaged_ms)` — both distortions hit it directly.

**R-10 — `updateLearnerOperationsForBatch` never recomputes the level that changed, nor the course.**
`LearnerTrackingAsyncService.java:650-677`: `CHAPTER` → runs module+subject only (stale chapter
values are re-averaged; course untouched). Slide-set edits leave the whole tree wrong until each
learner independently studies that chapter.

**R-11 — Frontend double-counting and race in the HTML5 player.**
`custom-video-player.tsx`: `togglePlay` (onClick) and `handleVideoPause`/`Play` (media events) both
fire — pauses counted twice, first play double-syncs, and the two paths use **different segment
math** (wall-clock 1 Hz counter vs true playhead), so playback-speed distortion depends on which
button the learner clicked.

**R-12 — No Capacitor lifecycle handling in any tracking path.**
Only web `pagehide` is handled. On Android: home button, task kill, screen lock, OS reclaim → all
data since the last 60 s tick is lost, while `document.hidden` still charges a tab-switch + pause
penalty for locking the screen. The pagehide flush itself bails silently unless five URL params are
present (`useVideoSync.ts:81-89`).

### 🟡 Medium

- **R-13** — Document % writes `0.0` where video writes nothing: `getPercentageDocumentWatched`
  wraps in `COALESCE(…, 0)`, so a slide with null/0 `published_document_total_pages` inserts a real
  0 row, breaking the "null = keep" contract and the §14 debugging heuristic.
- **R-14** — `document_tracked` upsert re-parents breadcrumbs across activities
  (`DocumentTrackedRepository.java:26-32` — `ON CONFLICT (id) DO UPDATE SET activity_id = …`).
- **R-15** — Audio breadcrumbs still use delete-then-insert (`LearnerTrackingService.java:262-270`)
  — the concurrency pattern documents/videos were migrated off.
- **R-16** — SCORM: the 100% completion lock and all cascade ids are pure client body content —
  one crafted POST forces a permanent 100%. `attempt_number` never increments past 1.
- **R-17** — AUDIO missing from the slide move/copy trigger (`SlideService.java:417-478`) — no
  branch, silent fall-through; stale chapters on both sides of a move.
- **R-18** — Client-supplied `activity_log.percentage_watched` is stored unvalidated and drives the
  "recent incomplete slides" resume query (`SlideRepository.java:123, 288`).
- **R-19** — Chapter/subject/course rollups have no defence against duplicate mapping or
  `learner_operation` rows (only the module query uses `DISTINCT ON`).
- **R-20** — Quiz viewer hand-rolls the batch id (`sessionId || courseId || selectedSession?.id`)
  instead of `useResolvedPackageSessionId`; wrong-batch writes for multi-batch learners on
  non-study-library entry points. It also rewrites the React Query cache to
  `percentage_completed: 100` from a localStorage key — display-only, but masks failed server
  writes.
- **R-21** — The anti-cheat popup is decorative: for documents the correct answer is always the
  **largest of the three numbers shown** (`pdf-viewer.tsx:302-311`); for videos the check is
  literally `index === 1` and the UI prints that number. Answering costs one mousemove; concentration
  metrics live in a **global, never-reset** Preferences key (`video_concentration_metrics`), so a
  returning learner's client-side score is pinned at 0 across all courses forever.
- **R-22** — Wall-clock timestamps everywhere (`Date.now()`, no monotonic clock); device clock skew
  produces `end ≤ start` rows that `useVideoSync.ts:259-277` drops **and marks SYNCED** (destroyed,
  not retried). Backend `timestamp without time zone` + JVM-default-TZ rendering shifts historical
  day buckets if the service TZ ever changes. `getISTTime()` stores a `7/28/2026, 4:05 PM` locale
  string as `start_time`.

### Fairness gaps (the "practical cases" the review was asked for)

| Case | Today | Verdict |
|---|---|---|
| Huge single-viewport HTML/DOC | `totalPages = ceil(contentHeight/viewportHeight)`; a one-viewport slide = 1 page = 100% after one 60 s tick, **regardless of content length** | Over-credit |
| Long multi-viewport HTML doc | Every viewport slice needs ≥10 s dwell; fast scroll credits nothing | Under-credit (honest fast reader) |
| Leave a document at 55 s | 0 credit — first sync at 60 s, no unmount flush | Under-credit |
| PDF page jump / resume | Resume auto-jumps to `progress_marker`; skipped pages never credited (correct), but `percentage_watched` sent is a raw page **count**, unrelated to `numPages` | Inconsistent |
| 2× video playback | Custom-button path credits wall-clock (half credit at 2×); media-event path credits playhead (full) — depends on which control was used | Both directions |
| Audio seek to 99% + 1 s | Segment near end + client `percentage_watched ≈ 100`; backend union math is the only defence | Gameable (bounded) |
| Blank quiz submit / timer expiry | 100% completion | By design (B-P11) but should be a per-institute policy |
| Android app-switch to calculator | Tab-switch penalty kept, progress since last tick lost | Penalised + robbed |
| Phone screen lock | Counted as tab switch + pause | False penalty |

---

## Part C — Hardcoded values that should be institute-configurable

### C.1 The threshold-drift problem (fix before adding new settings)

The same conceptual number already lives in multiple uncoordinated places:

1. **Certificate threshold — two different settings keys**: backend-enforced
   `CERTIFICATE_SETTING.data.data[].autoIssuePercentage`
   (`InstituteSettingService.java:513-535`, default 80 at `:68`) vs frontend-only
   `STUDENT_DISPLAY_SETTINGS.certificates.generationThresholdPercent`
   (`course-details-page.tsx:1016-1022`, default 80 in both apps' `student-defaults.ts`). Lower one
   and not the other → the UI offers a certificate the backend refuses (or vice versa).
2. **Course-completion threshold**: already per-course configurable in SQL —
   `COALESCE((course_setting→'COURSE_COMPLETION_SETTING'→>'completionThresholdPercentage')::numeric, 80)`
   at `PackageRepository.java:357, 405, 562, 602` (the literal 80 is repeated 4×) — but the learner
   app hardcodes `SLIDE_COMPLETION_THRESHOLD = 80` (`constants/study-library.ts:13`) at **17 call
   sites** and never reads the setting. Any institute changing the per-course value desyncs
   backend "completed" counts from learner-visible green ticks.
3. **Drip defaults** (75/100/100 in `drip-conditions.ts:501-511`) vs completion 80 — a 78% slide is
   "complete" nowhere but satisfies a 75% drip rule. Drip is also **evaluated entirely
   client-side**; the backend never enforces locks.
4. **engaged_ms 24 h cap** duplicated (`ActivityLog.java` + `LearnerTrackingService.java:175`);
   **2023-01-01 sentinel** duplicated 17× (1 Java + 16 SQL literals); **concentration clamp**
   inlined ~15× with an inconsistent `> 0` filter (present in 5 queries, absent in 5 — learner and
   batch averages are computed over different populations).
5. **Default-settings blobs and types are maintained twice** — one copy per frontend app.

### C.2 Full inventory of hardcoded tracking constants

**Frontend (learner app)** — `SM` = `…/chapter-material/slide-material`:

| Constant | Value | Where | Should be |
|---|---|---|---|
| PDF/DOC page dwell | 10 s | `pdf-viewer.tsx:556`, `doc-viewer.tsx:518`, `presentation-viewer.tsx:195` | **Per-institute**, per-type |
| Jupyter/Scratch/Code action dwell | 5 s | `jupyter…:384`, `scratch…:385`, `code-editor…:470` | Per-institute |
| Min audio segment | 500 ms | `audio-player.tsx:170` | Constant is fine |
| Sync cadence (all viewers) | 60 s | 10+ sites (`pdf-viewer.tsx:538`, `useVideoSync` clamps, etc.) | Single shared constant; per-institute optional |
| Idle → popup | 60 s | 6 viewers (`pdf-viewer.tsx:104` etc.) | **Per-institute** (already configurable for video via `concentration.frequency` 5–7 min — documents ignore it) |
| Popup countdown | 59 s | ~20 sites | Per-institute |
| Hard auto-pause | 5 min | 5 viewers ×2 sites each | Per-institute |
| Video popup interval | 5–7 min | `student-defaults.ts:199-200` | ✅ already configurable — extend to documents |
| Client concentration penalties | −10/−5/−20/−5 | `youtube-player.tsx:535-541` | Per-institute (currently discarded anyway, R-6) |
| Slide/chapter complete threshold | 80 | `SLIDE_COMPLETION_THRESHOLD`, 17 sites | Read from `COURSE_COMPLETION_SETTING` |
| Certificate threshold | 80 | `course-details-page.tsx:431,1022` + defaults | Unify with `CERTIFICATE_SETTING` |
| Drip defaults | 75/100/100 | `drip-conditions.ts:501-511` | Per-institute |
| Refetch waves | 500/1500/3000 ms | `refreshProgressAfterSubmit.ts:35-36` | Constant is fine |
| Fabricated attempt window | `Date.now()−60000` | question/quiz/assignment slides (B-P4) | Delete — send real times |

**Backend:**

| Constant | Value | Where | Should be |
|---|---|---|---|
| Hardcoded 100% on submit | 100.0 | `LearnerTrackingAsyncService.java:179,190,225,281` | **Per-institute policy** (see C.3 — attempt-based vs mastery-based) |
| Cascade lists (8 ops / 9 types / 2 statuses) | — | `:494-513` | Add VIDEO_QUESTION; keep code-owned |
| engaged_ms cap | 24 h | ×2 | Single constant |
| Concentration weights | 0.5/0.3/0.2 + `log(len+1)` | `ConcentrationScoreCalculator.java` | **Redesign the formula first** (R-6), then per-institute weights |
| 2023-01-01 sentinel | ×17 | `ActivityLog.java:114` + 16 SQL | Single constant / SQL param |
| SCORM completion lock | 100 on `completed/passed` | `ScormTrackingService.java:142` | Spec-required; keep |
| Certificate auto-issue default | 80 | `InstituteSettingService.java:68` | Already per-institute; kill the duplicate frontend key |
| Course-completion default | 80 ×4 | `PackageRepository.java:357,405,562,602` | Already per-course; deduplicate the literal |

### C.3 Recommended configuration design

Use the existing frameworks — **zero new backend plumbing needed** for most of it:

1. **Learner-behavior knobs** (dwell times, idle/popup timers, sync cadence, penalties) → a new
   `tracking` block inside `STUDENT_DISPLAY_SETTINGS`, next to the existing `concentration` block
   (`student-defaults.ts:196-210`, already consumed by `vimeo-player.tsx:163-171`). The
   `GenericSettingStrategy` stores unknown keys as-is; the learner app already fetches, deep-merges
   against defaults and caches this blob for 24 h, and `services/student-display-settings.ts:378-384`
   shows the migration idiom for injecting a new sub-section into stale caches. Admin editor goes in
   `StudentDisplaySettings.tsx`.
2. **Completion-policy knobs** (what counts as "done") → per-course `COURSE_COMPLETION_SETTING`
   (already exists in `package.course_setting`, already read by `PackageRepository`), extended with
   per-slide-type policy, e.g. `{ quizCompletion: "ATTEMPTED" | "PASSED", videoCoveragePercent: 90,
   docMinReadSeconds: … }`. Backend enforcement readers follow the `InstituteSettingUtils` pattern.
3. **Content-aware document dwell** (the "one giant HTML page" fix): stop treating every non-PDF
   document as one 10-second page. Compute an **expected reading time** at publish (word count ÷
   ~200 wpm, clamped to [min, cap] — both configurable) and store it on `document_slide` next to
   `published_document_total_pages`; the doc viewer then requires cumulative focused dwell ≥ that
   value, and the backend formula becomes `min(100, dwell_ms / expected_ms × 100)` instead of
   `pages/1`. This also fixes the inverse unfairness (fast scroll through a long doc credits 0).
4. **Unify the four-way certificate threshold**: keep `CERTIFICATE_SETTING.autoIssuePercentage`
   as the single source (it's the backend-enforced one), make the learner app read it, delete
   `generationThresholdPercent` after migration.
5. Do **not** ship per-institute concentration weights until the formula is fixed — configuring a
   metric that always returns 100 is cosmetic.

---

## Part D — Suggested fix order

1. **R-1** ownership checks on `ActivityLogService` + strip client `userId` params (security; mirrors the existing PR #2361 fix). Include R-16 SCORM cascade-id validation.
2. **R-2** bounded `@Async` executor (availability under load).
3. **R-6** concentration pipeline: null-guard + move `ConcentrationScoreService` out of the rollback path, fix the saturating formula, stop zeroing video metrics in `useVideoSync`, stop fabricating 100/0 on submits. Until then, hide the metric from reports or label it.
4. **R-3** make the batch path use the merged-union formula (it permanently falsifies completion).
5. **R-4/R-5** frontend data-loss: keep failed activities in the buffer for retry; close the open audio segment on unmount; add the cascade ids to the audio endpoint; add Capacitor `appStateChange` flush (R-12).
6. **R-10 + R-17 + B-P2** cascade completeness (recompute the changed level + course; AUDIO branch; VIDEO_QUESTION into the cascade).
7. **R-8/R-13** formula guards (reject `end < start`; return null not 0 for missing page counts).
8. Threshold unification (C.1), then the configurability build-out (C.3).
9. B-P5 for real: unique index on `(user_id, source, source_id, operation)` + `ON CONFLICT` upsert — prerequisite for trusting any of the numbers at scale.

---

*Full agent transcripts and per-finding evidence: session of 2026-07-28. All file:line references
verified against `main` at time of writing.*
