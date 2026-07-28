# Learner Progress Tracking — How a Slide, Chapter, Module, Subject and Course Get Completed

> **Audience:** engineers *and* non-technical staff (support, QA, product, customer success).
> Part 1 is plain English — no code. Part 2 onwards is the engineering detail.
>
> **Source of truth:** the code in this repository as of **2026-07-28**. Every claim below was
> read out of current `main`, not inherited from earlier docs. Where an older doc disagrees,
> this one is right and the discrepancy is called out in [§12](#12-corrections-to-earlier-docs).

---

## Table of contents

**Part 1 — Plain English**
- [1. The one-paragraph answer](#1-the-one-paragraph-answer)
- [2. "What do I have to do to complete this slide?" — the cheat sheet](#2-what-do-i-have-to-do-to-complete-this-slide--the-cheat-sheet)
- [3. Five things that surprise everyone](#3-five-things-that-surprise-everyone)

**Part 2 — The Engineering Detail**
- [4. The course hierarchy](#4-the-course-hierarchy)
- [5. Where progress is stored](#5-where-progress-is-stored)
- [6. The write path — from click to stored percentage](#6-the-write-path--from-click-to-stored-percentage)
- [7. Slide-level completion, type by type](#7-slide-level-completion-type-by-type)
- [8. Document slides in depth](#8-document-slides-in-depth)
- [9. The roll-up — chapter, module, subject, course](#9-the-roll-up--chapter-module-subject-course)
- [10. The rules that govern every write](#10-the-rules-that-govern-every-write)
- [11. The read path — who consumes these numbers](#11-the-read-path--who-consumes-these-numbers)
- [12. Corrections to earlier docs](#12-corrections-to-earlier-docs)
- [13. Known bugs, gaps and sharp edges](#13-known-bugs-gaps-and-sharp-edges)
- [14. Debugging a stuck percentage](#14-debugging-a-stuck-percentage)
- [15. Change history that shaped this system](#15-change-history-that-shaped-this-system)

---

# Part 1 — Plain English

## 1. The one-paragraph answer

Every slide a learner touches gets a **completion percentage from 0 to 100**, stored as one row in
a single table. What earns that percentage depends entirely on the *kind* of slide: watching a video
earns it by seconds watched, reading a PDF earns it by pages seen, answering a question earns it
instantly on submit. Once a slide's percentage changes, the system immediately recalculates the
chapter that slide belongs to, then the module, then the subject, then the whole course — each level
being simply **the average of the level below it**. There is no weighting: a 2-minute question slide
counts exactly as much as a 40-minute video in the same chapter.

```
   slide %   ─avg→   chapter %   ─avg→   module %   ─avg→   subject %   ─avg→   COURSE %
                                                                                    ↑
                                                              the number on the learner's home page
```

Two consequences worth internalising before anything else:

1. **Untouched slides count as zero, they are not skipped.** A chapter with 10 slides where the
   learner perfectly finished 3 sits at 30%, not 100%.
2. **Finishing one chapter out of twenty moves the course number by about 5%, not to 100%.** This is
   the single most common "progress is broken" support ticket, and it is correct behaviour.

---

## 2. "What do I have to do to complete this slide?" — the cheat sheet

This is the table to hand a support agent. "Complete" here means the slide reaches **100%**.

| Slide type (what the admin adds) | What the learner must actually do to hit 100% | Roughly how long |
|---|---|---|
| **PDF document** | View **every page** of the PDF, spending **at least 10 seconds** on each. Pages flicked past faster than 10s do not count. | Depends on page count |
| **Word / rich-text document** (Lexical or legacy Yoopta) | Simply **stay on the slide for about 60 seconds** with the tab focused. There is only ever "one page", so a single recorded view = 100%. | ~60 seconds |
| **PPT presentation (converted)** | Same as PDF — view each converted page for 10s+. | Depends on slide count |
| **Video (uploaded file)** | Watch enough **distinct** footage to cover the video's full length. Re-watching the same part does **not** count twice. | The video's length |
| **Video (YouTube / Vimeo / Drive)** | Same as above. | The video's length |
| **Audio** | Listen to the full distinct length, same rule as video. | The audio's length |
| **Question** | **Submit an answer.** Right or wrong is irrelevant — submitting is completion. | Instant |
| **Quiz** | **Attempt every question** in the quiz. Score is irrelevant; the percentage is *questions attempted ÷ total questions*. | Instant per question |
| **Assignment** | **Submit** (upload the file / press submit). Grade is irrelevant. | Instant |
| **Assessment** | **Submit the assessment.** Marks are irrelevant to progress — they live in the assessment service. | Instant |
| **SCORM package** | Whatever the SCORM package itself reports. If it declares *completed* or *passed*, it is forced to 100%. | Package-defined |
| **Code Editor — Practice mode** | **Type one character.** The first edit immediately flushes 100%. | Instant |
| **Code Editor — Question mode** | **Submit once.** Passing the test cases is *not* required. | Instant |
| **Jupyter notebook** | Perform a few distinct *actions* (run a cell, edit, etc.), each held 5s+. In practice one action ≈ 100%. | ~seconds |
| **Scratch project** | Same as Jupyter — distinct actions held 5s+. | ~seconds |
| **Video with embedded questions** | ⚠️ **Nothing works.** This type is tracked but never counted. See [§13](#13-known-bugs-gaps-and-sharp-edges). | — |
| **Presentation (Excalidraw)** | ⚠️ **Nothing works.** Tracking never leaves the device. Permanently 0%. See [§13](#13-known-bugs-gaps-and-sharp-edges). | — |

> **The green tick is not 100%.** The learner UI shows a slide as "done" at **80%**
> (`SLIDE_COMPLETION_THRESHOLD`), but the chapter average uses the *raw* percentage. So a chapter can
> show every slide ticked green and still read 94%. This is expected, not a bug.

---

## 3. Five things that surprise everyone

**1. Averages, not weights.** A chapter of one 3-hour video and one 10-second question slide is 50%
when the question is answered. Course structure, not content length, drives the number.

**2. Nothing is retroactive.** The percentages are *stored*, not calculated when you look at them.
They are only rewritten when the learner does something new. If a stored value went wrong, it stays
wrong until that learner triggers fresh activity in that exact chapter — or someone runs a backfill.

**3. Slide progress can never go down; chapter/course progress can.** A learner re-reading a PDF
cannot lose per-slide progress. But if an admin *adds* slides to a chapter, the chapter and course
percentages legitimately **drop**, because the denominator grew.

**4. The app tells the server which course the activity belongs to.** If the learner's device sends
the wrong batch (or none), the course percentage silently keeps its old value. This is the number one
cause of "my chapter is complete but the course won't move".

**5. A slide the learner never opens is not neutral — it is a zero.** There is no "not started" state
in the maths.

---

# Part 2 — The Engineering Detail

## 4. The course hierarchy

A course is 3–5 levels deep depending on how the institute configures it. The full chain:

```
Package (the course)
└── Package Session  ─── "batch"/"level+session" — this is what a learner actually enrols in
    └── Subject          via subject_session
        └── Module       via subject_module_mapping
            └── Chapter  via module_chapter_mapping (+ chapter_package_session_mapping)
                └── Slide via chapter_to_slides
```

| Level | Progress is keyed on | Join table used by the roll-up |
|---|---|---|
| Course | `package_session.id` | `subject_session` (`session_id` → `subject_id`) |
| Subject | `subject.id` | `subject_module_mapping` |
| Module | `module.id` | `module_chapter_mapping` + `chapter_package_session_mapping` |
| Chapter | `chapter.id` | `chapter_to_slides` |
| Slide | `slide.id` | — |

> **Naming trap:** in the learner app's route search params, `sessionId` **is** the
> `packageSessionId`. Same value, two names.

Shallower courses (3 levels) still traverse the same chain — they simply have a single subject or a
single module acting as a pass-through.

---

## 5. Where progress is stored

Everything lives in **one table**: `admin_core_service.learner_operation`.

```sql
CREATE TABLE public.learner_operation (
    id          varchar(255) PRIMARY KEY,
    user_id     varchar(255),
    source      varchar(255),   -- SLIDE | CHAPTER | MODULE | SUBJECT | PACKAGE_SESSION
    source_id   varchar(255),   -- the id of that slide / chapter / module / ...
    operation   varchar(255),   -- which metric (see below)
    value       varchar(255),   -- ⚠️ the percentage, stored as TEXT
    created_at  timestamp,
    updated_at  timestamp
);
```

Defined at [LearnerOperation.java](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/learner_operation/entity/LearnerOperation.java),
DDL in [V1__Initial_schema.sql:423](../admin_core_service/src/main/resources/db/migration/V1__Initial_schema.sql#L423).

### The `operation` values

[`LearnerOperationEnum`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/learner_operation/enums/LearnerOperationEnum.java)
holds 18 values. They fall into three groups:

**Progress percentages (these are what roll up):**

| Operation | Written for | Level |
|---|---|---|
| `PERCENTAGE_DOCUMENT_COMPLETED` | DOCUMENT slides (incl. Code/Jupyter/Scratch) | SLIDE |
| `PERCENTAGE_VIDEO_WATCHED` | VIDEO **and** HTML_VIDEO slides | SLIDE |
| `PERCENTAGE_AUDIO_LISTENED` | AUDIO slides | SLIDE |
| `PERCENTAGE_QUESTION_COMPLETED` | QUESTION slides | SLIDE |
| `PERCENTAGE_QUIZ_COMPLETED` | QUIZ slides | SLIDE |
| `PERCENTAGE_ASSIGNMENT_COMPLETED` | ASSIGNMENT slides | SLIDE |
| `PERCENTAGE_ASSESSMENT_DONE` | ASSESSMENT slides | SLIDE |
| `PERCENTAGE_SCORM_COMPLETED` | SCORM slides | SLIDE |
| `PERCENTAGE_CHAPTER_COMPLETED` | every chapter | CHAPTER |
| `PERCENTAGE_MODULE_COMPLETED` | every module | MODULE |
| `PERCENTAGE_SUBJECT_COMPLETED` | every subject | SUBJECT |
| `PERCENTAGE_PACKAGE_SESSION_COMPLETED` | the course | PACKAGE_SESSION |

**Bookmarks / resume state (not progress, never rolled up):**

| Operation | Meaning |
|---|---|
| `DOCUMENT_LAST_PAGE` | highest page number the learner reached |
| `VIDEO_LAST_TIMESTAMP` | resume position (ms) |
| `AUDIO_LAST_TIMESTAMP` | resume position (ms) |
| `LAST_SLIDE_VIEWED` | written at CHAPTER level — the slide to resume on |

**Dead values — declared but never written or read anywhere in the codebase:**
`MARKED_AS_WATCHED`, `MARKED_FOR_REVIEW`. There is **no manual "mark as complete"** feature; the
enum values for it exist but nothing implements them.

### Two storage facts that bite

- **`value` is text.** Every consuming query casts it, and guards with a regex
  `lo.value ~ '^-?\d+(\.\d+)?$'` so non-numeric junk (e.g. the literal string `"null"`) doesn't blow
  up the cast. `getPercentageDocumentWatched`-style writers can and do produce `"null"` strings.
- **`updated_at` is never written.** The entity maps both timestamps
  `insertable = false, updatable = false` and there is no DB trigger, so `updated_at` is effectively
  `created_at`. **Do not use it to judge freshness.** Compare the stored value against a recompute
  instead.

---

## 6. The write path — from click to stored percentage

```
Learner reads a page / watches / submits
        │
        ▼
Frontend POSTs an activity payload
   ├─ /admin-core-service/learner-tracking/v1/add-or-update-document-activity
   ├─ /admin-core-service/learner-tracking/v1/add-or-update-video-activity
   ├─ /admin-core-service/learner-tracking/v1/add-or-update-html-video-activity
   ├─ /admin-core-service/learner-tracking/v1/add-or-update-audio-activity
   ├─ /admin-core-service/activity-log/{question|quiz|assignment|assessment}-slide/...
   ├─ /admin-core-service/slide/scorm-tracking/v1/{slideId}/commit
   └─ /admin-core-service/coding/submissions        (Code Editor question mode)
        │
        ▼  SYNCHRONOUS  — LearnerTrackingService
   1. upsert the activity_log row              (one row per slide-open session)
   2. upsert the breadcrumb rows               (document_tracked / video_tracked / audio_tracked / …)
   3. recompute engaged_ms from breadcrumbs    (merged union, capped at 24h)
   4. write concentration_score
        │
        ▼  @Async, fixed thread pool of 10 — LearnerTrackingAsyncService
   5. recompute THIS SLIDE's percentage → learner_operation (SLIDE)
   6. updateLearnerOperationsForChapter(...)
        ├─ chapter %   = avg of its slides       → learner_operation (CHAPTER)
        ├─ module %    = avg of its chapters     → learner_operation (MODULE)
        ├─ subject %   = avg of its modules      → learner_operation (SUBJECT)
        └─ course %    = avg of its subjects     → learner_operation (PACKAGE_SESSION)
```

Files:
[`LearnerTrackingService`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/learner_tracking/service/LearnerTrackingService.java) (steps 1–4),
[`LearnerTrackingAsyncService`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/learner_tracking/service/LearnerTrackingAsyncService.java) (steps 5–6),
[`ActivityLogRepository`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/learner_tracking/repository/ActivityLogRepository.java) (all the SQL).

### The tables involved

| Table | Grain | Purpose |
|---|---|---|
| `activity_log` | one row per slide-open session | `user_id`, `slide_id`, `start_time`, `end_time`, `percentage_watched`, `engaged_ms` |
| `document_tracked` | many per activity | one row per page view: `{start, end, page_number}` |
| `video_tracked` | many per activity | one row per watched segment: `{start, end}` as playback offsets |
| `audio_tracked` | many per activity | same as video |
| `question_slide_tracked` / `quiz_slide_question_tracked` / `assignment_slide_tracked` / `assessment_slide_tracked` / `video_slide_question_tracked` | many per activity | the learner's actual responses |
| `scorm_learner_progress` | one row per user × slide × attempt | SCORM CMI data model (lives under `slide/`, **not** `learner_tracking/`) |
| `coding_submission` | one row per submission | Code Editor question mode |
| `concentration_score` | one per activity | tab switches, pauses, answer times |

### The cascade is client-driven — the single biggest fragility

`chapterId`, `moduleId`, `subjectId` and `packageSessionId` **all arrive as request parameters from
the client.** They are not derived server-side from the slide. If one is missing or wrong:

- the corresponding SQL matches nothing,
- returns `null`,
- `addOrUpdatePercentageOperation` silently returns without writing,
- and the previous value stays in place.

In the data this is **indistinguishable from "nothing happened"**. Since PR #2361 the misses are at
least logged loudly ([LearnerTrackingAsyncService.java:467-488](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/learner_tracking/service/LearnerTrackingAsyncService.java#L467-L488)):

```java
log.warn("Progress rollup for user {} is missing ids (chapterId={}, moduleId={}, "
       + "subjectId={}, packageSessionId={}). Levels without an id keep their "
       + "previous percentage.", ...);
```

A missing `chapterId` no longer aborts the whole cascade — module/subject/course still roll up from
whatever ids *were* supplied.

**Client-side rule:** never resolve the batch from the login cache. `getPackageSessionId()` reads a
single `package_session_id` cached in device Preferences at login; a multi-batch learner studying any
other course sends the wrong one. Use `useResolvedPackageSessionId` (route → content store → cache).

---

## 7. Slide-level completion, type by type

The backend has **10** slide types
([`SlideTypeEnum`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/slide/enums/SlideTypeEnum.java)):
`VIDEO, DOCUMENT, QUESTION, ASSIGNMENT, VIDEO_QUESTION, QUIZ, HTML_VIDEO, SCORM, AUDIO, ASSESSMENT`.

The admin "Add Slide" menu shows roughly **15** options. The extra ones are all
`source_type = DOCUMENT` with a different `document_slide.type` sub-discriminator. That is why
Jupyter, Scratch, Code Editor and Excalidraw all behave like documents.

### 7.1 Master table

| Admin UI type | `source_type` | `document_slide.type` | Operation written | Completion formula | In cascade? |
|---|---|---|---|---|---|
| PDF | `DOCUMENT` | `PDF` | `PERCENTAGE_DOCUMENT_COMPLETED` | distinct pages ÷ `published_document_total_pages` | ✅ |
| Word doc (Lexical / Yoopta) | `DOCUMENT` | `DOC` | `PERCENTAGE_DOCUMENT_COMPLETED` | same; denominator is **1** | ✅ |
| Rich text (Tiptap) | `DOCUMENT` | `HTML` | `PERCENTAGE_DOCUMENT_COMPLETED` | same; denominator is **1** | ✅ |
| PPT (converted) | `DOCUMENT` | `PPT_ANIM` | `PERCENTAGE_DOCUMENT_COMPLETED` | same | ✅ |
| Jupyter notebook | `DOCUMENT` | (Jupyter payload) | `PERCENTAGE_DOCUMENT_COMPLETED` | distinct *actions* ÷ 1 | ✅ |
| Scratch project | `DOCUMENT` | (Scratch payload) | `PERCENTAGE_DOCUMENT_COMPLETED` | distinct *actions* ÷ 1 | ✅ |
| Code Editor (practice) | `DOCUMENT` | `CODE` | `PERCENTAGE_DOCUMENT_COMPLETED` | first edit force-flushes → 100 | ✅ |
| Code Editor (question) | `DOCUMENT` | `CODE` + `mode:"question"` | `PERCENTAGE_DOCUMENT_COMPLETED` | any submission → **hardcoded 100** | ✅ |
| Excalidraw presentation | `DOCUMENT` | (Excalidraw JSON) | — **never written** | n/a — always 0 | ✅ *(in denominator only)* |
| Video upload | `VIDEO` | — | `PERCENTAGE_VIDEO_WATCHED` | merged watched ms ÷ `published_video_length` | ✅ |
| YouTube / Vimeo / Drive | `HTML_VIDEO` | — | `PERCENTAGE_VIDEO_WATCHED` | merged watched ms ÷ `video_length` | ✅ |
| Audio | `AUDIO` | — | `PERCENTAGE_AUDIO_LISTENED` | merged listened ms ÷ `published_audio_length_in_millis` | ✅ |
| Question | `QUESTION` | — | `PERCENTAGE_QUESTION_COMPLETED` | **hardcoded 100** on submit | ✅ |
| Quiz | `QUIZ` | — | `PERCENTAGE_QUIZ_COMPLETED` | attempted questions ÷ total questions | ✅ |
| Assignment | `ASSIGNMENT` | — | `PERCENTAGE_ASSIGNMENT_COMPLETED` | **hardcoded 100** on submit | ✅ |
| Assessment | `ASSESSMENT` | — | `PERCENTAGE_ASSESSMENT_DONE` | **hardcoded 100** on submit | ✅ |
| SCORM | `SCORM` | — | `PERCENTAGE_SCORM_COMPLETED` | SCORM CMI precedence (below) | ✅ |
| Video + questions | `VIDEO_QUESTION` | — | — **never written** | n/a | ❌ **excluded** |

### 7.2 Video and audio — the "distinct seconds" model

Both use the same merge, [`getUniqueWatchedDurationMillis`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/learner_tracking/service/LearnerTrackingAsyncService.java#L379):
segments are sorted by start, overlapping segments are unioned, and the merged durations summed.

```
percentage = (merged distinct watched ms × 100) ÷ published length ms
```

Watching 0:00–5:00 twice yields 5 minutes, not 10. If the published length is `null` or `0`, the
percentage comes out `null` and **no write happens at all** — the slide keeps its previous value.
This is the usual reason a video slide is stuck at 0%: the video was published without a length.

### 7.3 Quiz — the only genuinely graded-looking formula

[`getQuizSlideCompletionPercentage`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/learner_tracking/repository/ActivityLogRepository.java#L80):

```sql
ROUND(100.0 * attempted_questions / total_questions, 2)
```

`attempted_questions` counts `DISTINCT question_id` in `quiz_slide_question_tracked` for that
learner + slide; `total_questions` counts `quiz_slide_question` rows with an ACTIVE status.
**Correctness is not consulted.** A learner who answers every question wrong gets 100%.

### 7.4 SCORM — spec-driven precedence

[`ScormTrackingService.computeScormCompletionPercentage`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/slide/service/ScormTrackingService.java):

1. **Safety lock first** — if `completion_status` is `completed` or `passed` → **100%**, full stop.
2. `cmi.progress_measure` (0.0–1.0) × 100
3. `cmi.score.scaled` (0.0–1.0) × 100
4. `cmi.score.raw / cmi.score.max` × 100
5. Otherwise → `null`, and the cascade is **skipped** rather than writing 0.

SCORM commits fire on every `LMSCommit`/`LMSFinish` (1.2) or `Commit`/`Terminate` (2004). If the
package omits any of the four cascade ids, the commit still persists but the roll-up is skipped —
logged at WARN.

### 7.5 The "hardcoded 100" family

QUESTION, ASSIGNMENT, ASSESSMENT and Code-Editor-question-mode all write a literal `100.0`. There is
no partial credit, and **grading never feeds progress**. Marks live in `assessment_service` /
`coding_submission` and are irrelevant to every percentage in this document.

The frontend for these types also sends a **hardcoded one-minute window**
(`start_time_in_millis: Date.now() - 60000`) — see [§13](#13-known-bugs-gaps-and-sharp-edges).

---

## 8. Document slides in depth

Document slides are the most-used type and have the most surprising behaviour, so they get their own
section.

### 8.1 The formula

[`getPercentageDocumentWatched`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/learner_tracking/repository/ActivityLogRepository.java#L127):

```sql
SELECT COALESCE(
  (COUNT(DISTINCT dt.page_number) * 100.0
   / NULLIF(MAX(ds.published_document_total_pages), 0)), 0) AS percentage_watched
FROM slide s
JOIN document_slide ds ON s.source_id = ds.id
JOIN activity_log al   ON s.id = al.slide_id
LEFT JOIN document_tracked dt ON al.id = dt.activity_id
WHERE al.user_id = :userId AND s.id = :slideId
GROUP BY s.id, al.user_id, ds.id
```

**Numerator:** count of *distinct page numbers* the learner has a tracked view for — across **all**
their activities on that slide, so progress accumulates across sessions.
**Denominator:** `published_document_total_pages`, frozen at publish time.

### 8.2 The denominator is 1 for everything except PDFs

This is the fact that explains most document-slide behaviour. When the admin app creates or publishes
a non-PDF document slide it sends `published_document_total_pages: 1`
([slide-material.tsx](../frontend-admin-dashboard/src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/slide-material.tsx),
[create-presentation-slide.ts](../frontend-admin-dashboard/src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/create-presentation-slide.ts)).
Only PDFs carry a real page count, set from the rendered document.

**Therefore: for a Word/rich-text/Jupyter/Scratch/Code slide, one recorded page view = 100%.**

### 8.3 What counts as a "page view"

A page view is only recorded when the learner **leaves** a page having spent enough time on it:

| Viewer | Minimum dwell | Source |
|---|---|---|
| PDF viewer | **10 seconds** | [pdf-viewer.tsx:556](../frontend-learner-dashboard-app/src/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/pdf-viewer.tsx#L556) |
| Doc viewer | **10 seconds** | [doc-viewer.tsx:518](../frontend-learner-dashboard-app/src/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/doc-viewer.tsx#L518) |
| Jupyter / Scratch / Code | **5 seconds** per distinct *action* | [jupyter-notebook-slide.tsx:384](../frontend-learner-dashboard-app/src/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/jupyter-notebook-slide.tsx#L384) |

Plus one synthetic view: at sync time,
[`calculateAndUpdatePageViews`](../frontend-learner-dashboard-app/src/utils/study-library/tracking/calculateAndUpdatePageViews.ts)
manufactures a page view for the page the learner is *currently* on, covering the elapsed time not
already attributed to a recorded view. This is what lets a single-page document ever reach 100%
without the learner navigating anywhere.

### 8.4 The sync loop

[`usePDFSync`](../frontend-learner-dashboard-app/src/hooks/study-library/usePdfSync.ts):

- First sync fires on document load; then **every 60 seconds**.
- A payload is only POSTed when `page_views.length >= 1 && new_activity` — so the very first sync
  (0 elapsed seconds, no views) is a no-op.
- The viewer re-registers the activity on every 1-second tick with `sync_status: "STALE"` and
  `new_activity: true`, so each 60s sync re-POSTs the **full accumulated** page-view list under the
  same `activity_id`; the backend upserts.
- A module-level `inFlight` set prevents two concurrent callers double-POSTing the same activity
  (which previously surfaced as a 511 `StaleStateException`).
- After a successful sync it calls `refreshSlides()` so the sidebar percentage updates.

**Net effect for a plain rich-text document: roughly 60 seconds of focused dwell → 100%.**

### 8.5 Idle and tab handling

- Mouse/key/touch/scroll activity resets an idle timer; **5 minutes** of inactivity pauses the timer.
- After **60 seconds** of inactivity the viewer pops a "are you still there?" numeric verification
  challenge; missing it increments `pause_count` and pauses.
- `visibilitychange` to hidden increments `tab_switch_count` and pauses; returning does **not**
  auto-resume — it waits for real interaction.

### 8.6 Yoopta → Lexical (shipped)

Both editors persist **`document_slide.type = 'DOC'` with an HTML payload**. The only discriminator
is a `data-editor="lexical"` attribute on a wrapper `<div>` inside the stored HTML
([lexical-doc-marker.ts](../frontend-admin-dashboard/src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/lexical-editor/lexical-doc-marker.ts)):

```ts
export const LEXICAL_MARKER_REGEX = /data-editor\s*=\s*["']lexical["']/i;
export const EMPTY_LEXICAL_INNER = '<div data-editor="lexical"><p></p></div>';
```

- Docs **with** the marker open in Lexical. Docs **without** it keep opening in the deprecated,
  frozen Yoopta editor.
- Conversion of an existing Yoopta doc is **opt-in and one-way**, via
  [`convert-yoopta.ts`](../frontend-admin-dashboard/src/routes/study-library/courses/course-details/subjects/modules/chapters/slides/-components/lexical-editor/convert-yoopta.ts)
  + `ConvertToLexicalDialog`. A pre-flight runs the HTML through the Lexical round-trip and reports
  any content the conversion would drop; the author confirms (or is blocked on hard loss). Nothing
  is converted silently in the background.
- Newly **uploaded** documents (docx→HTML, incl. bulk Quick Add) are stored marker-bearing — i.e.
  land straight in Lexical — when the round-trip is lossless, otherwise they stay Yoopta (#2371).
- Detection deliberately checks *all* content sources (local draft, `data`, `published_data`),
  because a brand-new Lexical doc's marker-only body reads as "empty" and precedence-based detection
  would misroute it into Yoopta, whose first save would erase the marker permanently.
- A separate `DocumentTypeEnum.HTML` value exists for Tiptap-authored rich text — same HTML storage,
  no Yoopta block markers.

**Impact on progress tracking: none.** Both editors produce a `DOC` slide with
`published_document_total_pages = 1`, tracked by the same doc-viewer with the same 10-second /
60-second rules. The editor migration changes authoring only.

---

## 9. The roll-up — chapter, module, subject, course

All four queries live in
[`ActivityLogRepository`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/learner_tracking/repository/ActivityLogRepository.java)
and are driven from `updateLearnerOperationsForChapter`.

### 9.1 Chapter = average of its slides

```sql
SELECT COALESCE(SUM(CAST(lo.value AS FLOAT)), 0)
       / NULLIF(COUNT(DISTINCT cs.slide_id), 0) AS percentage_completed
FROM chapter_to_slides cs
JOIN slide s ON cs.slide_id = s.id
LEFT JOIN learner_operation lo
       ON lo.source_id = cs.slide_id
      AND lo.operation IN (:learnerOperation)
      AND lo.user_id   = :userId
      AND lo.value ~ '^-?\d+(\.\d+)?$'
WHERE cs.status IN (:statusList)
  AND cs.chapter_id = :chapterId
  AND s.source_type IN (:sourceTypeList)
```

The three parameter lists are hardcoded at
[LearnerTrackingAsyncService.java:494-513](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/learner_tracking/service/LearnerTrackingAsyncService.java#L494-L513):

- **`learnerOperation`** — 8 operations: `PERCENTAGE_VIDEO_WATCHED`, `PERCENTAGE_DOCUMENT_COMPLETED`,
  `PERCENTAGE_ASSIGNMENT_COMPLETED`, `PERCENTAGE_QUESTION_COMPLETED`, `PERCENTAGE_QUIZ_COMPLETED`,
  `PERCENTAGE_AUDIO_LISTENED`, `PERCENTAGE_SCORM_COMPLETED`, `PERCENTAGE_ASSESSMENT_DONE`.
- **`statusList`** — `PUBLISHED`, `UNSYNC`.
- **`sourceTypeList`** — 9 types: `VIDEO, DOCUMENT, ASSIGNMENT, QUESTION, QUIZ, HTML_VIDEO, AUDIO,
  SCORM, ASSESSMENT`. (8 operations cover 9 types because VIDEO and HTML_VIDEO share
  `PERCENTAGE_VIDEO_WATCHED`.)

Three behaviours fall out:

1. **A slide whose `source_type` is in the list but has no `learner_operation` row contributes 0 to
   the numerator while still counting in the denominator.** Untouched slides drag the average down —
   this is the intended design.
2. **A slide whose `source_type` is *not* in the list is dropped from both numerator and
   denominator.** Today that is only `VIDEO_QUESTION`.
3. **The status filter is on `chapter_to_slides.status`, not `slide.status`.** `SlideService` keeps
   the two in sync (both are set together on publish and on soft-delete), so in practice DRAFT /
   DELETED / PENDING_APPROVAL slides are correctly excluded — but the query never reads `s.status`.

Alongside the percentage, the chapter write also refreshes `LAST_SLIDE_VIEWED`.

### 9.2 Module = average of its chapters

```sql
SELECT COALESCE(SUM(lo_val.chapter_value), 0) / NULLIF(COUNT(*), 0)
FROM (
    SELECT DISTINCT mcm.chapter_id
    FROM module_chapter_mapping mcm
    JOIN chapter c ON c.id = mcm.chapter_id
    JOIN chapter_package_session_mapping cpm ON cpm.chapter_id = c.id
    WHERE mcm.module_id = :moduleId
      AND cpm.status IN (:chapterStatusList)
      AND c.status   IN (:chapterStatusList)
) distinct_chapters
LEFT JOIN (
    SELECT DISTINCT ON (lo.source_id) lo.source_id, CAST(lo.value AS FLOAT) AS chapter_value
    FROM learner_operation lo
    WHERE lo.operation IN (:learnerOperation) AND lo.user_id = :userId
      ...
) lo_val ON ...
```

Reads `PERCENTAGE_CHAPTER_COMPLETED`; chapter status must be `ACTIVE` in **both** the chapter row and
its package-session mapping. The `DISTINCT ON (lo.source_id)` defends against duplicate
`learner_operation` rows (see [§13](#13-known-bugs-gaps-and-sharp-edges)) — the other three queries
have no such defence.

### 9.3 Subject = average of its modules

```sql
SELECT COALESCE(SUM(CAST(lo.value AS FLOAT)), 0) / NULLIF(COUNT(DISTINCT smm.module_id), 0)
FROM subject_module_mapping smm
JOIN modules m ON m.id = smm.module_id
LEFT JOIN learner_operation lo ON lo.source_id = m.id AND ...
WHERE smm.subject_id = :subjectId AND m.status IN (:moduleStatusList)
```

Reads `PERCENTAGE_MODULE_COMPLETED`, modules must be `ACTIVE`. Note this query is **not** scoped by
package session — every active module mapped to the subject counts.

### 9.4 Course = average of its subjects

```sql
SELECT COALESCE(SUM(CAST(lo.value AS FLOAT)), 0) / NULLIF(COUNT(DISTINCT sps.subject_id), 0)
FROM subject_session sps
JOIN subject s ON s.id = sps.subject_id
LEFT JOIN learner_operation lo ON lo.source_id = s.id AND ...
WHERE sps.session_id = :packageSessionId AND s.status IN (:subjectStatusList)
```

Reads `PERCENTAGE_SUBJECT_COMPLETED`, subjects must be `ACTIVE`. **This is the number on the learner's
home page and course card**, so a silent no-op here is the most visible failure in the system. It is
guarded twice: a blank `packageSessionId` and a `null` result are both logged at WARN and skipped.

### 9.5 Bulk recompute when content changes

`updateLearnerOperationsForBatch(source, ...)` re-runs the appropriate levels for **every** learner in
a package session (statuses `ACTIVE` + `INACTIVE`), used when an admin edits content:

| `source` | What it re-runs per learner |
|---|---|
| `SLIDE` | slide % → chapter → module → subject → course |
| `CHAPTER` | module + subject |
| `MODULE` | subject |
| `SUBJECT` | course |

An unknown source throws `IllegalArgumentException`.

---

## 10. The rules that govern every write

Every percentage write funnels through one private helper,
[`addOrUpdatePercentageOperation`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/learner_tracking/service/LearnerTrackingAsyncService.java#L699):

```java
if (value == null)  return;             // 1. null → write nothing, keep the old value
if (value > 100.0)  value = 100.0;      // 2. cap at 100

if (SLIDE.name().equals(source)) {      // 3. monotonic guard — SLIDE level ONLY
    Double existing = ...;
    if (existing != null && existing >= value) return;
}
learnerOperationService.addOrUpdateOperation(userId, source, sourceId, operation, String.valueOf(value));
```

**Rule 1 — `null` means "keep what's there".** Not "zero". A failed lookup, a missing id, a video with
no published length, a SCORM package that hasn't reported: all produce `null` and leave the stored
value untouched. This is why stale values persist invisibly.

**Rule 2 — hard cap at 100.** Needed because a document can exceed 100% when a learner's client
paginates differently than the publish-time page count.

**Rule 3 — the B9 monotonic guard, scoped to slides.** A slide percentage can never be lowered: a
learner re-opening a PDF or scrubbing back in a video must not lose progress. Roll-ups (CHAPTER,
MODULE, SUBJECT, PACKAGE_SESSION) deliberately **do not** get this guard — they are aggregates over
changing structure, and freezing them at a high-water mark would permanently diverge the displayed
course % from the actual chapter maths. The trade-off is that **content edits can legitimately lower
a learner's chapter/course percentage.**

**Not a rule, but a hazard:** `addOrUpdateOperation` is a read-then-write, not an atomic upsert, and
there is **no unique constraint** on `(user_id, source, source_id, operation)` — only a PK on `id`.
Under the 10-thread async pool, concurrent cascades for the same learner can lose updates or create
duplicate rows. See [§13](#13-known-bugs-gaps-and-sharp-edges).

---

## 11. The read path — who consumes these numbers

Stored percentages are joined back in at read time and surfaced as `percentage_completed`:

| Consumer | Where |
|---|---|
| Chapter sidebar (per-slide %) + `progress_marker` resume point | [`SlideRepository`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/slide/repository/SlideRepository.java) — big `json_build_object` projections |
| Modules-with-chapters (chapter + module %) | [`ModuleChapterMappingRepository`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/module/repository/ModuleChapterMappingRepository.java) |
| Learner module details | [`LearnerModuleDetailsService`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/module/service/LearnerModuleDetailsService.java) |
| Course card / home page % | course-init endpoints reading `PERCENTAGE_PACKAGE_SESSION_COMPLETED` |
| Certificate threshold gate | frontend-only check `percentageCompleted >= generationThresholdPercent` (default **80**) |
| Drip / prerequisite unlocking | `slide.drip_condition_json` + the slide-level percentage |
| Reports, parent portal, student analysis, LLM analytics | various — see `docs/STUDENT_REPORT_DATA_SOURCES.md` |

Read-path queries defend themselves:

```sql
'percentage_completed', CASE
    WHEN lo_video_percent.value IS NULL OR lo_video_percent.value = 'null' THEN NULL
    ELSE CAST(lo_video_percent.value AS double precision)
END
```

— because the literal string `'null'` does end up in `value`.

### Client-side refresh after a submit

The cascade is `@Async` and commits *after* the HTTP response, so a single refetch races it.
[`refreshProgressAfterSubmit`](../frontend-learner-dashboard-app/src/utils/study-library/tracking/refreshProgressAfterSubmit.ts)
invalidates the progress caches in waves — **500 ms** (awaited, includes per-slide) then **1500 ms**
and **3000 ms** in the background. It deliberately does not try to detect "the value changed", since a
genuine completion can legitimately leave a roll-up unchanged.

---

## 12. Corrections to earlier docs

Two existing docs describe this system and both are now **stale**. Believe this document.

| Claim in the older doc | Reality in current `main` |
|---|---|
| `SLIDES_AND_TRACKING_GUIDE.md`: "8 slide types" | **10** — AUDIO and ASSESSMENT were added |
| `SLIDES_AND_TRACKING_GUIDE.md`: 6-type cascade | **9** types / 8 operations |
| `CERTIFICATE_SYSTEM_AUDIT.md` §5: 7-type cascade `{VIDEO, DOCUMENT, ASSIGNMENT, QUESTION, QUIZ, HTML_VIDEO, AUDIO}` | **9** types — SCORM and ASSESSMENT added |
| `CERTIFICATE_SYSTEM_AUDIT.md` §13: "SCORM and ASSESSMENT are invisible to course %" | **Fixed.** Both are in the cascade and write their own operations |
| `CERTIFICATE_SYSTEM_AUDIT.md` §5: "Slide-status filter keeps DRAFT/DELETED out" | Directionally right, mechanically wrong — the filter is on `chapter_to_slides.status`; `slide.status` is never read by that query |
| `CERTIFICATE_SYSTEM_AUDIT.md` §13: "`VIDEO_QUESTION` is tracked but never aggregated" | ✅ **Still true** |
| `CERTIFICATE_SYSTEM_AUDIT.md` §2: Presentation slides block course completion | ✅ **Still true** |

---

## 13. Known bugs, gaps and sharp edges

Ordered by learner-visible impact.

### 🔴 B-P1 — Excalidraw presentation slides permanently cap their chapter
`presentation-tracking-store.syncActivities` only rewrites local Capacitor Preferences — it contains
**no network call at all**. The slide is `source_type = DOCUMENT`, so it sits in the chapter
denominator forever contributing 0. A chapter containing one presentation slide can never exceed
`(n−1)/n × 100%`, and a course gated on it can never complete.
*File:* [presentation-tracking-store.ts:90](../frontend-learner-dashboard-app/src/stores/study-library/presentation-tracking-store.ts#L90)

### 🔴 B-P2 — `VIDEO_QUESTION` is tracked but never aggregated
`VideoSlideQuestionTrackingService` writes `video_slide_question_tracked` rows and **never calls
`LearnerTrackingAsyncService`**. `VIDEO_QUESTION` is also absent from the cascade `sourceTypeList`, so
the slide is dropped from both numerator and denominator. Learner effort is recorded and then ignored.
*File:* [VideoSlideQuestionTrackingService.java](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/learner_tracking/service/VideoSlideQuestionTrackingService.java)

### 🟠 B-P3 — The prod backfill from PR #2361 has **not** been run
The code fix stops new drift, but a stored roll-up is only rewritten when fresh activity arrives with
the right ids. Learners already stranded on a wrong value stay wrong **forever** without the backfill.
The idempotent, audit-first script is at
[`docs/runbooks/learner-progress-rollup-backfill.sql`](runbooks/learner-progress-rollup-backfill.sql).
On a local prod-dump copy it corrected 3,091 chapter / 2,460 module / 1,830 subject / 691
package_session rows. It can *lower* inflated values — that is a product call. **Ask before running.**

### 🟠 B-P4 — Interactive slides record a hardcoded 1-minute duration
QUESTION, QUIZ, ASSIGNMENT all send `start_time_in_millis: Date.now() - 60000`. Real attempt time is
discarded. This doesn't affect *completion* (those are hardcoded 100%) but it corrupts every
time-based report and the leaderboard.
*Files:* `question-slide.tsx:210`, `quiz-viewer.tsx:403`, `assignment-slide.tsx:1011`

### 🟠 B-P5 — No unique constraint on `learner_operation`, and writes are read-then-write
`(user_id, source, source_id, operation)` has **no unique index** — only a PK on `id`. And
`addOrUpdateOperation` does `findBy…` then `save()`, non-atomically, under a 10-thread async pool.
Two concurrent cascades for the same learner can lose an update or insert a duplicate row. If a
duplicate exists, `findByUserIdAndSourceAndSourceIdAndOperation` (returning `Optional`) will throw a
`NonUniqueResultException`. Only the module query defends itself, via `DISTINCT ON (lo.source_id)`.

### 🟡 B-P6 — `updated_at` is never written
Mapped `insertable = false, updatable = false` with no DB trigger. Freshness cannot be judged from
the row. Compare against a recompute instead.

### 🟡 B-P7 — Document percentages can exceed 100 and are silently capped
Numerator is distinct tracked pages, denominator is the publish-time page count. A client that
paginates differently produces >100%, capped by rule 2. The inverse also happens: a document
re-published with more pages instantly *lowers* every learner's percentage.

### 🟡 B-P8 — Slide percentages orphaned by the old activity re-parenting bug are not repaired
The pdf-viewer used to read `slide_id` at flush time, re-parenting an entire `activity_log` row (and
its `document_tracked` pages) onto the next slide. The code is fixed
([LearnerTrackingService.saveActivityLog](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/learner_tracking/service/LearnerTrackingService.java#L123)
now refuses to re-parent), but historical damage is deliberately **not** repaired: recomputing would
lower real learners (a 14-page PDF read end-to-end recomputes to 50% because its pages sit on the
neighbouring slide). Needs a product decision — e.g. credit 100% where `DOCUMENT_LAST_PAGE` shows the
final page.

### 🟡 B-P9 — Assignment submissions trust a client-supplied `userId`
`AssignmentSlideActivityLogService#addOrUpdateAssignmentSlideSlideActivityLog` writes using the
`userId` from the request rather than the authenticated principal — a learner could submit as someone
else. Left alone because tightening it may break admin-on-behalf-of grading. Worth its own ticket.

### 🟡 B-P10 — `MARKED_AS_WATCHED` / `MARKED_FOR_REVIEW` are dead
Declared in the enum, never written, never read. There is **no** manual "mark this slide complete"
capability, despite the enum implying one.

### ⚪ B-P11 — Grading never affects progress anywhere
Deliberate, but frequently misunderstood by institutes: a learner who fails every quiz question, fails
every test case, and submits a blank assignment reaches 100% course completion. If an institute wants
mastery-gated progress, none of that exists today.

### ⚪ B-P12 — Subject roll-up is not package-session scoped
`getSubjectCompletionPercentage` averages every ACTIVE module mapped to the subject, with no package
session filter — unlike the chapter query, which *is* scoped via `chapter_package_session_mapping`.
For a subject shared across batches with differing module sets this is a latent inconsistency.

---

## 14. Debugging a stuck percentage

### Step 1 — Establish which level is actually stuck

```sql
SELECT source, operation, source_id, value, created_at
FROM learner_operation
WHERE user_id = :userId
  AND source_id IN (:slideId, :chapterId, :moduleId, :subjectId, :packageSessionId)
ORDER BY source;
```

- Slide rows present and correct, chapter row stale → the **cascade** didn't run or ran with bad ids.
- Slide rows missing entirely → the **write path** never reached the backend.
- Everything correct in the DB but wrong in the UI → **read path / client cache**.

### Step 2 — If the slide row is missing

Check, in order:

1. Is it a **presentation** or **video-question** slide? Then it is B-P1 / B-P2 — working as coded.
2. For **video/audio**: is `published_video_length` / `published_audio_length_in_millis` null or 0?
   Then the percentage computed `null` and nothing was written. Republish the slide.
3. For **documents**: are there `document_tracked` rows?
   ```sql
   SELECT dt.page_number, dt.start_time, dt.end_time
   FROM activity_log al JOIN document_tracked dt ON dt.activity_id = al.id
   WHERE al.user_id = :userId AND al.slide_id = :slideId;
   ```
   No rows → the learner never dwelled 10s on any page, or the sync never fired (they left within
   60 seconds).
4. For **SCORM**: check `scorm_learner_progress` — if the package reported nothing derivable, the
   cascade was skipped by design.

### Step 3 — If the slide is right but the roll-up is stale

This is the classic case. Search the service logs for:

```
Progress rollup for user <id> is missing ids
Skipping course-progress rollup for user <id>: no packageSessionId supplied
Course-progress rollup produced no value for user <id> / packageSession <id>
```

Any of these confirms the client sent bad or missing cascade ids. The usual culprits: a multi-batch
learner whose device resolved the batch from the login cache, or a submit path that doesn't forward
the four ids.

### Step 4 — Verify the maths by hand

Recompute the chapter the way the cascade would, and compare to the stored value:

```sql
SELECT COALESCE(SUM(CAST(lo.value AS FLOAT)), 0) / NULLIF(COUNT(DISTINCT cs.slide_id), 0)
FROM chapter_to_slides cs
JOIN slide s ON cs.slide_id = s.id
LEFT JOIN learner_operation lo
       ON lo.source_id = cs.slide_id
      AND lo.user_id = :userId
      AND lo.value ~ '^-?\d+(\.\d+)?$'
      AND lo.operation IN ('PERCENTAGE_VIDEO_WATCHED','PERCENTAGE_DOCUMENT_COMPLETED',
                           'PERCENTAGE_ASSIGNMENT_COMPLETED','PERCENTAGE_QUESTION_COMPLETED',
                           'PERCENTAGE_QUIZ_COMPLETED','PERCENTAGE_AUDIO_LISTENED',
                           'PERCENTAGE_SCORM_COMPLETED','PERCENTAGE_ASSESSMENT_DONE')
WHERE cs.chapter_id = :chapterId
  AND cs.status IN ('PUBLISHED','UNSYNC')
  AND s.source_type IN ('VIDEO','DOCUMENT','ASSIGNMENT','QUESTION','QUIZ',
                        'HTML_VIDEO','AUDIO','SCORM','ASSESSMENT');
```

Recompute ≠ stored → stale roll-up; the learner needs fresh activity in that chapter, or a backfill.
Recompute = stored but "feels wrong" → it's almost always the untouched-slides-count-as-zero rule.

### Step 5 — Check for duplicates before trusting anything

```sql
SELECT user_id, source, source_id, operation, COUNT(*)
FROM learner_operation
WHERE user_id = :userId
GROUP BY 1,2,3,4 HAVING COUNT(*) > 1;
```

Any rows here mean B-P5 has already bitten this learner.

---

## 15. Change history that shaped this system

| When | Change | Effect |
|---|---|---|
| 2026-05-08 | **B9 monotonic guard** added (`fix/b9-progress-cascade-keep-max`, `9ff22fa4f`) | slide progress stopped regressing on re-visit |
| 2026-05-09 | **B9 scoped to slides only** (`fix/progress-tracking-staleness`, `9d66e3d06`) | roll-ups unfroze and can now legitimately drop when content changes |
| 2026-05-12 | **Code Editor wired into the cascade** (`fix/code-editor-progress-tracking`, `3a8537126`) | both practice and question mode now contribute to chapter completion |
| 2026-05-27 | **SCORM wired into the cascade** (`fix/scorm-progress-cascade`, `0ad3b6310`, PRs #1801/#1803) | fixed "B1" — SCORM completion was previously invisible to every roll-up |
| 2026-07-14 | **Assessment slides added** (`71ef13351`) | submission marks the slide 100% and unlocks drip conditions |
| 2026-07-27 | **Course-progress roll-up fix**, PR #2361 (`fix/learner-course-progress-rollup`, merged `13dcdef08`) | batch resolved from the course being studied instead of the login cache; assignment submit now sends all four cascade ids; activity logs stay bound to the slide they were opened on; ownership verified before merging a client-supplied activity id; missing ids logged instead of silently dropped; typed exceptions replace generic 510s |

### Related documents

- [`runbooks/learner-progress-rollup-backfill.sql`](runbooks/learner-progress-rollup-backfill.sql) — audit + idempotent repair for stale roll-ups
- [`../admin_core_service/.../slide/SLIDES_AND_TRACKING_GUIDE.md`](../admin_core_service/src/main/java/vacademy/io/admin_core_service/features/slide/SLIDES_AND_TRACKING_GUIDE.md) — slide system reference (**stale** on type/cascade counts, see §12)
- [`CERTIFICATE_SYSTEM_AUDIT.md`](CERTIFICATE_SYSTEM_AUDIT.md) — how the certificate threshold consumes course % (**stale** on cascade membership, see §12)
- [`STUDENT_REPORT_DATA_SOURCES.md`](STUDENT_REPORT_DATA_SOURCES.md) — reporting consumers
