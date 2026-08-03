# Bulk Assessment Report Export (ZIP) — Backend Implementation Plan

**Status:** Planned (not implemented)
**Service:** `assessment_service`
**Written:** 2026-08-01
**Architecture blueprint:** `docs/ASSESSMENT_BULK_REPORT_EXPORT_ARCHITECTURE.md` — where this doc
and the blueprint disagree, the blueprint's §0 corrections win (they were verified against source
after this plan was written).

---

## 1. Goal

An admin selects submissions in Assessment Details → Submissions, and receives a single ZIP
containing one branded comparison report PDF per student plus an `index.csv` manifest, delivered
as a persistent download link.

**Delivery workflow this serves:** admin exports → hands the ZIP/CSV to the school → school
distributes individual reports to students.

**Target scale:** 20–300 submissions per export.

**In scope:** the standard branded student report (the one produced at result-release time).
**Out of scope:** the AI report (`/learner/report/ai-pdf`) — it is JWT-owner-scoped and depends on
`processed_json` from admin_core that may not exist per student.

---

## 2. Constraints discovered in the existing code

These are the facts that drive the design. Each was verified against source.

| # | Constraint | Location | Consequence |
|---|---|---|---|
| C1 | `spring.datasource.hikari.maximum-pool-size=5` | `application.properties:14` | No meaningful parallelism. Efficiency must come from doing less work. |
| C2 | `@EnableAsync` with no `TaskExecutor` bean → `SimpleAsyncTaskExecutor` (unbounded threads) | `AssessmentServiceApplication:18` | Must declare a **named** bounded executor. A default `taskExecutor` bean would silently change every existing `@Async`. |
| C3 | `getMappingById` is called **once per question per student**, uncached | `AssessmentParticipantsManager:870` | N+1. ~50 redundant queries per student on a 50-question assessment. The mappings are already bulk-loaded at `:801`. |
| C4 | `findParticipantsQuestionOverallDetails` and `findByAssessmentIdAndStatusNotIn` each run **twice** per student | `AssessmentParticipantsManager:795-810` + `LearnerReportService:216,238` | Straight duplicates across the two report builders. |
| C5 | 5 of 7 queries in `buildComparisonData` are assessment-wide but the cache key is per-attempt | `LearnerReportService:207` | Class-level aggregates recomputed for every student. |
| C6 | `QuestionWiseMarks` has 4 bare `@ManyToOne` (EAGER by default); `Question.textData` is a bare `@OneToOne` | `QuestionWiseMarks:30,35,40,57`, `Question:72` | Each of the C3 round trips drags `Question` + question HTML with it. |
| C7 | Generated HTML contains `@import url('https://fonts.googleapis.com/...')`, and `ConverterProperties` is constructed fresh per conversion with no `FontProvider` | `HtmlBuilderService:456`; `LearnerReportService:338`, `AdminExportManager`, `AssessmentParticipantsManager:1121` | Potentially one external network fetch **per render**. Unmeasured; may dominate wall-clock. |
| C8 | Auto-release sets `report_release_status` but never generates PDFs | `StudentAttemptService:169, 72` | Cannot gate on release status. Cold rendering is the common case. |
| C9 | Release loop accumulates every PDF in `Map<StudentAttempt, byte[]>` | `AssessmentParticipantsManager:1090` | Latent OOM at scale. Do not copy this pattern. |
| C10 | `getPublicUrlForFileId` hardcodes `expiryDays=1` | `FileService:62` | Store `file_id`, resolve the URL per request. |
| C11 | `@CacheEvict(value="comparisonData", allEntries=true)` fires on every attempt update | `StudentAttemptService:87,93,98` | The Spring cache is unusable as job state — any submission mid-job wipes it. |

---

## 3. Delivery phases

| PR | Content | Risk | Value if shipped alone |
|---|---|---|---|
| **PR1** | Fix the C3 N+1 in `buildStudentReportReview` | Low | Speeds up every report path: learner PDF, admin per-student download, release flow |
| **PR2** | `ReportClassContext` + hoist (C4, C5); extract `ReportPdfRenderService`; rewire release flow (fixes C9) | **High** — 5 callers depend on `buildComparisonData` | Speeds up + de-risks the release flow |
| **PR3** | Render-layer optimisation: shared `ConverterProperties` + `FontProvider`, prebuilt CSS (C7) | Medium | Cuts the dominant per-render cost |
| **PR4** | Job tables, worker, batch processor, APIs | Low (all new surface) | The feature |

