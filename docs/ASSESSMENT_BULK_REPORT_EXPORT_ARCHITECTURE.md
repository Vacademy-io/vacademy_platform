# Bulk Assessment Report Export (ZIP) — Architecture Blueprint

**Status:** Design complete, not implemented
**Service:** `assessment_service`
**Companion to:** `docs/ASSESSMENT_BULK_REPORT_EXPORT_PLAN.md` (the agreed plan; this document deepens it, never contradicts it except where §0 says so explicitly)
**Written:** 2026-08-01
**Audience:** the implementation agent. Everything needed to build this is here. Do not re-derive.

---

## 0. Corrections to the plan doc (read this first)

Eight things were verified against source after the plan was written. Six change what you build.
The plan's *decisions* all stand; these are corrections to its *type-level* assumptions.

| # | Plan says | Source says | What you do instead |
|---|---|---|---|
| **X1** | `ReportClassContext` holds `AssessmentOverviewDto overview`, `List<MarksRankDto> marksDistribution`, `List<LeaderBoardDto> fullLeaderboard` (§5.1) and these are serialised to `context_snapshot` (§6.3) | All three are **Spring Data interface projections over `nativeQuery=true`** (`AssessmentOverviewDto`, `MarksRankDto` = `admin_get_dto/response/`, `LeaderBoardDto` = `assessment/dto/`). They are runtime proxies. Jackson can *serialise* them (getters + `@JsonNaming` are on the interface) but **cannot deserialise back into an interface** — there is no concrete type to instantiate. | Introduce concrete mirrors that `implements` the projection interface (§5.2). `ReportClassContext` declares the **interface** type (so `StudentComparisonDto` and `HtmlBuilderService` are untouched) but always *holds* the concrete mirror. Snapshot round-trips through the mirror. **This is the single highest-risk correction — without it, resume throws on `readValue`.** |
| **X2** | `Map<String, Object[]> sectionAggregation` (§5.1) | `findSectionWiseAggregation` returns `List<Object[]>` from a native query; element types are driver-dependent (`BigDecimal` vs `Double` vs `Long`). Jackson round-trips `Object[]` to `List<Object>` with `Integer`/`Double` drift → `((Number) row[1]).doubleValue()` at `LearnerReportService:515` would `ClassCastException` after a resume. | Typed record `SectionAggregateSnapshot(String sectionId, Double avgMarks, Double maxMarks, Long totalCorrect, Long totalQuestions)`, normalised at load time. `ctx.sectionAggregation` becomes `Map<String, SectionAggregateSnapshot>`. |
| **X3** | `Map<String, QuestionAssessmentSectionMapping> mappingByQuestionAndSection` (§5.1) | `QuestionAssessmentSectionMapping` has `@ManyToOne Question question` (**EAGER** — `@ManyToOne` defaults to EAGER), and `Question` drags `textData` via a bare `@OneToOne`. Holding these for the life of a job means the whole question bank + question HTML is pinned in heap **twice** (once here, once per-student in the render packet), and every one is a detached entity outside a transaction. | Store only what is used: `Map<String, Integer> questionOrderByQuestionAndSection` (key `questionId + '#' + sectionId`). `buildStudentReportReview` reads exactly one field off the mapping — `getQuestionOrder()`. Nothing else. Heap drops from MBs to KBs and the detached-entity risk disappears. |
| **X4** | `List<Section> sections` (§5.1) | `Section` has `@OneToMany(fetch = LAZY) questionAssessmentSectionMappings` and `@ManyToOne assessment`. A detached `Section` held across a whole job is a `LazyInitializationException` landmine for any future code that touches either. | `List<SectionSnapshot>` — `(id, name, totalMarks, cutOffMarks, sectionOrder)`. That is the complete set of `Section` getters used by `buildSectionComparison` (`LearnerReportService:497-538`). |
| **X5** | `buildComparisonData` has 5 consumers (§5.2) | There are **6**. The plan misses `learner_assessment/service/AssessmentDataEnrichmentService:131` (`addComparisonContext`, feeds the LLM activity-report pipeline). | Add it to the PR2 regression list. It is the least visible consumer — a silent break there degrades AI reports weeks later. |
| **X6** | "Delete the superseded partial ZIP object from S3 before recording the new `output_file_id`" (§6.5, §7 `/assemble`) | There is **no S3-delete primitive reachable from `assessment_service`**. `common_service` `FileService` has no delete method. The only internal route (`/media-service/internal/delete-file/{fileIds}`, `InternalFileServicesController:24`) soft-deletes `user_to_file` rows and **throws `VacademyException` when no such row exists** — files created via `getPresignedUploadUrl` have no `user_to_file` row, so calling it would 500. | **Do not delete.** Record the superseded id in a new `superseded_file_ids` column (comma-separated) on the job row, log at WARN, and leave the object orphaned for a future retention job. This is explicitly the plan's open decision #2 and it now has a concrete blocker. §7 of this doc specifies the column. |
| **X7** | (silent) | `AssessmentParticipantsManager.releaseResultWrapper` is `@Async` **and** wraps its body in `CompletableFuture.runAsync(...)` (`:1019-1028`). The real work therefore runs on `ForkJoinPool.commonPool()`, not on the Spring async executor. | Note it in PR2. Do **not** fix it in PR2 (out of scope, changes release-flow timing). Record it so PR4's capacity reasoning does not assume the release flow is on the same executor. It is not — it is on the common pool, which is a *separate* uncontrolled parallelism source competing for the same 5 connections. |
| **X8** | (silent) | `getMappingById` → `findByQuestionIdAndSectionId` is `ORDER BY qasm.created_at DESC LIMIT 1` (`QuestionAssessmentSectionMappingRepository:35-40`). The bulk loader `getQuestionAssessmentSectionMappingBySectionIds` has **no ordering and no dedup**. | The PR1 map **must** be built with a merge function that keeps the greatest `createdAt`, or PR1's byte-diff gate fails on any assessment with duplicate (question, section) rows. Exact code in §6.1. |

Everything else in the plan doc is confirmed correct against source, including all eleven constraints C1–C11.

---

## 1. Overview & requirements

### Functional
1. An admin selects submissions (explicit `attempt_ids` or the existing submissions filter) and starts an export.
2. The system renders one branded comparison-report PDF per student and packages them, plus `index.csv`, into a ZIP behind a persistent download link.
3. Progress is pollable. The dialog can be closed and the job re-found later.
4. A job that stops with work outstanding is **resumable** (process the rest) and **assemblable** (download what already worked).
5. Cancel is supported and stops at a batch boundary.
6. Every report inside one ZIP quotes **identical class-level statistics**, regardless of how many runs produced it.

### Non-functional (all derived from verified source constraints)
| Requirement | Value | Source |
|---|---|---|
| Concurrency | exactly 1 export worker thread process-wide | C1 (Hikari pool = 5) |
| DB connection duty cycle during export | < 10% of one connection | C1 |
| Peak heap attributable to the export | one PDF (~1–3 MB), independent of batch count and job size | C9 |
| Transaction duration | ≤ ~50 ms per student; **zero** transactions open during rendering | C1 |
| Scale | 20–300 submissions; hard cap configurable, default 150 | §8 |
| Durability | no failure mode discards a rendered+uploaded PDF | §6.2 |
| Link lifetime | resolved per request, never persisted | C10 |

### Explicit non-goals
- Parallel rendering. Not available at pool size 5.
- The AI report (`/learner/report/ai-pdf`).
- Cross-pod job distribution. One worker per pod; the conditional claim (§8.5) is the only concurrency guard, and it is sufficient because it is a DB-level compare-and-set.

---

## 2. Architecture decision summary

| # | Decision | Rationale | Rejected alternative |
|---|---|---|---|
| D1 | Two-phase worker: Phase A renders+uploads per student, Phase B assembles the ZIP from durable `item.file_id` | Recovery path runs on **every** export, so it cannot silently rot. Costs ~1 extra S3 GET/student. | Stream into the ZIP during generation; rebuild only on recovery. Saves ~10s/100 but creates a rarely-exercised second path. Plan §6.2 explicitly accepts the 10s. |
| D2 | Durable state = `item.file_id` + `item.status`; the ZIP is a derived artifact | A ZIP's central directory is written at `close()`; a half-written temp file on ephemeral storage is worthless exactly when partial delivery matters. | Temp file as source of truth. |
| D3 | Class context snapshotted to `job.context_snapshot` on first run, reused verbatim on resume | Rank/percentile/class-average must be identical across the whole bundle. A school seeing "rank 14" twice is a correctness bug, not a cosmetic one. | Re-query on resume (drift); force full regeneration (wastes 30 renders). |
| D4 | Snapshot carries **concrete mirror types**, not projection interfaces | X1 — projections are not deserialisable. | Storing raw projection JSON and re-projecting. No mechanism exists. |
| D5 | Snapshot deserialisation failure → **rebuild fresh, mark `context_drift = true`, continue** | The job's *purpose* is delivering reports. Failing the job on a serialisation format change is a worse outcome than a documented, surfaced inconsistency. | Fail the job (brittle across deploys); silently rebuild (invisible correctness regression). §9. |
| D6 | Named bounded executor `reportExportExecutor` (core 1, max 1, queue 50, `CallerRunsPolicy`) | C2 — a bean named `taskExecutor` would silently retarget every existing `@Async` in the service, including the release flow and the AI-evaluation pipeline. | Default executor; unbounded executor. |
| D7 | Per-student read-only transaction inside `ReportBatchProcessor`; render strictly outside | C1 — a render (seconds) holding 1 of 5 connections is a service-wide latency incident. | Per-batch transaction (10× the hold time); transaction around the whole loop (fatal). |
| D8 | `buildComparisonData` keeps its exact signature **and** `@Cacheable`; it is re-expressed as `loadClassContext + buildComparisonFromContext` | 6 consumers (X5). Any signature change is a 6-site blast radius. | New method + migrate callers. Higher risk for no gain. |
| D9 | The bulk path calls `buildComparisonFromContext` directly, bypassing the Spring cache | C11 — `@CacheEvict(allEntries=true)` fires on every attempt update, so the cache is actively hostile as mid-job state. | Warming the cache; a second cache region. |
| D10 | Job creation and worker dispatch are separated; dispatch happens in `afterCommit` | Precedent at `AiEvaluationService:98-112` — the async thread otherwise reads before the INSERT is visible on another connection. | Dispatch inline (race). |
| D11 | Superseded ZIP objects are **orphaned and recorded**, not deleted | X6 — no delete primitive exists. | Blocking the feature on a media-service change. |
| D12 | All six endpoints live on the existing `AdminExportController` | Inherits `authenticated()` from `ApplicationSecurityConfig`; consistent with every other export. | New controller. |

---

## 3. Component diagram

Arrows point **from dependent to dependency**. `L` = injected `@Lazy`.

```
                       ┌──────────────────────────────┐
                       │  AdminExportController       │  (existing, +6 endpoints)
                       └──────────────┬───────────────┘
                                      │
                       ┌──────────────▼───────────────┐
                       │  AdminExportManager          │  (existing, +3 methods)
                       └──┬────────┬────────┬─────┬───┘
                          │        │        │     │
        ┌─────────────────┘        │        │     └────────────────┐
        │                          │        │                      │
┌───────▼────────────┐  ┌──────────▼─────┐ ┌▼──────────────────┐ ┌─▼──────────────────┐
│ ReportExportJob    │  │ ReportZip      │ │ ReportZipAssembly │ │ LearnerReport      │
│ Factory      (new) │  │ ExportService  │ │ Service     (new) │ │ Service (existing) │
│ @Transactional     │  │ (new) @Async   │ │                   │ │                    │
└───────┬────────────┘  └──┬──┬──┬──┬──┬─┘ └──┬──────────┬─────┘ └──┬─────────────────┘
        │                  │  │  │  │  │      │          │          │ L
        │  ┌───────────────┘  │  │  │  └──────┼────┐     │          │
        │  │                  │  │  │         │    │     │          │
┌───────▼──▼─────────┐ ┌──────▼──┴──┴───┐ ┌───▼────▼──┐ ┌▼──────────▼─────────────────┐
│ ReportExportJob/   │ │ ReportBatch    │ │ FileService│ │ AssessmentParticipants     │
│ ItemRepository(new)│ │ Processor (new)│ │ (common)   │ │ Manager (existing)         │
└────────────────────┘ └──┬──────────┬──┘ └────────────┘ └──┬─────────────────────────┘
                          │          │                       │ L
                          │          └───────────────────────┘  (back to LearnerReportService)
        ┌─────────────────┘
┌───────▼────────────┐   ┌─────────────────────┐   ┌────────────────────────┐
│ ReportPdfRender    │──▶│ ReportRenderResources│  │ ReportExportProgress   │
│ Service      (new) │   │ (new, PR3)           │  │ Writer (new)           │
└───────┬────────────┘   └─────────────────────┘   │ @Transactional         │
        │                                           │ (REQUIRES_NEW)         │
┌───────▼────────────┐   ┌─────────────────────┐   └────────────────────────┘
│ HtmlBuilderService │   │ ReportExportContext │
│ (existing)         │   │ Serializer  (new)   │
└────────────────────┘   └─────────────────────┘
```