PR1 and PR3 are worth shipping regardless of whether the ZIP feature lands.

**Measure before PR3:** time one `HtmlConverter.convertToPdf` call with and without network egress.
This single number determines the batch size, the cap, and the UX copy. Everything in §10 is an
estimate until it exists.

---

## 4. Database

### 4.1 Migration `V34__assessment_report_export.sql`

Latest existing migration is `V33`. Both tables in one file so it applies atomically.

```sql
CREATE TABLE assessment_report_export_job (
    id                  VARCHAR(36)  PRIMARY KEY,
    assessment_id       VARCHAR(36)  NOT NULL,
    institute_id        VARCHAR(36)  NOT NULL,
    created_by_user_id  VARCHAR(36)  NOT NULL,
    status              VARCHAR(20)  NOT NULL,
    total_count         INT          NOT NULL DEFAULT 0,
    completed_count     INT          NOT NULL DEFAULT 0,
    failed_count        INT          NOT NULL DEFAULT 0,
    skipped_count       INT          NOT NULL DEFAULT 0,
    regenerate          BOOLEAN      NOT NULL DEFAULT FALSE,
    output_file_id      VARCHAR(36),
    output_file_name    VARCHAR(255),
    output_size_bytes   BIGINT,
    request_json        TEXT,
    context_snapshot    TEXT,        -- serialised ReportClassContext; see §6.3
    superseded_file_ids TEXT,        -- comma-separated orphaned ZIP file ids; see §6.5
    resume_count        INT          NOT NULL DEFAULT 0,
    error_message       TEXT,
    started_at          TIMESTAMP,
    completed_at        TIMESTAMP,
    created_at          TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX idx_arej_recent
    ON assessment_report_export_job (assessment_id, institute_id, created_at DESC);

CREATE INDEX idx_arej_inflight
    ON assessment_report_export_job (institute_id, status, updated_at)
    WHERE status IN ('PENDING', 'IN_PROGRESS');

CREATE TABLE assessment_report_export_item (
    id              VARCHAR(36) PRIMARY KEY,
    job_id          VARCHAR(36) NOT NULL
                    REFERENCES assessment_report_export_job (id) ON DELETE CASCADE,
    attempt_id      VARCHAR(36) NOT NULL,
    user_id         VARCHAR(36),
    student_name    VARCHAR(255),
    status          VARCHAR(20) NOT NULL,
    source          VARCHAR(20),
    file_id         VARCHAR(36),
    zip_entry_name  VARCHAR(255),
    retry_count     INT         NOT NULL DEFAULT 0,
    error_message   TEXT,
    processed_at    TIMESTAMP,
    created_at      TIMESTAMP   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_arei_job_attempt ON assessment_report_export_item (job_id, attempt_id);
CREATE INDEX idx_arei_job_status ON assessment_report_export_item (job_id, status);
```

**No changes to existing tables.** `student_attempt.report_pdf_file_id` already exists
(`StudentAttempt:93`) and is already written by the release flow; the export job simply writes it
more often.

### 4.2 Enums

```
job.status    PENDING | IN_PROGRESS | COMPLETED | PARTIAL | FAILED | CANCELLED
item.status   PENDING | DONE | SKIPPED | FAILED
item.source   REUSED | GENERATED
```

- No `COMPLETED_WITH_ERRORS` — a ZIP missing 3 of 100 is still `COMPLETED`; the UI branches on
  `failed_count > 0`.
- **`PARTIAL`** — the run stopped with work outstanding, but some items are `DONE`. Resumable, and
  a partial ZIP can be assembled on demand (§6). Distinct from `FAILED`, which means nothing usable
  was produced.
- `CANCELLED` is supported: the worker re-reads its own row at each checkpoint and stops at a
  batch boundary. A cancelled job with `DONE` items behaves like `PARTIAL` for download purposes.

### 4.3 Entities and repositories

New, in `features/assessment/`:

- `entity/AssessmentReportExportJob` — modelled on `entity/AiEvaluationProcess`
- `entity/AssessmentReportExportItem`
- `repository/AssessmentReportExportJobRepository`
  - `Optional<Job> findFirstByInstituteIdAndAssessmentIdAndCreatedByUserIdAndStatusIn(...)` — dedup
  - `Page<Job> findByAssessmentIdAndInstituteIdOrderByCreatedAtDesc(...)` — recent list
  - `@Modifying int claimForRun(String jobId, Set<String> fromStatuses)` — conditional
    `UPDATE ... SET status='IN_PROGRESS' WHERE id=? AND status IN (...)`; rowcount 0 means another
    thread won the race (§6.5)
- `repository/AssessmentReportExportItemRepository`
  - `List<Item> findByJobIdAndStatusInOrderByCreatedAt(String jobId, List<String> statuses)` —
    drives both the initial run (`PENDING`) and resume (`PENDING`, `FAILED` under the retry cap)
  - `List<Item> findByJobIdAndStatusAndFileIdNotNullOrderByCreatedAt(String jobId, String status)` —
    ZIP assembly source (§6.2)
  - `List<Item> findByJobIdOrderByCreatedAt(String jobId)` — manifest

---

## 5. Service layer

### 5.1 `ReportClassContext` (new DTO, `learner_assessment/dto/`)

Plain object, job-scoped, ~500KB. **Not** routed through the Spring cache (C11).

```java
public class ReportClassContext {
    String assessmentId, instituteId, assessmentName;
    List<SectionSnapshot> sections;              // NOT List<Section> — see correction below
    Map<String, Integer> questionOrderByKey;     // NOT the entity map — see correction below; kills C3
    AssessmentOverviewSnapshot overview;         // concrete mirror of the interface projection
    List<MarksRankSnapshot> marksDistribution;   // concrete mirror
    List<LeaderBoardSnapshot> fullLeaderboard;   // concrete mirror
    Map<String, SectionAggregationSnapshot> sectionAggregation;  // typed, not Object[]
    Map<String, Map<String, Double>> optionDistribution;
    ReportBrandingDto branding;
    Double totalMarks;          // derived once
    Double classAccuracy;       // derived once
    Double highestMarks, lowestMarks;
    int[] distributionBuckets;  // histogram maths hoisted out of HtmlBuilderService:900-918
}
```

**Corrections from the architecture review** (blueprint §0 — these override the first draft of this
section):

- `MarksRankDto`, `LeaderBoardDto`, `AssessmentOverviewDto` are **Spring Data interface projections**
  over native queries — runtime proxies. Jackson serializes them but **cannot deserialize into an
  interface**, so a snapshot holding them would throw on the first resume. Each gets a concrete
  mirror class that `implements` the projection interface, so `StudentComparisonDto` and
  `HtmlBuilderService` are untouched.
- `Map<String, Object[]> sectionAggregation` would round-trip through Jackson with
  `BigDecimal`/`Double`/`Integer` drift → `ClassCastException` at `LearnerReportService:515` after a
  resume. Replaced with a typed snapshot record.
- Holding `QuestionAssessmentSectionMapping` entities (EAGER `Question` + question HTML) and
  `Section` entities (LAZY collection) in the context is both heavy and lazy-unsafe. Only
  `getQuestionOrder()` is ever read from the mappings → store `Map<String, Integer>`; sections
  become a small `SectionSnapshot`.

### 5.2 `LearnerReportService` — refactor (PR2)

```java
public ReportClassContext loadClassContext(String assessmentId, String instituteId)          // ~7 queries, once
public StudentComparisonDto buildComparisonFromContext(ReportClassContext ctx,
                                                       String attemptId, String userId)       // 2 queries
```

`buildComparisonData(userId, assessmentId, attemptId, instituteId)` keeps its **exact signature and
`@Cacheable` annotation** and becomes `loadClassContext(...) + buildComparisonFromContext(...)`.

> **Highest-risk change in the feature.** Consumers (**six**, not five — the architecture review
> found one more): `/comparison` endpoint, learner PDF, AI PDF, release flow,
> `StudentAnalysisInternalService` (feeds the v2 student report in admin_core), and
> `AssessmentDataEnrichmentService:131` (feeds the LLM activity-report pipeline — the least
> visible one). Requires before/after output diffing on a real assessment.

The bulk path calls `buildComparisonFromContext` directly, bypassing the cache — it already holds
the context, and C11 makes the cache unreliable mid-job anyway.