### Cycle analysis — the thing you must not break

There is **already** a cycle in the codebase, broken with `@Lazy`:

```
LearnerReportService ──(direct @Autowired)──▶ AssessmentParticipantsManager
AssessmentParticipantsManager ──(@Lazy @Autowired)──▶ LearnerReportService   [:118-120]
```

`LearnerReportService` also carries a `@Lazy self` reference (`:73-75`) so its own `@Cacheable` methods go through the proxy.

Separately, `AdminExportManager ──▶ LearnerReportService` already exists (`AdminExportManager:71-72`).

**Rule R1 (hard):** `LearnerReportService` must never gain a reference to `AdminExportManager`. That closes a 2-cycle across two packages and there is no `@Lazy` on the `AdminExportManager` side to break it.

**Rule R2 (hard):** nothing in `features/assessment/service/export/` may be injected into `LearnerReportService`, `AssessmentParticipantsManager`, `HtmlBuilderService`, or `StudentAttemptService`. The export package is a **leaf consumer**. All arrows point into the existing report stack, never out.

**Rule R3:** `ReportPdfRenderService` depends only on `HtmlBuilderService` + `ReportRenderResources`. It must not depend on any repository, any manager, `FileService`, or the notification services. It is a pure function `(detail, comparison, ctx) -> byte[]`.

**Rule R4:** `ReportBatchProcessor` depends on `AssessmentParticipantsManager` and `LearnerReportService`. Both are injected **plainly** (not `@Lazy`) — there is no return edge, so no cycle. Do not add `@Lazy` out of superstition; it would hide a real cycle if one were later introduced.

### Component responsibilities

| Component | Package | Single responsibility | New/Modified | PR |
|---|---|---|---|---|
| `ReportClassContext` | `features/learner_assessment/dto/` | Job-scoped, immutable-after-build carrier of all assessment-wide report data | New | PR2 |
| `AssessmentOverviewSnapshot` etc. (5 mirrors) | `features/learner_assessment/dto/context/` | Concrete, Jackson-round-trippable stand-ins for the projection interfaces | New | PR2 |
| `LearnerReportService` | `features/learner_assessment/service/` | +`loadClassContext`, +`buildComparisonFromContext`; `buildComparisonData` re-expressed over them | Modified | PR2 |
| `AssessmentParticipantsManager` | `features/assessment/manager/` | +ctx-aware `createStudentReportDetailResponse` overload; N+1 fix; release flow rewired to `ReportPdfRenderService` | Modified | PR1+PR2 |
| `ReportPdfRenderService` | `features/assessment/service/` | HTML → PDF bytes. Nothing else. No I/O, no state mutation, no email. | New | PR2 |
| `ReportRenderResources` | `features/assessment/service/render/` | Per-job render inputs: shared `ConverterProperties`, `FontProvider`, prebuilt CSS | New | PR3 |
| `ReportFontProviderHolder` | `features/assessment/service/render/` | Process-wide singleton `FontProvider` with Inter registered from classpath | New | PR3 |
| `AssessmentReportExportJob` / `...Item` | `features/assessment/entity/` | Job + item rows | New | PR4 |
| `AssessmentReportExportJobRepository` / `...ItemRepository` | `features/assessment/repository/` | Persistence, incl. the conditional-claim UPDATE | New | PR4 |
| `ReportExportJobFactory` | `features/assessment/service/export/` | Resolve selection → validate → dedup → INSERT job+items in one transaction | New | PR4 |
| `ReportZipExportService` | `features/assessment/service/export/` | The `@Async` worker. Owns the batch loop and the status machine. | New | PR4 |
| `ReportBatchProcessor` | `features/assessment/service/export/` | **The only** transactional read boundary in the worker path. Returns fully-materialised `RenderPacket`. | New | PR4 |
| `ReportExportProgressWriter` | `features/assessment/service/export/` | `REQUIRES_NEW` writes: item results, counters, status, cancel checks | New | PR4 |
| `ReportZipAssemblyService` | `features/assessment/service/export/` | Idempotent Phase B. Streams S3 → temp ZIP → S3. Never renders. | New | PR4 |
| `ReportExportContextSerializer` | `features/assessment/service/export/` | Jackson to/from `context_snapshot`, versioned | New | PR4 |
| `ReportExportExecutorConfig` | `features/assessment/service/export/` | Declares the named bounded executor | New | PR4 |
| `ReportExportProperties` | `features/assessment/service/export/` | `@ConfigurationProperties("assessment.report-export")` | New | PR4 |
| `AdminExportManager` | `features/assessment/manager/` | +`initiate`/`status`/`recent`/`continue`/`assemble`/`cancel` orchestration | Modified | PR4 |
| `AdminExportController` | `features/assessment/controller/` | +6 endpoints | Modified | PR4 |

---

## 4. Data models

### 4.1 Migration `V34__assessment_report_export.sql`

Verified: highest existing migration in `assessment_service/src/main/resources/db/migration` is `V33__split_whatsapp_and_payments.sql`. `V34` is free.

Use the plan's §4.1 DDL **verbatim**, with these three additions:

```sql
-- added to assessment_report_export_job:
    context_snapshot_version  INT,           -- see §9; NULL until first snapshot write
    context_drift             BOOLEAN NOT NULL DEFAULT FALSE,
    superseded_file_ids       TEXT,          -- X6: comma-separated orphaned ZIP ids
```

Two more indexes beyond the plan's:

```sql
-- the status endpoint's stale-item comparison joins items back to attempts
CREATE INDEX idx_arei_job_done_file ON assessment_report_export_item (job_id, status)
    WHERE file_id IS NOT NULL;
```

Column notes the implementer must honour:
- `context_snapshot` is `TEXT`. Expected size ~50 KB for 100 students. At the 150 cap, ~75 KB. Postgres TOASTs this transparently; do not add compression.
- `retry_count` gates at `< 2` (so a maximum of 2 attempts beyond the first is **not** what is meant — the plan says "retried twice then stops", i.e. `retry_count` reaches 2 and the item is no longer offered). Concretely: initial run sets `retry_count = 1` on first failure; first continue sets `2`; the item is then permanently excluded.
- `zip_entry_name` is written at **assembly** time, not at render time, because it must be uniquified against the other entries in that particular ZIP (§8.3).

### 4.2 Enums

Three Java enums in `features/assessment/enums/`. Persist `.name()` as `String` on the entity (matching `AiEvaluationProcess`, which stores `status` as a plain `String` column — follow that precedent: **`String` columns, enum used only in code**, no `@Enumerated`).

```java
public enum ReportExportJobStatus  { PENDING, IN_PROGRESS, COMPLETED, PARTIAL, FAILED, CANCELLED }
public enum ReportExportItemStatus { PENDING, DONE, SKIPPED, FAILED }
public enum ReportExportItemSource { REUSED, GENERATED }
```

### 4.3 Entities

Model both on `entity/AiEvaluationProcess`: `@Entity`, `@Table`, `@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor`, `@Id @UuidGenerator String id`, `created_at`/`updated_at` as `@Column(insertable=false, updatable=false) Date`.

**Deliberate divergence:** `AiEvaluationProcess` uses `@ManyToOne` to `StudentAttempt`/`Assessment`. Do **not** copy that here. `AssessmentReportExportItem.attemptId` is a **plain `String` column, no association**. Reason: the item is read on the worker thread outside any transaction; a `@ManyToOne` would either force eager loading of the attempt into every item (heap) or throw on lazy access (correctness). The worker fetches attempts explicitly, in bulk, inside `ReportBatchProcessor`. Same for `job.assessmentId`.

### 4.4 Repositories

```java
public interface AssessmentReportExportJobRepository
        extends JpaRepository<AssessmentReportExportJob, String> {

    Optional<AssessmentReportExportJob>
        findFirstByInstituteIdAndAssessmentIdAndCreatedByUserIdAndStatusInOrderByCreatedAtDesc(
            String instituteId, String assessmentId, String createdByUserId, List<String> statuses);

    Page<AssessmentReportExportJob>
        findByAssessmentIdAndInstituteIdOrderByCreatedAtDesc(
            String assessmentId, String instituteId, Pageable pageable);

    /**
     * Conditional claim. Rowcount 0 means another thread won the race.
     * MUST be called from a caller that is NOT itself inside a transaction that
     * also reads the row, or the read will be stale.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        UPDATE assessment_report_export_job
           SET status = 'IN_PROGRESS', updated_at = now(),
               started_at = COALESCE(started_at, now())
         WHERE id = :jobId AND status IN (:fromStatuses)
        """, nativeQuery = true)
    int claimForRun(@Param("jobId") String jobId,
                    @Param("fromStatuses") List<String> fromStatuses);

    /** Cheap cancel probe — avoids loading the whole row (context_snapshot is 50KB). */
    @Query("SELECT j.status FROM AssessmentReportExportJob j WHERE j.id = :jobId")
    Optional<String> findStatusById(@Param("jobId") String jobId);
}
```

> **`findStatusById` matters.** The naive `findById(jobId).getStatus()` at every batch boundary drags the 50 KB `context_snapshot` across the wire 10–15 times per job. Project the column.

```java
public interface AssessmentReportExportItemRepository
        extends JpaRepository<AssessmentReportExportItem, String> {

    List<AssessmentReportExportItem>
        findByJobIdAndStatusInOrderByCreatedAt(String jobId, List<String> statuses);

    List<AssessmentReportExportItem>
        findByJobIdAndStatusAndFileIdIsNotNullOrderByCreatedAt(String jobId, String status);

    List<AssessmentReportExportItem> findByJobIdOrderByCreatedAt(String jobId);

    long countByJobIdAndStatus(String jobId, String status);

    /** Resume selection: PENDING, plus FAILED under the retry cap. One query. */
    @Query("""
        SELECT i FROM AssessmentReportExportItem i
         WHERE i.jobId = :jobId
           AND (i.status = 'PENDING' OR (i.status = 'FAILED' AND i.retryCount < :maxRetry))
         ORDER BY i.createdAt
        """)
    List<AssessmentReportExportItem> findProcessable(@Param("jobId") String jobId,
                                                     @Param("maxRetry") int maxRetry);
}
```

Note the Spring Data keyword is `FileIdIsNotNull`, not `FileIdNotNull` as the plan wrote it.

---

## 5. DTO shapes

All API DTOs: `@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor` +
`@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)` — the repo convention, confirmed on
`StudentComparisonDto`, `StudentReportOverallDetailDto`, `ReportBrandingDto`, `StudentReportAnswerReviewDto`.
Java fields stay camelCase; the JSON is snake_case.

### 5.1 `ReportClassContext` — `features/learner_assessment/dto/ReportClassContext.java`