### 5.3 `AssessmentParticipantsManager` — refactor (PR1 + PR2)

- **PR1:** thread the already-loaded mapping map into `buildStudentReportReview` instead of calling
  `getMappingById` per question. Local change, no signature change on the public entry point.
  **Semantics caveat (blueprint §0):** `findByQuestionIdAndSectionId` is
  `ORDER BY created_at DESC LIMIT 1`, but the bulk loader is unordered and undeduped — the map must
  merge on greatest `createdAt`, or the PR1 byte-diff gate fails on any assessment with duplicate
  mappings.
- **PR2:** add a context-aware overload:
  `createStudentReportDetailResponse(ReportClassContext ctx, String attemptId)` that reuses
  `ctx.sections` and `ctx.mappingByQuestionAndSection` rather than re-querying (C4).

### 5.4 `ReportPdfRenderService` (new, PR2)

Lifted from `AssessmentParticipantsManager:1100-1125`.

```java
byte[] render(StudentReportOverallDetailDto detail, StudentComparisonDto comparison,
              ReportClassContext ctx)
```

**No email, no status mutation, no `reportMap` accumulation** — those stay in the release flow,
which is rewired to call this service. That removes the duplication and fixes C9.

### 5.5 `ReportRenderResources` (new, PR3)

Addresses C7. Built once per job:

- one `ConverterProperties` with a shared `FontProvider` (Inter registered locally, bundled fallback)
- the invariant CSS block prebuilt as a `String` (varies only by `primaryColor` / `secondaryColor`)
- the remote `@import` removed from generated HTML

### 5.6 `ReportBatchProcessor` (new, PR4)

**Must be a separate bean** — `@Transactional` does not apply to self-invocation.

```java
@Transactional(readOnly = true)
public RenderPacket loadRenderPacket(String attemptId, ReportClassContext ctx)
```

Returns **fully-materialised DTOs, never entities**. Rendering happens after this transaction
commits, so any lazy access on a detached entity there would throw. Attempts are loaded with an
explicit `JOIN FETCH` on registration — `LearnerReportService:576` already documents this exact trap.

> **Verify before building:** confirm `StudentReportAnswerReviewDto` holds copied strings, not
> references back into `Question`. This determines whether the transaction boundary can sit here.

### 5.7 `ReportZipExportService` (new, PR4) — the worker

```java
@Async("reportExportExecutor")
public void run(String jobId)
```

```
claimed = jobRepository.claimForRun(jobId, {PENDING, PARTIAL, FAILED});   // §6.5 race guard
if (claimed == 0) return;

// Class context: reuse the snapshot if this is a resume, else build and persist it (§6.3)
ctx = job.contextSnapshot != null
        ? ReportClassContext.fromJson(job.contextSnapshot)
        : persistSnapshot(learnerReportService.loadClassContext(...));
resources = ReportRenderResources.forJob(ctx);

// PHASE A — produce every missing PDF into S3. Durable, resumable, idempotent.
for (List<Item> batch : partition(itemsToProcess, batchSize)) {
    if (isCancelled(jobId)) break;
    for (Item item : batch) {
        try {
            if (item.fileId != null && !regenerate)      { source = REUSED;    continue; }
            if (attempt.reportPdfFileId != null && !regenerate) {
                item.fileId = attempt.reportPdfFileId;    source = REUSED;
            } else {
                packet = batchProcessor.loadRenderPacket(item.attemptId, ctx);  // short tx
                bytes  = renderService.render(packet, ctx);                     // outside tx
                item.fileId = upload(bytes);                                    // MUST succeed
                backfill attempt.report_pdf_file_id;      source = GENERATED;
            }
            item -> DONE
        } catch (Exception e) { item.retryCount++; item -> FAILED, error_message = e; }
    }
    progressWriter.checkpoint(jobId);   // REQUIRES_NEW
    Thread.sleep(pauseMs);
}

// PHASE B — assemble the ZIP from durable state, not from anything held in memory (§6.2)
assembleZip(jobId);          // streams item.fileId from S3 into a temp file, appends index.csv
status = allDone ? COMPLETED : PARTIAL
```

`assembleZip` is a **separate, idempotent operation** — it reads `DONE` items with a non-null
`file_id`, streams each from S3 into a temp `ZipOutputStream`, appends `index.csv`, uploads with
`setFixedLengthStreamingMode(len)` (C9), and records (not deletes — see §6.5) any ZIP it
supersedes. It is called at the end
of a run, and again by the partial-download endpoint (§6.4). It never renders.

Key boundaries:
- **Per-student transaction**, not per-batch: connection held ~50ms rather than ~500ms. The batch is
  a *checkpoint and throttle unit*, not a transaction or memory unit.
- **Render outside any transaction** — it is the slow part and must not hold 1 of 5 connections (C1).
- **Checkpoint in `REQUIRES_NEW`** — otherwise progress is invisible to pollers until commit.
- **Peak heap = one PDF**, not one batch.

### 5.8 `ReportExportExecutorConfig` (new, PR4)

```java
@Bean("reportExportExecutor")   // core 1, max 1, bounded queue, CallerRunsPolicy
```

Named deliberately (C2). Single thread serialises exports across institutes — a queued job reports
`PENDING`, which the UI must render distinctly from `IN_PROGRESS`.

### 5.9 `AdminExportManager` — new methods (PR4)

`initiateReportZipExport` — validate institute ownership → resolve selection → enforce cap → dedup
against in-flight → insert job + items → kick worker → return `jobId`.
`getReportZipExportStatus` — counters + freshly-resolved presigned URL (C10) + stale detection.
`getRecentReportZipExports` — last N jobs.

---

## 6. Resume and partial completion

Requirement: if a 100-student export fails after 30, **(a)** those 30 must still be deliverable as a
ZIP, and **(b)** the admin must be able to continue and process the remaining 70.

### 6.1 Why the temp ZIP cannot be the durable artifact

A ZIP's central directory is written at `close()`, so a half-written file is not a valid archive.
And the failure modes differ:

- **Soft failure** (caught exception, thread alive, disk intact) — the zip *could* be closed and
  uploaded with 30 entries.
- **Hard failure** (pod crash, OOM, deploy, node eviction) — the thread is gone and the temp file
  sat on ephemeral storage, so it is gone too.

Hard failures are precisely what causes a 30/100 stall, so the temp file is unavailable exactly when
partial delivery matters. It must not be the source of truth.

### 6.2 Durable state model

The source of truth is **`item.file_id` + `item.status`**, not the temp file:

- every generated PDF is uploaded to S3 and recorded on `item.file_id` before the item is `DONE`
- after a crash at 30/100, those 30 PDFs still exist in S3

The ZIP is therefore a **derived artifact**, rebuildable at any time for the cost of one S3 GET per
student (~100ms each; ~3s for 30). No re-rendering.

This is why §5.7 is split into Phase A (produce PDFs) and Phase B (assemble ZIP), rather than
streaming into the zip during generation.

> **Trade-off, stated plainly.** Two phases cost one extra S3 GET per student on the *normal* path —
> roughly 10s per 100 students on a ~2min job. The alternative (stream during generation, rebuild
> only on recovery) saves that 10s but creates a second, rarely-exercised assembly path that will
> rot. Two phases means the recovery path runs on every single export, so it cannot silently break.
> Recommended: accept the 10s.

Consequence for error handling: an item whose **PDF rendered but whose upload failed** must not be
marked `DONE`. It has no `file_id`, so ZIP assembly would silently drop it. Such items stay `FAILED`
and are re-rendered on resume.

### 6.3 Class context snapshot — the consistency guarantee

**The problem.** Reports embed class-level data: rank, percentile, class average, marks
distribution, leaderboard. On resume, `loadClassContext` re-queries all of it. If anyone submitted,
was re-evaluated, or had a result released in between, those numbers change — so the first 30
reports would read *"class average 62, rank 14 of 100"* and the next 70 *"class average 64, rank 15
of 101"*, **inside the same ZIP**. A school distributing those would see rank 14 twice and no 3rd
place.

**Decision (assumed — see §11):** snapshot the context on the job row at first run and reuse it
verbatim on every resume.

- Serialised to `job.context_snapshot` (TEXT) at the end of the first `loadClassContext`
- Contents: `overview`, `marksDistribution`, `fullLeaderboard`, `sectionAggregation`, `totalMarks`,
  `classAccuracy`, `highestMarks`/`lowestMarks`, `distributionBuckets`, `branding`