```java
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class ReportClassContext {

    // ---- identity (snapshotted) ----
    private String assessmentId;
    private String instituteId;
    private String assessmentName;

    // ---- class aggregates (SNAPSHOTTED — these are the consistency guarantee) ----
    private AssessmentOverviewDto overview;              // holds AssessmentOverviewSnapshot
    private List<MarksRankDto>    marksDistribution;     // holds MarksRankSnapshot
    private List<LeaderBoardDto>  fullLeaderboard;       // holds LeaderBoardSnapshot
    private Map<String, SectionAggregateSnapshot> sectionAggregation;   // by sectionId
    private Double totalMarks;
    private Double classAccuracy;
    private Double highestMarks;
    private Double lowestMarks;
    private HistogramSpec histogram;
    private ReportBrandingDto branding;

    // ---- assessment structure (NOT snapshotted — immutable & cheap to re-query) ----
    @JsonIgnore private List<SectionSnapshot> sections;
    @JsonIgnore private Map<String, Integer> questionOrderByQuestionAndSection;  // "qId#sId" -> order
    @JsonIgnore private Map<String, Map<String, Double>> optionDistribution;     // qId -> optId -> pct

    // ---- provenance ----
    private int snapshotVersion;        // §9
    @JsonIgnore private boolean rebuiltAfterDriftFailure;

    public static String mappingKey(String questionId, String sectionId) {
        return questionId + '#' + sectionId;
    }
}
```

**What is and is not in the JSON snapshot.** `@JsonIgnore` is the mechanism — a single annotation on the field, so the include/exclude decision lives next to the field and cannot drift from the serializer.

| Field | Snapshotted | Why |
|---|---|---|
| `assessmentId`, `instituteId`, `assessmentName` | Yes | Cheap; makes the snapshot self-describing for debugging |
| `overview`, `marksDistribution`, `fullLeaderboard`, `sectionAggregation` | **Yes** | These *are* D3. Rank, class average, percentile, distribution all derive from them. |
| `totalMarks`, `classAccuracy`, `highestMarks`, `lowestMarks`, `histogram` | **Yes** | Derived from the above; snapshotting them removes any chance of a derivation-order difference between runs |
| `branding` | Yes | Guarantees the second 70 reports look like the first 30 even if the institute changes its logo mid-job. ~1 KB. |
| `sections` | **No** | Immutable for a published assessment; ~10 rows; one query |
| `questionOrderByQuestionAndSection` | **No** | Immutable; potentially thousands of entries; one query |
| `optionDistribution` | **No** | Judgement call, stated: it varies with new submissions, but it is a *per-question* aid ("38% of the class picked B"), not a number the student is ranked against. Two students seeing 38% and 39% is not the §6.3 failure mode. Re-query it. If this proves wrong in review, adding it is one annotation. |
| `snapshotVersion` | Yes | §9 |

Estimated snapshot size, 100 students: leaderboard ~100 × 180 B ≈ 18 KB, marksDistribution ~60 × 90 B ≈ 5 KB, sectionAggregation ~10 × 120 B ≈ 1 KB, branding ~1 KB, scalars < 1 KB → **~26 KB**. At the 150 cap, ~38 KB. The plan's ~50 KB estimate holds with headroom.

### 5.2 Snapshot mirrors — `features/learner_assessment/dto/context/`

The pattern, once, for all three projections:

```java
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class MarksRankSnapshot implements MarksRankDto {
    private Double  marks;
    private Integer rank;
    private Integer noOfParticipants;
    private Double  percentile;

    public static MarksRankSnapshot from(MarksRankDto p) {
        return MarksRankSnapshot.builder()
                .marks(p.getMarks()).rank(p.getRank())
                .noOfParticipants(p.getNoOfParticipants()).percentile(p.getPercentile()).build();
    }
}
```

Because it `implements MarksRankDto`, Lombok's generated `getMarks()` etc. satisfy the interface, `ReportClassContext.marksDistribution` stays `List<MarksRankDto>`, and `StudentComparisonDto.marksDistribution` and `HtmlBuilderService`'s histogram code are **completely unchanged**. Deserialisation targets the concrete class via `TypeReference<List<MarksRankSnapshot>>` inside the serializer (§9), then widens.

Build the same way:

| Mirror | Implements | Fields (copy every getter on the interface) |
|---|---|---|
| `AssessmentOverviewSnapshot` | `AssessmentOverviewDto` | `createdOn, startDateAndTime, endDateAndTime, durationInMin, totalParticipants, averageDuration, averageMarks, totalAttempted, totalOngoing, subjectId` |
| `MarksRankSnapshot` | `MarksRankDto` | `marks, rank, noOfParticipants, percentile` |
| `LeaderBoardSnapshot` | `LeaderBoardDto` | `attemptId, userId, studentName, batchId, completionTimeInSeconds, achievedMarks, rank, percentile` |

Two plain records (not implementing anything — no interface exists):

```java
public record SectionAggregateSnapshot(String sectionId, Double avgMarks, Double maxMarks,
                                       Long totalCorrect, Long totalQuestions) {}

public record SectionSnapshot(String id, String name, Double totalMarks,
                              Double cutOffMarks, Integer sectionOrder) {}
```

`SectionAggregateSnapshot` is built by normalising the raw `Object[]` **once**, at load time, with the exact index semantics currently at `LearnerReportService:513-519` (`row[0]` = sectionId, `row[1]` = avg, `row[2]` = max):

```java
static SectionAggregateSnapshot from(Object[] row) {
    return new SectionAggregateSnapshot(
        (String) row[0],
        num(row, 1) == null ? 0.0 : num(row, 1).doubleValue(),
        num(row, 2) == null ? 0.0 : num(row, 2).doubleValue(),
        num(row, 3) == null ? null : num(row, 3).longValue(),
        num(row, 4) == null ? null : num(row, 4).longValue());
}
private static Number num(Object[] r, int i) {
    return (r.length > i && r[i] instanceof Number n) ? n : null;
}
```

The `instanceof Number` guard is what makes this immune to the `BigDecimal`/`Double` driver variance that X2 warns about.

`HistogramSpec` — only the class-invariant part of `HtmlBuilderService:898-918` is hoistable. `studentBucketIdx` (`:906`) is per-student and must stay in the builder:

```java
public record HistogramSpec(int bucketSize, int numBuckets, int[] bucketCounts,
                            int maxCount, int avgBucketIdx) {}
```

### 5.3 `RenderPacket` — `features/assessment/dto/export/RenderPacket.java`

The transaction-boundary contract. **Everything in it is a DTO or a primitive. No entity, no projection proxy, no lazy anything.**

```java
@Getter @Builder
public class RenderPacket {
    private final String attemptId;
    private final String userId;
    private final String studentName;      // for the zip entry name and index.csv
    private final String studentEmail;     // index.csv only
    private final Date   attemptUpdatedAt; // stale detection (§8.4)
    private final String existingReportPdfFileId;  // attempt.report_pdf_file_id, for REUSED
    private final StudentReportOverallDetailDto detail;
    private final StudentComparisonDto comparison;
}
```

`StudentReportOverallDetailDto` → `Map<String, List<StudentReportAnswerReviewDto>>`. **Verified entity-free** (see §12, gate G1). `StudentComparisonDto` → all boxed scalars + `List<MarksRankDto>` (mirrors) + `List<SectionComparisonDto>` (plain DTO) + `SmartLeaderboardDto`. Also entity-free.

### 5.4 API DTOs — `features/assessment/dto/export/zip/`

```java
// ── POST /reports/zip/initiate ────────────────────────────────────────────────
ReportZipInitiateRequest {
    String assessmentId;            // assessment_id
    String instituteId;             // institute_id
    List<String> attemptIds;        // attempt_ids   — explicit selection, OR
    AssessmentUserFilter filter;    // filter        — the existing submissions-list DTO
    boolean regenerate;             // regenerate
}
ReportZipInitiateResponse {
    String jobId; int totalCount; boolean alreadyRunning; String status;
}

// ── GET /reports/zip/status?jobId= ───────────────────────────────────────────
ReportZipStatusResponse {
    String jobId; String status;
    int totalCount, completedCount, failedCount, skippedCount;
    String downloadUrl;             // resolved fresh every call (C10); null when no ZIP
    String outputFileName; Long outputSizeBytes;
    String errorMessage; int resumeCount;
    boolean resumable;              // status in (PARTIAL,FAILED,CANCELLED) && remainingCount>0
    int remainingCount;             // PENDING + FAILED with retry_count < 2
    boolean assemblable;            // >=1 DONE item with file_id
    int staleItemCount;             // DONE items whose attempt changed after processed_at
    boolean contextDrift;           // §9 — snapshot was unreadable and rebuilt
    Date startedAt, completedAt, updatedAt;
    List<ReportZipFailureDto> failures;   // capped at 50
}
ReportZipFailureDto { String attemptId; String studentName; String reason; int retryCount; }

// ── POST /reports/zip/continue?jobId= ────────────────────────────────────────
ReportZipContinueResponse { String jobId; String status; int remainingCount; boolean alreadyRunning; }

// ── POST /reports/zip/assemble?jobId= ────────────────────────────────────────
ReportZipAssembleResponse {
    String jobId; int includedCount; int totalCount;
    String outputFileName; String downloadUrl; Long outputSizeBytes; boolean partial;
}

// ── GET /reports/zip/recent?assessmentId=&instituteId=&limit=5 ───────────────
ReportZipRecentResponse { List<ReportZipJobSummaryDto> jobs; }
ReportZipJobSummaryDto {
    String jobId; String status; int totalCount, completedCount, failedCount;
    String outputFileName; String downloadUrl; boolean resumable; boolean assemblable;
    Date createdAt, completedAt; String createdByUserId;
}

// ── POST /reports/zip/cancel?jobId= ──────────────────────────────────────────
ReportZipCancelResponse { String jobId; String status; boolean cancelled; }
```

`assemblable` deliberately drops the plan's "…and no current ZIP" clause. Re-assembly is idempotent and cheap, and after a Continue the existing ZIP is *stale* — the button must stay live. The frontend distinguishes by comparing `completedCount` against the ZIP's `includedCount`, which it already has from the last assemble response.

---

## 6. Per-PR file-level change list

### PR1 — N+1 fix in `buildStudentReportReview` (C3)

**Files modified: 1.**

`features/assessment/manager/AssessmentParticipantsManager.java`

| Line(s) | Change |
|---|---|
| `:805` | `generateStudentReport(mappings, attemptId)` → `generateStudentReport(mappings, attemptId, buildQuestionOrderMap(mappings))` |
| `:825` | `private Map<String, List<StudentReportAnswerReviewDto>> generateStudentReport(List<QuestionAssessmentSectionMapping> mappings, String attemptId, Map<String,Integer> orderByKey)` |
| `:841` | thread `orderByKey` into `getQuestionReviewForAttempt(...)` |
| `:845` | `private List<StudentReportAnswerReviewDto> getQuestionReviewForAttempt(String sectionId, List<String> questionIds, String attemptId, Map<String,Integer> orderByKey)` |
| `:859` | `.map(this::buildStudentReportReview)` → `.map(qwm -> buildStudentReportReview(qwm, orderByKey))` |
| `:864` | `private StudentReportAnswerReviewDto buildStudentReportReview(QuestionWiseMarks questionWiseMarks, Map<String,Integer> orderByKey)` |
| `:870-873` | delete the `getMappingById` call and the null-check throw; replace with a map lookup (below) |
| `:913` | `.questionOrder(questionAssessmentSectionMapping.getQuestionOrder())` → `.questionOrder(order)` |
| new | `private static Map<String,Integer> buildQuestionOrderMap(List<QuestionAssessmentSectionMapping> mappings)` |

The replacement for `:870-873` — behaviour-preserving, including the drop-on-missing semantics:

```java
String key = ReportClassContext.mappingKey(
        questionWiseMarks.getQuestion().getId(), questionWiseMarks.getSection().getId());
Integer order = orderByKey.get(key);
if (order == null) {
    // Preserves today's behaviour: getMappingById returned null, the explicit
    // throw fired, the catch at :930 swallowed it, and the caller's
    // filter(Objects::nonNull) dropped the question from the report.
    throw new VacademyException("Section and Question Mapping Not Found");
}
```

The map builder — **X8 is load-bearing here**:

```java
private static Map<String, Integer> buildQuestionOrderMap(
        List<QuestionAssessmentSectionMapping> mappings) {
    // findByQuestionIdAndSectionId is `ORDER BY created_at DESC LIMIT 1`, so when a
    // (question, section) pair has duplicate rows the newest one wins. The bulk
    // loader returns them unordered, so the merge below must reproduce that pick or
    // the PR1 byte-diff gate fails on assessments with duplicated mappings.
    Map<String, QuestionAssessmentSectionMapping> newest = new HashMap<>();
    for (QuestionAssessmentSectionMapping m : mappings) {
        if (m.getQuestion() == null || m.getSection() == null) continue;
        String key = ReportClassContext.mappingKey(m.getQuestion().getId(), m.getSection().getId());
        newest.merge(key, m, (a, b) -> {
            Date da = a.getCreatedAt(), db = b.getCreatedAt();
            if (da == null) return b;
            if (db == null) return a;
            return db.after(da) ? b : a;
        });
    }
    Map<String, Integer> out = new HashMap<>(newest.size() * 2);
    newest.forEach((k, m) -> out.put(k, m.getQuestionOrder()));
    return out;
}
```