- Size: ~50KB for 100 students (leaderboard and distribution dominate)
- **Excluded:** `sections` and `mappingByQuestionAndSection` — these carry question HTML, are large,
  and are immutable for a published assessment, so they are re-queried cheaply on resume

Every report in a bundle therefore quotes identical class statistics regardless of how many runs
produced it.

**Residual case that the snapshot does not fix.** If a student among the first 30 is *re-evaluated*
after their PDF was rendered, that PDF is stale no matter what we snapshot — the marks are already
baked into the file. Detect it by comparing `attempt.updated_at` against `item.processed_at` during
assembly, and surface it rather than guessing:

> "3 attempts changed since their reports were generated. Regenerate them, or keep the existing
> reports?"

### 6.4 Partial ZIP (requirement a)

**Decision (assumed):** assembled **lazily**, on request, not eagerly on failure.

Eager assembly wastes a build and orphans an S3 object whenever the admin continues instead of
downloading. Lazy costs ~3s on click, behind a spinner.

Endpoint: `POST /reports/zip/assemble?jobId=` (§7). Runs `assembleZip` over `DONE` items, sets
`output_file_id`, leaves `status = PARTIAL`.

Naming makes the incompleteness obvious in the filename itself:
`<assessment>_reports_partial_30of100.zip`.

### 6.5 Continue (requirement b)

```
POST /reports/zip/continue?jobId=
```

1. **Claim the job** with a conditional update:
   `UPDATE ... SET status='IN_PROGRESS' WHERE id=? AND status IN ('PARTIAL','FAILED')`.
   Rowcount 0 → another thread already claimed it → return the existing state. This is what stops a
   double-click from starting two workers on the same job.
2. `resume_count++`
3. Select items to process: `status = PENDING`, plus `status = FAILED AND retry_count < 2`
4. Run Phase A over them, then Phase B over **all** `DONE` items
5. Record the new `output_file_id`; the superseded partial ZIP is **orphaned, not deleted** — the
   architecture review (blueprint §0) found there is **no S3 delete primitive**: `FileService` has
   no delete method, and media-service's `/internal/delete-file/{fileIds}` only soft-deletes
   `user_to_file` rows and throws when none exists (presigned-upload files have no such row).
   Superseded ids are recorded on the job (`superseded_file_ids`) so a future cleanup can find them.
   Escalated to §11.

Items reaching `retry_count = 2` are permanently failed and no longer offered — a deterministic
render bug would otherwise be retried forever.

### 6.6 Status transitions

```
PENDING ──▶ IN_PROGRESS ──┬──▶ COMPLETED          all items DONE/SKIPPED
                          ├──▶ PARTIAL            some DONE, work outstanding  ──┐
                          ├──▶ FAILED             nothing usable produced      ──┤
                          └──▶ CANCELLED          admin stopped it             ──┤
                                                                                 │
                     ◀── continue (conditional claim) ────────────────────────────┘
```

`COMPLETED` is terminal. `PARTIAL`, `FAILED` and `CANCELLED` are all resumable — the same claim
guard covers each.

---

## 7. APIs

All under the existing `AdminExportController` (`/assessment-service/assessment/export`), which
inherits `authenticated()` from `ApplicationSecurityConfig`.

### `POST /reports/zip/initiate`

```jsonc
// request
{
  "assessmentId": "...", "instituteId": "...",
  "attemptIds": ["att_a1", "att_b2"],   // explicit selection; OR omit and send filter
  "filter": { /* same DTO the submissions list already uses */ },
  "regenerate": false
}
// 200
{ "jobId": "job_7f3", "totalCount": 100, "alreadyRunning": false }
```

Accepting the existing filter DTO means "all matching current filter" does not require the frontend
to page through and collect hundreds of ids.

Rejects with 400 when: selection empty, above cap, assessment/institute mismatch.
Returns the existing `jobId` with `alreadyRunning: true` on double-click.

### `GET /reports/zip/status?jobId=`

```jsonc
{
  "jobId": "job_7f3", "status": "PARTIAL",
  "totalCount": 100, "completedCount": 30, "failedCount": 1, "skippedCount": 2,
  "downloadUrl": null,          // populated when a ZIP exists (COMPLETED or assembled PARTIAL)
  "outputFileName": null, "outputSizeBytes": null,
  "errorMessage": "Worker terminated during batch 4",
  "resumeCount": 0,

  // resume affordances — drive the UI's buttons directly
  "resumable": true,            // status in (PARTIAL, FAILED, CANCELLED) and work outstanding
  "remainingCount": 69,         // PENDING + retryable FAILED
  "assemblable": true,          // >=1 DONE item with a file_id, no current ZIP
  "staleItemCount": 0,          // DONE items whose attempt changed since generation (§6.3)

  "failures": [ { "studentName": "Meera Iyer", "reason": "PDF render failed", "retryCount": 1 } ]
}
```

`downloadUrl` is resolved fresh on every call, never stored (C10).

The three booleans exist so the frontend never has to re-derive resumability from a status string —
each maps to exactly one button: **Continue**, **Download 30 completed**, **Regenerate stale**.

### `POST /reports/zip/continue?jobId=`

Resumes a `PARTIAL` / `FAILED` / `CANCELLED` job (§6.5). Claims the job with a conditional update,
so a double-click returns the existing state rather than starting a second worker.

```jsonc
{ "jobId": "job_7f3", "status": "IN_PROGRESS", "remainingCount": 69, "alreadyRunning": false }
```

Rejects with 409 if the job is `IN_PROGRESS` or `COMPLETED`.

### `POST /reports/zip/assemble?jobId=`

Builds a ZIP from whatever is `DONE` right now, without processing anything further (§6.4). This is
the "give me the 30 that worked" path. Idempotent; supersedes any previous ZIP for the job
(superseded ids recorded, not deleted — §6.5).

```jsonc
{ "jobId": "job_7f3", "includedCount": 30, "totalCount": 100,
  "outputFileName": "midterm_reports_partial_30of100.zip" }
```

### `GET /reports/zip/recent?assessmentId=&instituteId=&limit=5`

Last N jobs so a closed dialog does not lose the download — and so a `PARTIAL` job from yesterday is
still findable and resumable.

### `POST /reports/zip/cancel?jobId=`

Sets `CANCELLED`; the worker stops at the next batch boundary. A cancelled job retains its `DONE`
items and stays both assemblable and resumable.

---

## 8. Configuration

```properties
assessment.report-export.batch-size=10
assessment.report-export.batch-pause-ms=300
assessment.report-export.max-attempts=150
assessment.report-export.stale-job-minutes=20
```

Config rather than constants so prod can be tuned without a deploy — the batch size and cap in
particular depend on the unmeasured render cost.

---

## 9. Failure handling

| Failure | Behaviour |
|---|---|
| Attempt not evaluated | item `SKIPPED` with reason; batch continues |
| Render throws for one student | item `FAILED` + `retry_count++`; batch continues; retried on continue while `retry_count < 2` |
| Individual PDF upload fails | item stays `FAILED`, **not** `DONE` — a `DONE` item with no `file_id` would be silently dropped by ZIP assembly (§6.2). Re-rendered on continue. |
| Pod restart mid-job | temp ZIP lost and irrecoverable, but every `DONE` item's PDF is durable in S3. Stale detection flips the job to `PARTIAL` on next status read; it is then assemblable and resumable. |
| Final ZIP upload fails | job stays `PARTIAL` with items intact; `/assemble` retries the upload only — no re-rendering |
| Admin cancels | `CANCELLED` at next batch boundary; temp file deleted; `DONE` items retained |
| Continue clicked twice | conditional claim; the loser gets the existing state (§6.5) |
| Attempt re-evaluated after its PDF was generated | counted in `staleItemCount`; surfaced to the admin, never silently re-rendered (§6.3) |

Failure isolation is **per student**, never per batch. No failure mode discards completed work —
`item.file_id` is durable from the moment each PDF uploads.

---

## 10. Performance targets (estimates — see §3)

Per-student query count, 50-question assessment:

| | Today | After PR1+PR2 |
|---|---|---|
| `getMappingById` | 50 | 0 |
| Report detail + comparison | ~14 | 3 |
| **Total per student** | **~64** | **3** |
| **100 students** | **~6,400** | **~307** (7 + 3×100) |

Wall clock, 100 students: **~2 min cold**, **~30 s warm** (all `REUSED`).
Connection occupancy: ~5 s of wall-clock total, in 100 short slices — 1 of 5 connections, ~4% duty.

Resume and assembly costs (no rendering in either):