`ReportClassContext.mappingKey` does not exist until PR2. **For PR1, inline the concatenation** as a private static helper on the manager and have PR2 delete it in favour of the shared one. Do not let PR1 depend on PR2.

**Callers to update:** none. `createStudentReportDetailResponse(String, String, String)` is unchanged, so all four call sites (`AssessmentParticipantsManager:782`, `AdminExportManager:486`, `LearnerReportService:188`, `LearnerReportService:316`) are untouched.

**Two latent bugs surfaced while tracing — record, do not fix in PR1:**
1. `:917` `.mark(questionWiseMarks.getMarks())` unboxes `Double` into the DTO's primitive `double`. A null `marks` NPEs, is swallowed at `:930`, and the question vanishes from the report with **no log line**. File separately.
2. The catch at `:930-933` returns `null` for *every* exception with no logging. During PR1 verification, temporarily add `log.warn` there so the byte-diff gate can distinguish "identical output" from "identically broken output".

---

### PR2 — `ReportClassContext` hoist + `ReportPdfRenderService` + release rewire

**Files created: 8. Files modified: 3.**

#### Created

| File | Content |
|---|---|
| `features/learner_assessment/dto/ReportClassContext.java` | §5.1 |
| `features/learner_assessment/dto/context/AssessmentOverviewSnapshot.java` | §5.2 |
| `features/learner_assessment/dto/context/MarksRankSnapshot.java` | §5.2 |
| `features/learner_assessment/dto/context/LeaderBoardSnapshot.java` | §5.2 |
| `features/learner_assessment/dto/context/SectionAggregateSnapshot.java` | §5.2 |
| `features/learner_assessment/dto/context/SectionSnapshot.java` | §5.2 |
| `features/learner_assessment/dto/context/HistogramSpec.java` | §5.2 |
| `features/assessment/service/ReportPdfRenderService.java` | below |

`ReportPdfRenderService` — PR2 version (PR3 adds the `ReportRenderResources` parameter):

```java
@Service
public class ReportPdfRenderService {
    @Autowired private HtmlBuilderService htmlBuilderService;

    /** Pure. No I/O beyond iText's own. No transaction. No state mutation. */
    public byte[] render(StudentReportOverallDetailDto detail,
                         StudentComparisonDto comparison,
                         ReportClassContext ctx) {
        String html = htmlBuilderService.generateStudentReportHtml(
                ctx.getAssessmentName(), detail, comparison,
                ctx.getOptionDistribution(), ctx.getBranding());
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        HtmlConverter.convertToPdf(html, out, new ConverterProperties());
        return out.toByteArray();
    }
}
```

#### Modified

**`features/learner_assessment/service/LearnerReportService.java`**

New public methods:

```java
/** ~7 assessment-wide queries. Call ONCE per job / per request. Not cached (C11). */
public ReportClassContext loadClassContext(String assessmentId, String instituteId);

/** 2 per-student queries. Not cached — the caller already holds the context. */
public StudentComparisonDto buildComparisonFromContext(ReportClassContext ctx,
                                                       String attemptId, String userId);
```

`buildComparisonData(userId, assessmentId, attemptId, instituteId)` — **signature and `@Cacheable(value="comparisonData", key="#assessmentId + ':' + #attemptId")` unchanged** — collapses to:

```java
@Cacheable(value = "comparisonData", key = "#assessmentId + ':' + #attemptId")
public StudentComparisonDto buildComparisonData(String userId, String assessmentId,
                                                String attemptId, String instituteId) {
    ReportClassContext ctx = loadClassContext(assessmentId, instituteId);   // plain this-call, OK
    if (ctx == null || ctx.getOverview() == null) return null;              // preserves :212
    return buildComparisonFromContext(ctx, attemptId, userId);              // plain this-call, OK
}
```

> **Self-invocation trap.** These two are plain `this.` calls and that is **correct** — neither carries `@Cacheable`, `@Async`, or `@Transactional`, so no proxy is needed. If either ever gains such an annotation, the call must move to `self.` (the `@Lazy self` field already exists at `:73-75`). Write this as a code comment above `loadClassContext`.

Method-by-method migration of the existing body:

| Existing | Moves to | Note |
|---|---|---|
| `:211` `findAssessmentOverviewDetails` | `loadClassContext`, wrapped in `AssessmentOverviewSnapshot.from` | |
| `:216` `findParticipantsQuestionOverallDetails` | **stays per-student**, in `buildComparisonFromContext` | |
| `:220` `findMarkRankForAssessment` | `loadClassContext`, mapped to `MarksRankSnapshot` | |
| `:224` `findLeaderBoardForAssessmentAndInstituteId` | `loadClassContext`, mapped to `LeaderBoardSnapshot` | |
| `:225` `buildSmartLeaderboard(full, userId)` | **stays per-student** — it is a userId-dependent window over `ctx.fullLeaderboard` | |
| `:228-235` highest/lowest | `loadClassContext` → `ctx.highestMarks/lowestMarks` | |
| `:238` `buildSectionComparison` | **splits** — see below | |
| `:244` totalMarks derivation | `loadClassContext` → `ctx.totalMarks`, derived from `ctx.sections` totals | Same arithmetic; keep the `> 0 ? sum : 100.0` fallback |
| `:263-267` classAccuracy | `loadClassContext` → `ctx.classAccuracy` | |
| `:247-259` studentAccuracy | **stays per-student** | |

`buildSectionComparison(assessmentId, attemptId, instituteId)` splits into:
- `loadClassContext`: `sectionRepository.findByAssessmentIdAndStatusNotIn` (`:473`) → `List<SectionSnapshot>`, and `findSectionWiseAggregation` (`:479`) → `Map<String, SectionAggregateSnapshot>`.
- new `private List<SectionComparisonDto> buildSectionComparisonFromContext(ReportClassContext ctx, String attemptId)`: keeps only `findByStudentAttemptId(attemptId)` (`:490`) and the per-section arithmetic at `:497-538`, reading section metadata off `SectionSnapshot` and class aggregates off `SectionAggregateSnapshot`.
- The old private `buildSectionComparison` is **deleted**; it has no external callers.

`loadClassContext` additionally populates, in this order (7 queries total):
1. `findAssessmentOverviewDetails` → overview
2. `findMarkRankForAssessment` → marksDistribution
3. `findLeaderBoardForAssessmentAndInstituteId` → fullLeaderboard
4. `sectionRepository.findByAssessmentIdAndStatusNotIn` → sections
5. `findSectionWiseAggregation` → sectionAggregation
6. `questionAssessmentSectionMappingService.getQuestionAssessmentSectionMappingBySectionIds` → `questionOrderByQuestionAndSection` (same merge rule as PR1, X8)
7. `assessmentRepository.findById(assessmentId)` → assessmentName

plus two best-effort, each in its own `try/catch` that logs and continues (matching the existing tolerance at `:324-332`):
- `computeOptionDistribution(assessmentId)` → `optionDistribution`
- `adminCoreServiceClient.getReportBranding(instituteId)` → `branding`

Then derives `totalMarks`, `classAccuracy`, `highestMarks`, `lowestMarks`, `histogram`.

`loadClassContext` is **not** `@Transactional`. Every call is a discrete repository call and the return value is fully materialised; wrapping them in one transaction would hold a connection across the branding HTTP call to admin_core, which is exactly the C1 failure we are avoiding.

**`features/assessment/manager/AssessmentParticipantsManager.java`**

New overload:
```java
public StudentReportOverallDetailDto createStudentReportDetailResponse(
        ReportClassContext ctx, String attemptId, String instituteId);
```
It skips `:791` (sections) and `:798` (mappings) — both come from `ctx` — and runs only `findById(attemptId)` (`:787`) and `findParticipantsQuestionOverallDetails` (`:801`). The 3-arg overload stays and delegates: build a throwaway ctx-lite internally, or keep its current body. **Keep its current body** — delegating would make every existing caller pay for the full `loadClassContext`, which is a regression for `AdminExportManager:486` and `LearnerReportService:188/316`.

Release flow rewire (`:1066-1175`, fixes C9):
- `:1073-1089` — replace the ad-hoc branding + optionDist prefetch with one `learnerReportService.loadClassContext(assessment.getId(), instituteId)`.
- `:1090` — **delete `Map<StudentAttempt, byte[]> reportMap`**. Replace with `Map<StudentAttempt, String> reportFileIds` (attempt → uploaded fileId). `sendNotificationToStudent` at `:1174` must be changed to accept file ids and fetch bytes lazily per email, or (preferred) keep a `byte[]` only for the single attempt currently being emailed. Read `AssessmentReportNotificationService` before choosing; if the email path needs bytes, send inside the loop rather than accumulating.
- `:1102-1103` — call the ctx-aware overload.
- `:1107-1113` — `learnerReportService.buildComparisonFromContext(ctx, attempt.getId(), userId)`.
- `:1116-1125` — `reportPdfRenderService.render(detail, comparison, ctx)`.
- `:1127-1161` — the inline presigned-PUT block is **extracted verbatim** into `ReportPdfUploadService.upload(byte[], String fileName, String source, String sourceId) : String fileId` in `features/assessment/service/`. PR4's worker uses the same method. Do not have two copies of this logic.
- Keep `updateAttemptDataReleaseData(attempt)` on every path, including failure (`:1171`) — the release flow must not stall on a render failure. That behaviour is deliberate and must survive.

**`features/assessment/service/HtmlBuilderService.java`**
No changes in PR2. (PR3 touches it.)

#### PR2 regression list — all 6 consumers of `buildComparisonData`

Byte-diff or field-diff each on a real assessment with ≥3 sections and ≥20 participants:

| # | Consumer | Location | How to verify |
|---|---|---|---|
| 1 | `/comparison` endpoint | `LearnerReportService:196-201` | JSON diff before/after |
| 2 | learner report PDF | `LearnerReportService:304-346` | byte-diff the PDF |
| 3 | AI report PDF | `LearnerReportService:589` | byte-diff the PDF |
| 4 | admin per-student PDF | `AdminExportManager:512` | byte-diff the PDF |
| 5 | release flow | `AssessmentParticipantsManager:1109` | byte-diff the emailed PDF |
| 6 | **`AssessmentDataEnrichmentService:131`** (X5) | `addComparisonContext` | JSON diff the enriched `activity_log` payload |
| 7 | `StudentAnalysisInternalService:237` | feeds admin_core v2 student report | JSON diff `/internal/student-analysis/assessment-history` |

That is 7 sites across 6 distinct call paths. The plan said 5. Do not skip 6 and 7 — they are the invisible ones.

---

### PR3 — render resources (C7)

**Files created: 2. Files modified: 2.**

Created:
- `features/assessment/service/render/ReportFontProviderHolder.java` — `@Component`, builds **one** `FontProvider` at `@PostConstruct`, registers Inter (400/600/700/800) from `src/main/resources/fonts/` via `addFont(byte[], String)`, plus `addStandardPdfFonts()` as fallback. `FontProvider` is thread-safe for read after construction; expose it via a getter and never mutate.
- `features/assessment/service/render/ReportRenderResources.java` — per-job value object:
  ```java
  public class ReportRenderResources {
      private final ConverterProperties converterProperties;  // shared FontProvider, no base URI
      private final String cssBlock;                          // prebuilt, colour-substituted
      public static ReportRenderResources forJob(ReportClassContext ctx, FontProvider shared);
  }
  ```

Modified:
- `HtmlBuilderService:456` — **delete** `<style>@import url('https://fonts.googleapis.com/...')</style>`. This is the whole point of PR3: it is a synchronous network fetch inside the render, potentially once per PDF.
  Add an overload `generateStudentReportHtml(..., ReportBrandingDto branding, String prebuiltCss)` that emits `prebuiltCss` instead of rebuilding the `StringBuilder` CSS at `:453-...`. The existing 5-arg and 4-arg overloads (`:434`, `:440`) delegate with `null`, which means "build CSS inline as today". Zero risk to existing callers.
  Optionally consume `ctx.histogram` in the `:898-918` block — **only the class-invariant parts** (`bucketSize`, `numBuckets`, `bucketCounts`, `maxCount`, `avgBucketIdx`). `studentBucketIdx` at `:906` is per-student and must be computed in the builder from `comparison.getStudentMarks()`. If this adds risk to the byte-diff, skip it; the win is microseconds compared to the font fetch.
- `ReportPdfRenderService` — `render(detail, comparison, ctx, ReportRenderResources res)`; the PR2 3-arg overload remains and builds a default `ReportRenderResources` so `AdminExportManager:526`, `LearnerReportService:338`, and `AssessmentParticipantsManager` keep working unchanged.

**Do not** change `AdminExportManager:474` (question insights) or `LearnerReportService:599` (AI report) in PR3. Different templates, different verification surface.

---

### PR4 — job tables, worker, APIs

**Files created: 21. Files modified: 3.**

#### Created — persistence
| File |
|---|
| `src/main/resources/db/migration/V34__assessment_report_export.sql` |
| `features/assessment/entity/AssessmentReportExportJob.java` |
| `features/assessment/entity/AssessmentReportExportItem.java` |
| `features/assessment/repository/AssessmentReportExportJobRepository.java` |
| `features/assessment/repository/AssessmentReportExportItemRepository.java` |
| `features/assessment/enums/ReportExportJobStatus.java` |
| `features/assessment/enums/ReportExportItemStatus.java` |
| `features/assessment/enums/ReportExportItemSource.java` |

#### Created — service
| File | Key signatures |
|---|---|
| `features/assessment/service/export/ReportExportProperties.java` | `@ConfigurationProperties(prefix="assessment.report-export")` → `int batchSize=10; long batchPauseMs=300; int maxAttempts=150; int staleJobMinutes=20; int maxRetry=2; int assemblyTimeoutSeconds=180;` |
| `features/assessment/service/export/ReportExportExecutorConfig.java` | `@Bean("reportExportExecutor") ThreadPoolTaskExecutor` — core 1, max 1, queue 50, `CallerRunsPolicy`, `setThreadNamePrefix("report-export-")`, `setWaitForTasksToCompleteOnShutdown(false)` |
| `features/assessment/service/export/ReportExportJobFactory.java` | `@Transactional AssessmentReportExportJob createJob(ReportZipInitiateRequest req, String userId, List<AttemptSelection> resolved)` |
| `features/assessment/service/export/ReportZipExportService.java` | `@Async("reportExportExecutor") public void run(String jobId)` |
| `features/assessment/service/export/ReportBatchProcessor.java` | `@Transactional(readOnly=true, propagation=REQUIRED, timeout=15) public RenderPacket loadRenderPacket(String attemptId, ReportClassContext ctx)` |
| `features/assessment/service/export/ReportExportProgressWriter.java` | 5 `REQUIRES_NEW` methods, below |
| `features/assessment/service/export/ReportZipAssemblyService.java` | `public ReportZipAssembleResponse assemble(String jobId)` |
| `features/assessment/service/export/ReportExportContextSerializer.java` | `String toJson(ReportClassContext)` / `Optional<ReportClassContext> fromJson(String, int version)` |
| `features/assessment/service/ReportPdfUploadService.java` | `String upload(byte[] bytes, String fileName, String source, String sourceId)` — extracted in PR2, reused here |

#### Created — DTOs
`features/assessment/dto/export/RenderPacket.java` plus the 9 DTOs in §5.4 under `features/assessment/dto/export/zip/`.

#### Modified
- `AdminExportManager` — +6 orchestration methods (§7).
- `AdminExportController` — +6 endpoints (§7).
- `application.properties` — the 4 keys from plan §8 plus `assessment.report-export.max-retry=2`.

`ReportExportProgressWriter` — the complete surface:

```java
@Service
public class ReportExportProgressWriter {

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordItemResult(String itemId, ReportExportItemStatus status,
                                 ReportExportItemSource source, String fileId,
                                 String errorMessage, boolean incrementRetry);

    /** Backfills student_attempt.report_pdf_file_id. Separate tx so a failure here
     *  never rolls back the item result — the item is authoritative for the export. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void backfillAttemptReportFileId(String attemptId, String fileId);

    /** Recomputes completed/failed/skipped from item rows. Single UPDATE...FROM. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void checkpoint(String jobId);

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void finalizeJob(String jobId, ReportExportJobStatus status, String errorMessage);

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void persistSnapshot(String jobId, String json, int version, boolean drift);

    /** Cheap projected read — see §4.4. */
    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public boolean isCancelled(String jobId);
}
```

`checkpoint` must be a **single derived UPDATE**, not a read-modify-write, so it is immune to interleaving with the item writes:

```sql
UPDATE assessment_report_export_job j SET
    completed_count = c.done, failed_count = c.failed, skipped_count = c.skipped,
    updated_at = now()
FROM (SELECT
        COUNT(*) FILTER (WHERE status='DONE')    AS done,
        COUNT(*) FILTER (WHERE status='FAILED')  AS failed,
        COUNT(*) FILTER (WHERE status='SKIPPED') AS skipped
      FROM assessment_report_export_item WHERE job_id = :jobId) c
WHERE j.id = :jobId;
```

---

## 7. APIs

All on `AdminExportController`, base `/assessment-service/assessment/export`.

| Method | Path | Manager method | Success | Errors |
|---|---|---|---|---|
| POST | `/reports/zip/initiate` | `initiateReportZipExport(user, req)` | 200 `ReportZipInitiateResponse` | 400 empty selection / over cap / institute-assessment mismatch |
| GET | `/reports/zip/status` | `getReportZipExportStatus(user, jobId, instituteId)` | 200 `ReportZipStatusResponse` | 404 unknown job; 403 wrong institute |
| POST | `/reports/zip/continue` | `continueReportZipExport(user, jobId, instituteId)` | 200 `ReportZipContinueResponse` | 409 job is `IN_PROGRESS` or `COMPLETED` |
| POST | `/reports/zip/assemble` | `assembleReportZipExport(user, jobId, instituteId)` | 200 `ReportZipAssembleResponse` | 409 no `DONE` item with a `file_id` |
| GET | `/reports/zip/recent` | `getRecentReportZipExports(user, assessmentId, instituteId, limit)` | 200 `ReportZipRecentResponse` | — |
| POST | `/reports/zip/cancel` | `cancelReportZipExport(user, jobId, instituteId)` | 200 `ReportZipCancelResponse` | 409 terminal job |