| Operation | Cost |
|---|---|
| Assemble partial ZIP, 30 of 100 done | ~3s (30 S3 GETs) |
| Continue 70 remaining, cold | ~85s + ~10s assembly |
| Continue 70 remaining, warm | ~12s |
| Phase B on the normal path | ~10s per 100 (the §6.2 trade-off) |

---

## 11. Open decisions

**Resolved as assumptions in §6** — flagged here so they can be overridden:

- **Class context on resume** → snapshot on the job row (§6.3). Alternatives were accepting drift,
  or forcing full regeneration.
- **Partial ZIP** → assembled lazily on request (§6.4), not eagerly on failure.
- **Stale-since-generation attempts** → surfaced to the admin via `staleItemCount`, never silently
  re-rendered (§6.3).

**Still open:**

1. **Link expiry / audience.** Admin-only (1 day) vs forwarded to school (7–30 days, unauthenticated
   URL carrying student PII). Recommendation: 7 days with an explicit warning in the UI.
2. **Retention.** `ON DELETE CASCADE` covers item rows but **not S3 objects** — purging a job orphans
   its ZIP. Cleanup must delete the object first. Needs bucket-config ownership. **Escalated by the
   architecture review:** there is currently **no S3 delete primitive at all** (blueprint §0 /
   §6.5 here), so superseded partial ZIPs are orphaned-and-recorded too. Any retention answer now
   has to include either a media-service delete endpoint or an S3 lifecycle rule on the export
   prefix.
3. **RBAC.** Existing export endpoints have no visible role check. If bulk PII export should be more
   restricted than the existing CSV export, that is a deliberate decision, not an inherited default.
4. **`output_file_id` as a column** assumes one ZIP per job. If splitting large exports into parts is
   likely, a child table now avoids a migration later.
5. **Route trees.** `assessment` only, or also `homework-creation`?

---

## 12. Testing checklist

- [ ] PR1/PR2: byte-diff generated report HTML before/after on a real assessment
- [x] Verify `StudentReportAnswerReviewDto` is entity-free (§5.6) — **PASSED** by the architecture
      review: all scalars plus `AssessmentRichTextDataDTO`, whose constructor and `toDTO()` both
      copy. Remaining caveat: `ParticipantsQuestionOverallDetailDto` is a projection proxy and still
      needs an empirical outside-transaction read test; if it fails, one more mirror class is needed
      but the transaction boundary doesn't move.
- [ ] Measure `convertToPdf` with and without network egress (§3)
- [ ] 1-student, 10-student, cap-boundary, over-cap exports
- [ ] Mixed batch: evaluated + unevaluated + a deliberately broken attempt
- [ ] Warm path — re-export the same selection, assert all items `REUSED`
- [ ] Cancel mid-job

**Resume and partial completion (§6)**

- [ ] Kill the pod at ~30/100; assert job → `PARTIAL`, 30 items `DONE` with `file_id` set
- [ ] Assemble partial; assert the ZIP holds exactly 30 PDFs + `index.csv` listing all 100 with
      per-student status, and the filename reads `..._partial_30of100.zip`
- [ ] Continue; assert only the remaining 70 are processed and none of the 30 re-render
      (check `source` on items, not just wall-clock)
- [ ] Assert the final ZIP contains all 100 and the superseded partial ZIP's id was recorded in
      `superseded_file_ids`
- [ ] **Consistency:** submit a new attempt between the two runs; assert every one of the 100 reports
      still quotes the class average and rank from the snapshot (this is the §6.3 guarantee and the
      easiest thing to regress)
- [ ] Double-click Continue; assert one worker runs and the loser gets the existing state
- [ ] Force a deterministic render failure on one attempt; assert it retries twice then stops
- [ ] Simulate a PDF upload failure; assert the item is `FAILED` (not `DONE`) and is re-rendered on
      continue rather than silently missing from the ZIP
- [ ] Re-evaluate an attempt whose PDF already exists; assert `staleItemCount` reports it
- [ ] Resume a `PARTIAL` job from the recent-exports list a day later; assert the snapshot still
      deserialises and the link resolves (C10)

**Load**

- [ ] Concurrent exports from two institutes — assert `PENDING` queueing is visible
- [ ] Watch heap during a 150-student export; assert no growth with batch count
- [ ] Confirm a download link from a job >24h old still resolves (C10)