Every endpoint takes `instituteId` and **must** verify `job.instituteId.equals(instituteId)` before returning anything. The existing export endpoints have no role check (plan open decision #3); this feature exports bulk student PII, so at minimum enforce the institute match. Do not inherit "no check at all".

`downloadUrl` is produced by `fileService.getPublicUrlForFileId(job.outputFileId)` **at response-build time, on every call** (C10 — the media service hardcodes `expiryDays=1`). Never store it.

---

## 8. Transaction & threading map

### 8.1 Thread ownership

| Method | Thread | Transaction | Proxy hop needed? |
|---|---|---|---|
| `AdminExportController.*` | Tomcat request | none | — |
| `AdminExportManager.initiateReportZipExport` | Tomcat | none (delegates) | — |
| `ReportExportJobFactory.createJob` | Tomcat | `@Transactional` (REQUIRED) | **yes** — separate bean from the manager |
| `ReportZipExportService.run` | `report-export-1` | **none** | **yes** — `@Async`; must be called from `AdminExportManager`, never self-invoked |
| `LearnerReportService.loadClassContext` | `report-export-1` | none | no |
| `ReportBatchProcessor.loadRenderPacket` | `report-export-1` | `@Transactional(readOnly=true)` | **yes** — separate bean from the worker |
| `ReportPdfRenderService.render` | `report-export-1` | **none, ever** | no |
| `ReportPdfUploadService.upload` | `report-export-1` | **none, ever** | no |
| `ReportExportProgressWriter.*` | `report-export-1` | `REQUIRES_NEW` | **yes** — separate bean |
| `ReportZipAssemblyService.assemble` | `report-export-1` (end of run) **or** Tomcat (`/assemble`) | none for the streaming; `REQUIRES_NEW` only for the final job UPDATE | — |

### 8.2 The three self-invocation traps

1. **`@Async` on `ReportZipExportService.run`.** `ReportZipExportService` must never call its own `run` (e.g. a "retry" helper). The dispatcher is `AdminExportManager`. Additionally the dispatch must be deferred to `afterCommit` — precedent at `AiEvaluationService:98-112`:
   ```java
   final String jobId = job.getId();
   if (TransactionSynchronizationManager.isSynchronizationActive()) {
       TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
           @Override public void afterCommit() { reportZipExportService.run(jobId); }
       });
   } else {
       reportZipExportService.run(jobId);
   }
   ```
   Without this the worker's `claimForRun` runs on a different connection before the INSERT is visible, `claimed == 0`, and the job sits at `PENDING` forever. This is the exact failure the AI-evaluation pipeline already hit.

2. **`@Transactional(readOnly)` on `loadRenderPacket`.** It is a separate bean precisely so the proxy applies. If it were a private method on the worker, the annotation would be inert and every lazy access inside would throw or silently open a per-query transaction. **`ReportBatchProcessor` must not be merged into `ReportZipExportService`** even though it is small.

3. **`REQUIRES_NEW` on the progress writer.** Same reason. And critically: the worker loop is **not** `@Transactional`, so `REQUIRES_NEW` never *suspends* an outer transaction. If someone later annotates `run` as `@Transactional`, every `REQUIRES_NEW` call would hold **two** of five connections simultaneously and the pool deadlocks at two concurrent anything. Put a comment on `run`: `// MUST NOT be @Transactional — see ARCHITECTURE §8.2`.

Existing precedent to follow, not to copy blindly: `LearnerReportService` injects `@Lazy LearnerReportService self` (`:73-75`) so `@Cacheable` methods route through the proxy. The export package needs **no** `self` field — every annotated method already lives on a distinct bean. Do not add one.

### 8.3 Worker loop — exact transaction boundaries

```
run(jobId)                                          [thread: report-export-1, NO transaction]
│
├─ claimed = jobRepo.claimForRun(jobId, [PENDING,PARTIAL,FAILED,CANCELLED])   ← tx #1 (implicit, @Modifying)
│  if (claimed == 0) return;                        ← the double-click guard
│
├─ job = jobRepo.findById(jobId)                    ← tx #2 (reads context_snapshot)
├─ ctx = resolveContext(job)                        ← §9; 0 or ~7 queries, each its own tx
│    └─ if built fresh: progressWriter.persistSnapshot(...)                   ← REQUIRES_NEW
├─ resources = ReportRenderResources.forJob(ctx, fontHolder.get())            ← no I/O
├─ items = itemRepo.findProcessable(jobId, maxRetry)                          ← tx #3
│
├─ PHASE A: for each batch of `batchSize`:
│    ├─ if (progressWriter.isCancelled(jobId)) break;                         ← REQUIRES_NEW, projected
│    ├─ for each item in batch:
│    │    ├─ try {
│    │    │    packet = batchProcessor.loadRenderPacket(item.attemptId, ctx)  ← ◆ TX OPEN ~50ms ◆
│    │    │                                                                    (readOnly, timeout 15s)
│    │    │    if (packet == null)            → recordItemResult(SKIPPED)     ← REQUIRES_NEW
│    │    │    else if (packet.existingReportPdfFileId != null && !regenerate)
│    │    │                                   → recordItemResult(DONE, REUSED, thatFileId)
│    │    │    else {
│    │    │      bytes  = renderService.render(packet, ctx, resources)        ← NO TX. seconds.
│    │    │      fileId = uploadService.upload(bytes, ...)                    ← NO TX. network.
│    │    │      recordItemResult(DONE, GENERATED, fileId)                    ← REQUIRES_NEW
│    │    │      backfillAttemptReportFileId(attemptId, fileId)               ← REQUIRES_NEW
│    │    │    }
│    │    │  } catch (Exception e) {
│    │    │      recordItemResult(FAILED, null, null, msg, incrementRetry=true) ← REQUIRES_NEW
│    │    │  }
│    │    └─ bytes = null   // explicit; the only PDF in heap is the current one
│    ├─ progressWriter.checkpoint(jobId)                                      ← REQUIRES_NEW
│    └─ Thread.sleep(batchPauseMs)
│
├─ PHASE B: zipAssembly.assemble(jobId)             ← S3 GETs + temp file, no tx until the final UPDATE
└─ progressWriter.finalizeJob(jobId, COMPLETED|PARTIAL|CANCELLED|FAILED, err) ← REQUIRES_NEW
```

**Connection occupancy**: the only place a connection is held for longer than a single statement is `loadRenderPacket`, ~50 ms × N. For N=100 that is ~5 s of connection-time spread across a ~120 s job — under 5% of one of five connections. This is the C1 budget and the design's central claim; if `loadRenderPacket` ever grows past ~100 ms, revisit.

`loadRenderPacket` internals — the queries that must be inside that transaction, and nothing else:
```java
@Transactional(readOnly = true, timeout = 15)
public RenderPacket loadRenderPacket(String attemptId, ReportClassContext ctx) {
    // JOIN FETCH registration — LearnerReportService:576 documents this exact trap.
    StudentAttempt attempt = studentAttemptRepository
            .findByIdWithRegistration(attemptId).orElse(null);          // NEW query, PR4
    if (attempt == null) return null;
    String status = attempt.getStatus();
    if (status == null || (!"LIVE".equals(status) && !"ENDED".equals(status))) return null;  // → SKIPPED

    StudentReportOverallDetailDto detail = participantsManager
            .createStudentReportDetailResponse(ctx, attemptId, ctx.getInstituteId());
    StudentComparisonDto comparison = learnerReportService
            .buildComparisonFromContext(ctx, attemptId, attempt.getRegistration().getUserId());

    return RenderPacket.builder()... .build();   // every field copied, nothing referenced
}
```
`findByIdWithRegistration` is a new `@Query("SELECT sa FROM StudentAttempt sa JOIN FETCH sa.registration WHERE sa.id = :id")`. Do not rely on `findById` — `StudentAttempt.registration` is an association and the packet needs `userId` and `studentName` off it, read **inside** the transaction.

**The rule the implementer must internalise:** `RenderPacket` is constructed by *copying values*. If any field ends up holding an entity, a projection proxy, or a Hibernate collection, the design is broken and it will surface as `LazyInitializationException` in the render, three lines later, on a different code path.

### 8.4 ZIP assembly (Phase B)

```java
public ReportZipAssembleResponse assemble(String jobId) {
    List<Item> done = itemRepo.findByJobIdAndStatusAndFileIdIsNotNullOrderByCreatedAt(jobId, "DONE");
    if (done.isEmpty()) throw new VacademyException("Nothing to assemble");

    Path tmp = Files.createTempFile("report-export-" + jobId + "-", ".zip");
    try (ZipOutputStream zos = new ZipOutputStream(new BufferedOutputStream(Files.newOutputStream(tmp)))) {
        Set<String> used = new HashSet<>();
        for (Item it : done) {
            String entry = uniquify(sanitize(it.getStudentName()) + "_" + shortId(it.getAttemptId()) + ".pdf", used);
            it.setZipEntryName(entry);                       // written here, not at render time
            zos.putNextEntry(new ZipEntry(entry));
            try (InputStream in = openS3Stream(it.getFileId())) { in.transferTo(zos); }
            zos.closeEntry();
        }
        zos.putNextEntry(new ZipEntry("index.csv"));
        zos.write(buildIndexCsv(jobId).getBytes(StandardCharsets.UTF_8));   // ALL items, incl. failed
        zos.closeEntry();
    }
    long len = Files.size(tmp);
    String fileId = uploadStream(tmp, len, name);            // setFixedLengthStreamingMode(len)
    ... persist output_file_id / name / size, record superseded id (X6), delete tmp in finally
}
```

- `openS3Stream` = `fileService.getPublicUrlForFileId(fileId)` → `URL.openConnection().getInputStream()`. **Do not** use `fileService.getFileFromFileId` — it does `in.readAllBytes()` and would put a whole PDF in heap per entry. Streaming is the point.
- `uploadStream` uses `getPresignedUploadUrl` then `HttpURLConnection.setFixedLengthStreamingMode(len)` + `Files.copy(tmp, conn.getOutputStream())`. Never `conn.setChunkedStreamingMode` (S3 presigned PUTs reject chunked without SigV4 streaming headers) and never `byte[]` (that is C9 at ZIP scale).
- **`finally { Files.deleteIfExists(tmp); }`** — unconditional. A crash between here and the next deploy leaks a 100 MB temp file per attempt.
- Entry naming: `sanitize` strips path separators and anything outside `[A-Za-z0-9 ._-]` (zip-slip and Windows-illegal chars); `uniquify` appends ` (2)`, ` (3)` on collision. Two students named "Rahul Sharma" must not silently become one entry.
- `index.csv` columns: `student_name,user_id,attempt_id,status,source,file_name,error_message`. It lists **all** items — that is how the school sees which 3 of 100 are missing.
- Job filename: `<sanitized-assessment-name>_reports.zip` when complete, `<sanitized-assessment-name>_reports_partial_<done>of<total>.zip` when not. The incompleteness must be legible in the filename itself, because the file outlives the UI that explained it.
- **Stale detection** happens here: for each `DONE` item, `attempt.updatedAt > item.processedAt` → count it. Report it via `staleItemCount`; never auto-re-render (plan §6.3).

### 8.5 Concurrency guards, in one place

| Race | Guard |
|---|---|
| Double-click Initiate | `findFirstBy...StatusIn([PENDING, IN_PROGRESS])` dedup in `AdminExportManager` before creating; returns existing `jobId` with `alreadyRunning: true` |
| Double-click Continue | `claimForRun` conditional UPDATE; rowcount 0 → return current state (this is the real guard; the dedup above is only a nicety) |
| Two pods both resuming | Same `claimForRun`. It is a DB compare-and-set, so it is correct across pods. |
| Cancel during a batch | `isCancelled` at each batch boundary; the worker breaks and `finalizeJob(CANCELLED)` |
| Stale `IN_PROGRESS` after a pod crash | `/status` compares `now() - updated_at > staleJobMinutes`; if exceeded and status is `IN_PROGRESS`, the read path reports it as `PARTIAL`/`FAILED` **and writes that status back** (in `REQUIRES_NEW`) so the job becomes claimable again. Without this write-back, a crashed job is permanently unresumable — `claimForRun` does not accept `IN_PROGRESS`. |
| Assemble while Phase A is running | Allowed and safe — it reads only `DONE` items. It may produce a ZIP that is already outdated; that is acceptable and matches "give me the 30 that worked". |

---

## 9. `context_snapshot` serialization design

### Strategy
A dedicated `ObjectMapper` inside `ReportExportContextSerializer` — **not** the Spring-managed one. The Spring mapper's configuration is shared with the HTTP layer and can be changed by anyone; the snapshot format must be stable across deploys. Configure explicitly:

```java
private static final ObjectMapper M = JsonMapper.builder()
        .addModule(new JavaTimeModule())
        .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)   // ISO-8601, human-readable
        .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
        .serializationInclusion(JsonInclude.Include.NON_NULL)
        .build();
```

`ReportClassContext` declares interface-typed fields but always holds mirrors, so **serialisation is by concrete runtime type and deserialisation needs explicit target types**. Do not try to make Jackson infer this. The serializer owns a private transport record:

```java
private record Snapshot(
        int version, String assessmentId, String instituteId, String assessmentName,
        AssessmentOverviewSnapshot overview,
        List<MarksRankSnapshot> marksDistribution,
        List<LeaderBoardSnapshot> fullLeaderboard,
        Map<String, SectionAggregateSnapshot> sectionAggregation,
        Double totalMarks, Double classAccuracy, Double highestMarks, Double lowestMarks,
        HistogramSpec histogram, ReportBrandingDto branding) {}
```

`toJson` narrows ctx → `Snapshot` (casting the interface fields to their known mirror types, which is safe because `loadClassContext` is the only producer). `fromJson` reads `Snapshot` and widens back. This keeps every Jackson type fully concrete and leaves the `@JsonIgnore` markers on `ReportClassContext` as documentation of intent rather than load-bearing machinery.

### Versioning
`CURRENT_VERSION = 1`, written into both the JSON (`version`) and the `context_snapshot_version` column. Two copies deliberately: the column is queryable for a migration audit ("how many live jobs are on v1?") without parsing 50 KB blobs.

Compatibility contract:
- **Additive-only within a version.** New optional field → keep version 1, `FAIL_ON_UNKNOWN_PROPERTIES` disabled handles both directions.
- **Removing or retyping a field** → bump `CURRENT_VERSION`. Old snapshots then fail the version check and take the rebuild path below.
- The version check is `snapshot.version() == CURRENT_VERSION`. Not `<=`. A snapshot written by a *newer* pod during a rolling deploy must also be rejected and rebuilt rather than half-read.

### Deserialisation failure → rebuild fresh, flag drift (D5)

```java
ReportClassContext resolveContext(AssessmentReportExportJob job) {
    if (job.getContextSnapshot() != null) {
        Optional<ReportClassContext> restored =
                serializer.fromJson(job.getContextSnapshot(), job.getContextSnapshotVersion());
        if (restored.isPresent()) {
            ReportClassContext ctx = restored.get();
            hydrateNonSnapshotted(ctx);          // sections, question order map, option dist
            return ctx;
        }
        log.warn("[report-export] context snapshot unreadable for job {} (version {}). "
               + "Rebuilding fresh — class statistics in this run may differ from earlier runs.",
                 job.getId(), job.getContextSnapshotVersion());
        meterRegistry.counter("report_export.context_snapshot_drift").increment();
    }
    ReportClassContext ctx = learnerReportService.loadClassContext(
            job.getAssessmentId(), job.getInstituteId());
    progressWriter.persistSnapshot(job.getId(), serializer.toJson(ctx), CURRENT_VERSION,
                                   job.getContextSnapshot() != null);   // drift = true iff we replaced one
    return ctx;
}
```

**Justification for choosing rebuild over fail.** Three options were on the table.

*Fail the job* is the "safe" answer and it is wrong here. The snapshot becomes unreadable for exactly one realistic reason — a code change to the DTO shape between the first run and the resume. That is a deploy, i.e. a routine event on a job that may be a day old (plan §7 explicitly supports resuming yesterday's `PARTIAL` job). Failing means an admin's 30 completed reports become unresumable because of an unrelated release. The blast radius is wrong.

*Silently rebuild* trades a visible failure for an invisible correctness regression — precisely the §6.3 bug the snapshot exists to prevent, reintroduced without a trace.

*Rebuild + flag* keeps the job deliverable and makes the inconsistency **legible at three levels**: a WARN log with the job id, a `context_export.drift` counter for alerting, and `context_drift: true` on the status response so the UI can say "class statistics were recalculated partway through this export". The admin can then re-run with `regenerate: true` if the inconsistency matters for their use, or ship it if it does not. The decision moves to the person who can judge it. That is the whole argument.

`hydrateNonSnapshotted` runs on both paths and must be idempotent — it populates the three `@JsonIgnore` fields from live queries. On the restore path it is the *only* DB work the context needs (3 queries instead of 7+2 HTTP).

---

## 10. Data flow for the three key scenarios

### (a) Fresh 100-student export, happy path

| # | Actor | Action | DB | S3 |
|---|---|---|---|---|
| 1 | Tomcat | `POST /reports/zip/initiate` | — | — |
| 2 | `AdminExportManager` | validate institute↔assessment; resolve `attemptIds` or run the filter query | 1 SELECT (+1 if filter) | — |
| 3 | | enforce cap (100 ≤ 150); dedup against in-flight | 1 SELECT | — |
| 4 | `ReportExportJobFactory` | `@Transactional`: INSERT job (`PENDING`), INSERT 100 items (`PENDING`) via `saveAll` batched | 1 tx, 2 statements | — |
| 5 | `AdminExportManager` | register `afterCommit` → `reportZipExportService.run(jobId)` | — | — |
| 6 | Tomcat | 200 `{job_id, total_count:100, already_running:false, status:"PENDING"}` | — | — |
| 7 | `report-export-1` | `claimForRun(jobId, [PENDING,...])` → 1 | 1 UPDATE | — |
| 8 | | `loadClassContext` (7 queries) + branding HTTP + option distribution | 7 SELECT | — |
| 9 | | `persistSnapshot(v1, ~26 KB)` | 1 UPDATE (REQUIRES_NEW) | — |
| 10 | | `findProcessable` → 100 items | 1 SELECT | — |
| 11 | ×100 | `loadRenderPacket` (tx, ~50 ms, 3 queries) | 100 tx | — |
| 12 | ×100 | `render` (no tx, ~1 s) | — | — |
| 13 | ×100 | `upload` → presigned PUT | — | 100 POST(presign) + 100 PUT |
| 14 | ×100 | `recordItemResult(DONE, GENERATED, fileId)` + `backfillAttemptReportFileId` | 200 tx | — |
| 15 | ×10 | `checkpoint` at each batch boundary; `sleep(300ms)` | 10 UPDATE | — |
| 16 | | Phase B: stream 100 objects into a temp ZIP + `index.csv` | 1 SELECT | 100 GET |
| 17 | | upload ZIP, `setFixedLengthStreamingMode` | — | 1 presign + 1 PUT |
| 18 | | `finalizeJob(COMPLETED)`; `output_file_id/name/size` set; delete temp | 1 UPDATE | — |
| 19 | Tomcat | `/status` poll → `COMPLETED`, `download_url` resolved fresh | 1 SELECT | 1 presign-GET |

Totals: ~320 queries (plan §10 predicted ~307 — the delta is the item bookkeeping, which the plan's per-student figure excluded), 100 renders, 201 S3 writes, 100 S3 reads, ~3 s of connection time.

### (b) Pod crash at 30/100, then Continue

| # | Actor | Action | DB | S3 |
|---|---|---|---|---|
| 1 | | Pod dies mid-batch-4. Thread gone, temp file gone (ephemeral disk). | — | — |
| — | **State on disk** | job `IN_PROGRESS`, `updated_at` frozen at the last checkpoint; 30 items `DONE` each with a `file_id`; 70 `PENDING`; 30 PDFs **durable in S3**; `context_snapshot` **durable** | | |
| 2 | Admin | `GET /reports/zip/status` | 1 SELECT | — |
| 3 | `AdminExportManager` | `now() - updated_at > 20 min` && `IN_PROGRESS` → stale. Write back `PARTIAL` + `error_message="Worker terminated during batch 4"` | 1 UPDATE (REQUIRES_NEW) | — |
| 4 | | respond `{status:"PARTIAL", completed_count:30, resumable:true, remaining_count:70, assemblable:true, download_url:null}` | — | — |
| 5 | Admin | `POST /reports/zip/continue` | — | — |
| 6 | `AdminExportManager` | `claimForRun(jobId, [PARTIAL,FAILED,CANCELLED])` → **1**; `resume_count++` | 1 UPDATE | — |
| 7 | | `afterCommit` → `run(jobId)` | — | — |
| 8 | `report-export-1` | `claimForRun` again → **0** (already `IN_PROGRESS`) | | |
| — | ⚠️ | **This is a real trap.** If both the endpoint and the worker call `claimForRun`, the worker always loses. Decide once: **the endpoint claims, the worker does not re-claim when invoked via Continue.** Implement as `run(jobId, boolean alreadyClaimed)`; the initiate path passes `false`, the continue path passes `true`. Both are dispatched `afterCommit`. | | |
| 9 | | `resolveContext`: `context_snapshot` present, version 1 → **restore**. Class averages, ranks, leaderboard, branding are **byte-identical to run 1**. | 0 SELECT for aggregates | — |
| 10 | | `hydrateNonSnapshotted` → sections, question-order map, option distribution | 3 SELECT | — |
| 11 | | `findProcessable(jobId, 2)` → 70 items (`PENDING` only; nothing `FAILED` here) | 1 SELECT | — |
| 12 | ×70 | Phase A as in (a) | 210 tx | 140 writes |
| 13 | | Phase B over **all 100** `DONE` items | 1 SELECT | 100 GET + 1 PUT |
| 14 | | previous `output_file_id` (none here) → nothing superseded | — | — |
| 15 | | `finalizeJob(COMPLETED)` | 1 UPDATE | — |

The §6.3 guarantee in one line: **step 9 does zero aggregate queries**, so the 70 new reports quote the same class average and the same ranks as the first 30 — even if 5 students submitted in between.

### (c) "Download 30 completed" on a PARTIAL job

| # | Actor | Action | DB | S3 |
|---|---|---|---|---|
| 1 | Admin | `POST /reports/zip/assemble?jobId=` | — | — |
| 2 | `AdminExportManager` | verify institute; `countByJobIdAndStatus(DONE) > 0` | 2 SELECT | — |
| 3 | `ReportZipAssemblyService` | `findByJobIdAndStatusAndFileIdIsNotNullOrderByCreatedAt` → 30 | 1 SELECT | — |
| 4 | | create temp ZIP; for each: presign-GET, stream into the entry, set `zip_entry_name` | — | 30 presign + 30 GET |
| 5 | | build `index.csv` from **all 100** items (30 done, 70 pending, statuses and reasons) | 1 SELECT | — |
| 6 | | stale check: `attempt.updated_at > item.processed_at` → `staleItemCount` | 1 SELECT | — |
| 7 | | `close()` the ZIP (central directory written **here** — this is why a crashed temp file is worthless) | — | — |
| 8 | | upload with `setFixedLengthStreamingMode(len)`, name `midterm_reports_partial_30of100.zip` | — | 1 presign + 1 PUT |
| 9 | | if a prior `output_file_id` existed: append it to `superseded_file_ids`, log WARN. **No S3 delete** (X6). | 1 UPDATE | — |
| 10 | | set `output_file_id/name/size`; **status stays `PARTIAL`** | (same UPDATE) | — |
| 11 | | `finally` delete the temp file | — | — |
| 12 | | 200 `{included_count:30, total_count:100, output_file_name:"...partial_30of100.zip", download_url, partial:true}` | — | 1 presign-GET |
| 13 | | `resumable` remains `true`. Continue is still offered, and running it supersedes this ZIP. | — | — |

Elapsed ~3 s. **Zero renders.** That is the whole payoff of D1/D2.

---

## 11. Error taxonomy

Every row in plan §9 mapped to the exact handler.

| Failure | Detected at | Handler | Status written | Job impact |
|---|---|---|---|---|
| Attempt not evaluated / not submitted | `ReportBatchProcessor.loadRenderPacket` — `status` not in (`LIVE`,`ENDED`) → returns `null` | worker's `if (packet == null)` | item `SKIPPED`, `error_message="Attempt not submitted (status=X)"` | `skipped_count++`; a job of all-skipped ends `COMPLETED` with `completed_count=0` and `assemblable=false` |
| Attempt row missing | same, `findByIdWithRegistration` empty → `null` | same | item `SKIPPED`, reason `"Attempt not found"` | — |
| Render throws (iText, malformed HTML, OOM in one doc) | `renderService.render` | worker per-item `catch (Exception)` | item `FAILED`, `retry_count++`, message = `e.getClass().getSimpleName() + ": " + e.getMessage()` truncated to 2000 | retried on Continue while `retry_count < 2` |
| PDF upload fails (non-2xx, timeout) | `ReportPdfUploadService.upload` **throws** on non-2xx | same catch | item `FAILED` (**never `DONE`**), `file_id` stays NULL | ⚠️ `upload` must **throw**, not log-and-return-null like the current release flow at `:1155`. A `DONE` item with a NULL `file_id` is silently dropped by assembly. Fix the extracted method's contract in PR2. |
| `backfillAttemptReportFileId` fails | its own `REQUIRES_NEW` | caught and logged **inside** the writer | item stays `DONE` | Deliberate: the export is authoritative; the attempt backfill is an optimisation. Never let it fail the item. |
| Pod restart mid-job | `/status` — `IN_PROGRESS` && `now()-updated_at > staleJobMinutes` | `AdminExportManager.getReportZipExportStatus` writes back | job → `PARTIAL` (or `FAILED` if `completed_count == 0`) | becomes claimable; `resumable` + `assemblable` computed from item counts |
| Snapshot unreadable on resume | `ReportExportContextSerializer.fromJson` → `Optional.empty()` | `resolveContext` | `context_drift = true`, new snapshot persisted | job proceeds; §9 |
| `loadClassContext` itself fails (assessment deleted, DB down) | `run`, outside the per-item catch | worker's outer `catch (Exception)` | `finalizeJob(FAILED, msg)` | no items touched; fully resumable |
| Final ZIP upload fails | `ReportZipAssemblyService.uploadStream` throws | Phase B caller | `finalizeJob(PARTIAL, "ZIP assembly failed: …")`; items untouched | `/assemble` retries **upload only** — no re-render |
| Temp file cannot be created (disk full) | `Files.createTempFile` | same | same as above | — |
| Admin cancels | `progressWriter.isCancelled` at the batch boundary | worker `break` | `finalizeJob(CANCELLED)`; temp file deleted | `DONE` items retained; both resumable and assemblable |
| Continue clicked twice | `claimForRun` rowcount 0 | `AdminExportManager.continueReportZipExport` | none | returns current state, `already_running:true` |
| Initiate clicked twice | dedup `findFirstBy...StatusIn([PENDING,IN_PROGRESS])` | `AdminExportManager.initiateReportZipExport` | none | returns existing `job_id`, `already_running:true` |
| Attempt re-evaluated after its PDF was generated | assembly: `attempt.updated_at > item.processed_at` | `ReportZipAssemblyService` | none — **never auto-re-renders** | `stale_item_count` on `/status`; admin decides (plan §6.3) |
| Executor queue full (50 queued jobs) | `ThreadPoolTaskExecutor` | `CallerRunsPolicy` | — | ⚠️ the **Tomcat request thread** runs the export. At 50 queued jobs something is already very wrong; `CallerRunsPolicy` is chosen as backpressure over `AbortPolicy` (which would lose the job silently while the row says `PENDING`). Log at ERROR when queue depth > 10. |
| Item `retry_count` reaches 2 | `findProcessable` excludes it | — | stays `FAILED` | appears in `failures[]` forever; `remaining_count` excludes it, so `resumable` correctly goes false |

Two invariants worth asserting in code:
- **I1:** an item is `DONE` ⟹ `file_id != null`. Assert in `recordItemResult`; throw `IllegalStateException` otherwise. This is the one invariant whose violation is silent and unrecoverable.
- **I2:** `completed_count + failed_count + skipped_count ≤ total_count`. The derived `checkpoint` UPDATE guarantees it structurally; a read-modify-write would not.

---

## 12. Verification gates (run these BEFORE writing code)

### G1 — `StudentReportAnswerReviewDto` entity-freeness (plan §5.6)

**Already run during this design. Result: PASS.** Reproduce it as follows and confirm before trusting it.

```bash
cd assessment_service/src/main/java/vacademy/io/assessment_service
cat features/assessment/dto/admin_get_dto/response/StudentReportAnswerReviewDto.java
cat features/rich_text/dto/AssessmentRichTextDataDTO.java
grep -n -A4 "toDTO" features/rich_text/entity/AssessmentRichTextData.java
```

Findings:
- Every field is `String`, `Integer`, `Long`, `double`, or `AssessmentRichTextDataDTO`. No entity type appears.
- `AssessmentRichTextDataDTO` has three `String` fields and its entity constructor **copies** `id`/`type`/`content`.
- `AssessmentRichTextData.toDTO()` is `new AssessmentRichTextDataDTO(this.id, this.type, this.content)` — a copy, not a wrapper.
- `StudentReportOverallDetailDto` is `String`, `String`, `ParticipantsQuestionOverallDetailDto`, `Map<String, List<StudentReportAnswerReviewDto>>`.

**One caveat that gates the design:** `ParticipantsQuestionOverallDetailDto` is a projection interface (X1) over a native query. Native-query interface projections are materialised eagerly from a `Tuple`, so the proxy is safe to read after the transaction closes — but **verify empirically**, because this is the field that would break the transaction boundary:

```java
// throwaway test in the worker path, or a @SpringBootTest
@Transactional(readOnly = true)
ParticipantsQuestionOverallDetailDto load() { return repo.findParticipantsQuestionOverallDetails(a, i, t); }
// then, OUTSIDE the transaction:
assertDoesNotThrow(() -> dto.getRank());
```

**Gate:** if the outside-transaction read throws, `RenderPacket` must copy `ParticipantsQuestionOverallDetailDto` into a concrete mirror (a 4th mirror class, same pattern as §5.2) inside `loadRenderPacket`. The transaction boundary stays where it is either way — this only changes whether one more mirror class is needed. **It does not invalidate the design.**

### G2 — `convertToPdf` timing with and without network egress (plan §3)

This is the number that sets `batch-size`, `max-attempts`, and every wall-clock claim in plan §10. Until it exists, all of §10 is a guess.

```java
// scratch @SpringBootTest against a real assessment with ~50 questions
String html = htmlBuilderService.generateStudentReportHtml(name, detail, comparison, optDist, branding);
for (int i = 0; i < 10; i++) {                       // 3 warmup + 7 measured; report the median
    long t0 = System.nanoTime();
    HtmlConverter.convertToPdf(html, new ByteArrayOutputStream(), new ConverterProperties());
    log.info("render {} ms", (System.nanoTime() - t0) / 1_000_000);
}
```

Run twice:
- **A:** normally (DNS + egress to `fonts.googleapis.com` available).
- **B:** with egress blocked. Simplest reliable method: add `127.0.0.1 fonts.googleapis.com` to `/etc/hosts` on the test machine, or run the test JVM with `-Dhttp.proxyHost=127.0.0.1 -Dhttp.proxyPort=1` so the fetch fails fast. Confirm you actually blocked it — a cached DNS entry plus a warm HTTP connection will hide the effect.

Also run **C:** the PR3 shape — HTML with the `@import` removed and a shared `ConverterProperties` + `FontProvider`.

| Result | Decision |
|---|---|
| A ≈ B (< 15% apart) | The font import is not fetched per render (iText likely ignores remote `@import` entirely). **PR3's font work is not the win it was assumed to be** — downgrade PR3 to CSS prebuild only, or drop it. Record the measurement in the plan doc so nobody re-litigates. |
| A ≫ B, and B is fast | The fetch happens and *succeeds*, costing real time per render. PR3 is high-value; ship it before PR4 and size batches from C. |
| B ≫ A | The fetch happens and *blocks/times out* when egress is unavailable. This is the worst case and makes PR3 a **prerequisite**, not an optimisation — a prod environment without egress would make every export pathologically slow. |
| median(C) | This is the number that sets everything: `batch-size ≈ max(5, round(3000 / medianC_ms))` (≈3 s of work between checkpoints), and `max-attempts` such that `medianC × maxAttempts < 10 min`. |

**Both gates must be run before PR4 begins.** G1 gates the transaction boundary; G2 gates the configuration and the UX copy. Neither gates PR1.

---

## 13. Implementation sequence

Dependency-ordered. Each step is independently mergeable unless marked.

**Phase 0 — measure (no code shipped)**
1. Run gate **G1**. Record PASS/FAIL and whether a `ParticipantsQuestionOverallDetailDto` mirror is needed.
2. Run gate **G2** (A/B/C). Record the three medians in `ASSESSMENT_BULK_REPORT_EXPORT_PLAN.md` §3, replacing the "Measure before PR3" note.
3. Decide `batch-size` and `max-attempts` from C. Everything downstream reads these.

**Phase 1 — PR1 (ship independently; valuable with or without the ZIP feature)**
4. Add the temporary `log.warn` at `AssessmentParticipantsManager:930` so the diff gate is meaningful.
5. Implement `buildQuestionOrderMap` with the created-at merge (X8) and thread it through `:805 → :825 → :845 → :864`.
6. Byte-diff `generateStudentReportHtml` output before/after on a real assessment with ≥50 questions and ≥3 sections. **Must be identical.**
7. Confirm the warn added in step 4 fired zero times. If it fired, you found latent bug #1 (`:917` NPE) — file it, do not fix it here.
8. Remove the temporary log. Merge.

**Phase 2 — PR2 (highest risk; do not bundle with anything)**
9. Create the 6 snapshot mirrors + `HistogramSpec` (§5.2). Pure data classes, no behaviour.
10. Create `ReportClassContext` (§5.1).
11. Implement `LearnerReportService.loadClassContext` — 7 queries + 2 best-effort. Not `@Transactional`.
12. Implement `buildComparisonFromContext` + `buildSectionComparisonFromContext`; delete the old private `buildSectionComparison`.
13. Re-express `buildComparisonData` over the two. **Signature and `@Cacheable` unchanged.** Add the self-invocation comment.
14. Run the **7-site regression list** (§6, PR2). Do not proceed on any diff.
15. Add the `createStudentReportDetailResponse(ctx, attemptId, instituteId)` overload; leave the 3-arg one alone.
16. Extract `ReportPdfRenderService` from `AssessmentParticipantsManager:1116-1125`.
17. Extract `ReportPdfUploadService` from `:1127-1161`. **Change its contract to throw on non-2xx** (§11) — the current code logs and continues.
18. Rewire the release flow `:1066-1175`: one `loadClassContext`, ctx-aware detail, `buildComparisonFromContext`, `ReportPdfRenderService`, `ReportPdfUploadService`, and **delete `reportMap`** (C9). Read `AssessmentReportNotificationService` first to decide how the email gets its bytes.
19. Verify the release flow end-to-end on a real assessment: emails still send, `report_pdf_file_id` still set, unreleased-but-broken attempts still get `updateAttemptDataReleaseData`. Merge.

**Phase 3 — PR3 (skip or downsize per G2)**
20. Bundle Inter into `src/main/resources/fonts/`; build `ReportFontProviderHolder` (singleton, `@PostConstruct`).
21. Build `ReportRenderResources.forJob`.
22. Remove `HtmlBuilderService:456`'s remote `@import`; add the `prebuiltCss` overload with existing overloads delegating `null`.
23. Add the 4-arg `render` overload on `ReportPdfRenderService`; keep the 3-arg one.
24. Byte-diff PDFs again (fonts change glyph metrics — expect a **visual** diff, so this is a visual review, not a byte gate). Merge.

**Phase 4 — PR4 (all new surface; low risk, high volume)**
25. `V34__assessment_report_export.sql` including the three extra columns and the extra index (§4.1). Apply to a real DB and verify — the repo has a history of duplicate-version collisions (`42ba8fe9b`); check no other branch has claimed V34.
26. Entities + repositories + enums. Verify `claimForRun` rowcount semantics with a two-connection manual test.
27. `ReportExportProperties` + `application.properties` keys.
28. `ReportExportExecutorConfig`. **Verify by name** that no bean called `taskExecutor` exists and that existing `@Async` methods still resolve to `SimpleAsyncTaskExecutor` (C2).
29. `ReportExportContextSerializer` + a round-trip unit test: build a ctx, `toJson`, `fromJson`, assert every snapshotted field equal and every `@JsonIgnore` field null. **This test is the one that would have caught X1.**
30. `ReportBatchProcessor` + the new `findByIdWithRegistration` query. Unit-test that the returned `RenderPacket` survives being read on another thread after the transaction closes.
31. `ReportExportProgressWriter` incl. the derived `checkpoint` UPDATE and invariant I1.
32. `ReportPdfUploadService` stream variant for the ZIP (`setFixedLengthStreamingMode`).
33. `ReportZipAssemblyService` — streaming, `index.csv`, sanitize/uniquify, stale detection, unconditional temp cleanup.
34. `ReportZipExportService.run(jobId, alreadyClaimed)` — the batch loop, exactly per §8.3. Add the `// MUST NOT be @Transactional` comment.
35. `ReportExportJobFactory` + selection resolution (explicit ids **and** filter).
36. `AdminExportManager` +6 methods, incl. the stale-job write-back and per-call `downloadUrl` resolution.
37. `AdminExportController` +6 endpoints with the institute-ownership check on every one.
38. Work the plan §12 testing checklist. The five that matter most, in order: **snapshot consistency across a resume** (the §6.3 guarantee, and the easiest thing to regress); **upload-failure item stays `FAILED`** (invariant I1); **double-click Continue** (the §8.5(b) claim-ownership trap); **heap flat across 150 students** (C9); **link from a >24 h job still resolves** (C10).

---

## 14. Risks, assumptions & open questions

### Risks
| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| R1 | PR2 changes report output in a way the byte-diff misses (e.g. floating-point ordering in `totalMarks` summation) | Medium | Diff the **HTML**, not just the PDF — PDFs embed timestamps and are not byte-stable. Compare the `generateStudentReportHtml` string. Same for the 6 JSON consumers. |
| R2 | X1 discovered late → resume throws `InvalidDefinitionException` on `readValue` | **Was high, now mitigated** | The step-29 round-trip test is mandatory and must run before step 34. |
| R3 | `CallerRunsPolicy` runs an export on a Tomcat thread under load | Low | Log ERROR above queue depth 10; the queue is 50 and a job is minutes, so reaching it means hours of backlog. Consider rejecting at `initiate` when depth > 20. |
| R4 | Single worker across all institutes → tenant A's 150-student export blocks tenant B for ~4 minutes | **Certain by design** (C1) | `PENDING` must render distinctly from `IN_PROGRESS` in the UI, with an explicit "queued behind another export" message. This is a product decision that C1 forces; surface it, do not hide it. |
| R5 | `updated_at` is `insertable=false, updatable=false` on the entity (following `AiEvaluationProcess`), so staleness detection depends on the DB updating it | Medium | The DDL has `DEFAULT now()` but **no `ON UPDATE` trigger** — Postgres does not support that natively. **Either** add a `BEFORE UPDATE` trigger in V34, **or** set `updated_at` explicitly in every `@Modifying` query (the §4.4 `claimForRun` and §6 `checkpoint` already do). Choose explicit sets; a trigger surprises future readers. Verify `finalizeJob` and `recordItemResult` also set it. |
| R6 | Orphaned superseded ZIPs accumulate in S3 (X6) | Certain, low impact | `superseded_file_ids` records them. Bounded by resume count × jobs. Escalate to the retention decision (open #2). |
| R7 | `index.csv` and PDF filenames leak student names into a link that may be forwarded | Certain | This is the feature. It makes open question #1 (link expiry) a **required** decision before launch, not an optional one. |

### Assumptions carried from the plan (overridable, not re-litigated)
- Class context is snapshotted and reused verbatim on resume (§6.3 / D3).
- Partial ZIPs are assembled lazily on request (§6.4).
- Stale-since-generation attempts are surfaced, never silently re-rendered (§6.3).

### New assumptions introduced by this document (flag if wrong)
- **A1:** `optionDistribution` is excluded from the snapshot (§5.1). If reviewers consider per-question response percentages part of the consistency guarantee, remove one `@JsonIgnore` and add it to the `Snapshot` record.
- **A2:** On Continue, the **endpoint** owns the claim and the worker does not re-claim (§10b step 8). Any other split has a lost-update race.
- **A3:** Snapshot deserialisation failure rebuilds + flags rather than failing the job (D5, §9).
- **A4:** The 3-arg `createStudentReportDetailResponse` keeps its current body rather than delegating through a full `loadClassContext` — delegation would be a latency regression for three existing callers.

### Open questions — unchanged from plan §11, plus one
1. **Link expiry / audience.** Admin-only (1 day) vs forwarded to the school (7–30 days, unauthenticated URL carrying student PII). Recommendation stands: 7 days with an explicit UI warning. **Now blocking** — see R7.
2. **Retention.** `ON DELETE CASCADE` covers item rows, not S3 objects, and X6 shows there is no delete primitive at all. Needs media-service ownership.
3. **RBAC.** This document mandates the institute-ownership check as a floor. Whether bulk PII export needs a *role* above the existing CSV export is still a product decision.
4. **`output_file_id` as a single column** assumes one ZIP per job. If part-splitting is likely, a child table now avoids a migration later.
5. **Route trees.** `assessment` only, or also `homework-creation`?
6. **New — X6 escalation.** Does the media service need an internal "delete object by file id" that works for presigned-upload files (no `user_to_file` row)? Without it, retention is unimplementable for every S3 object this feature and the release flow create.
