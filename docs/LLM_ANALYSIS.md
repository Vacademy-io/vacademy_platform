# LLM Analysis (AI Report)

> Learner-facing pipeline that turns an **assessment/slide attempt** into a rich, LLM-generated **AI Report** — performance analysis, Bloom's taxonomy breakdown, misconceptions, flashcards, confidence estimation, and a recommended learning path. Spans `assessment_service` → `admin_core_service` → `frontend-learner-dashboard-app`, built on the `activity_log` table and an hourly cron + on-demand processor.

**Related doc:** [Student Analysis Report](./STUDENT_ANALYSIS_REPORT.md) — the admin-facing per-learner date-range report that *consumes* the `processed_json` this pipeline produces. They are different features; see [Relationship](#11-relationship-to-student-analysis-report).

---

## 1. What it is

When a learner submits an assessment (or a quiz / question / assignment slide), the platform asynchronously ships an **enriched** snapshot of that attempt to `admin_core_service`, stores it as a `raw` row in `activity_log`, and later runs it through an LLM to produce a structured insights JSON (`processed_json`). The learner sees this as the **"AI Report"** page after their assessment — charts, a confidence breakdown, topic radar, Bloom's taxonomy bars, misconception cards, behavioural insights, flashcards, and a learning path.

Key properties:
- **Learner-facing** output (the admin equivalent rollup is the separate [Student Analysis Report](./STUDENT_ANALYSIS_REPORT.md)).
- **Per attempt** (one `activity_log` row per submission).
- **Two processing triggers:** an **hourly cron** batch job, plus **on-demand** synchronous processing when a learner opens the report before the cron has run.
- **Microservice split:** `assessment_service` captures + enriches; `admin_core_service` stores + LLM-processes + serves; communication is **HMAC-authenticated**.

---

## 2. Architecture at a glance

```
LEARNER SUBMITS ASSESSMENT (or quiz/question/assignment slide)
  │
  ▼  assessment_service
LearnerAssessmentAttemptStatusManager.submitAssessment()        (offline: AdminOfflineDataEntryManager)
  └─ AssessmentLLMAnalyticsService.sendAssessmentDataForAnalysisAsync()
       └─ AssessmentDataEnrichmentService.buildEnrichedAssessmentData()   // question/option text, marks, status, class comparison
            └─ AdminCoreServiceClient.saveAssessmentRawDataAsync()        // HMAC, fire-and-forget
                 │  POST /admin-core-service/llm-analytics/assessment
                 ▼  admin_core_service
LearnerLLMAnalyticsController.saveAssessmentData()
  └─ LLMActivityAnalyticsService.saveAssessmentRawData()
       └─ INSERT activity_log (status='raw', source_type='llm_assessment', source_id=assessmentId, raw_json=…)

PROCESSING (two paths converge on the same logic)
  ├─ HOURLY CRON: ActivityLogProcessorService.processRawActivityLogs()  @Scheduled("0 0 * * * *")
  │     fetch ≤20 raw/failed rows → batches of 10 → processActivityLog()
  └─ ON-DEMAND:  POST /llm-analytics/process-on-demand → processOnDemand(userId, sourceId)
        processActivityLog():
          └─ StudentAnalyticsLLMService.generateStudentInsights(rawJson, sourceType)
               └─ OpenRouter /api/v1/chat/completions (model priority "analytics", fallback, 120s)
          └─ UPDATE activity_log SET processed_json=…, status='processed'   (or 'failed')

LEARNER VIEWS REPORT (frontend-learner-dashboard-app)
  routes/assessment/reports/ai-report/index.tsx
    ├─ GET  /llm-analytics/processed-logs?userId=&sourceId=assessmentId    // already processed?
    ├─ POST /llm-analytics/process-on-demand?userId=&sourceId=             // if not, generate now
    └─ render <AIReportDetailsPage> from processed_json
```

---

## 3. Data model — `activity_log`

The pipeline reuses the learner-tracking `activity_log` table. Migration **`V62__Add_status_and_json_columns_to_activity_log.sql`** added the LLM columns:

```sql
ALTER TABLE activity_log ADD COLUMN status        VARCHAR(50);
ALTER TABLE activity_log ADD COLUMN raw_json      TEXT;
ALTER TABLE activity_log ADD COLUMN processed_json TEXT;
CREATE INDEX idx_activity_log_status ON activity_log (status) WHERE status IS NOT NULL;
```

**Entity:** `admin_core_service/.../features/learner_tracking/entity/ActivityLog.java`

| Column | Type | Meaning |
|--------|------|---------|
| `id` | String PK | UUID |
| `source_id` | String | **assessment_id** for assessments; **slide_id** for quiz/question/assignment |
| `source_type` | String(255) | `llm_assessment` \| `llm_quiz` \| `llm_question` \| `llm_assignment` |
| `user_id` | String(255) | learner |
| `slide_id` | String(255) | set for slide types; NULL for assessments |
| `start_time` / `end_time` | Timestamp | session window |
| `status` | String(50) | `raw` → `processed` / `failed` |
| `raw_json` | TEXT | enriched, unprocessed input (questions, options, answers, status, timing, class comparison) |
| `processed_json` | TEXT | LLM insights (see §7) — or `{"error":"…","timestamp":"…"}` when `failed` |
| `created_at` / `updated_at` | Timestamp | |

> There is **no `institute_id` column** on `activity_log`.

**Status flow:** `raw` (just captured) → picked up by cron or on-demand → `processed` (insights stored) or `failed` (error stored in `processed_json`). Failed rows are retried by the next cron run (the fetch query selects both `raw` and `failed`).

---

## 4. API reference

Controller: `admin_core_service/.../features/learner_tracking/controller/LearnerLLMAnalyticsController.java`
Base path: **`/admin-core-service/llm-analytics`**

### Client APIs (JWT)
| Method / Path | Purpose |
|---|---|
| `GET /processed-logs?userId=&slideId=&sourceId=` | Fetch already-processed report(s). **Either** `slideId` or `sourceId` required (400 otherwise). Returns `ProcessedActivityLogsResponse { activityLogs[], count }`. |
| `POST /process-on-demand?userId=&sourceId=` | Synchronously process the latest `raw`/`failed` row for user+source and return it. Returns cached result if already `processed`; empty list if there's no captured data yet or processing `failed`. |

### Testing / manual APIs (open in dev)
| Method / Path | Purpose |
|---|---|
| `POST /process-all` | Process all pending raw logs now. |
| `POST /reprocess/{activityLogId}` | Reprocess one specific log. |
| `POST /scheduler/trigger` | Manually run the cron job. |
| `GET /scheduler/status` | Scheduler metrics (`cronExpression`, queue size, processed/failed counts, …). |
| `GET /health` | Health check. |

### Internal microservice APIs (HMAC)
| Method / Path | Purpose |
|---|---|
| `GET /internal/processed-logs?userId=&sourceId=` | Processed logs for internal callers (e.g. `assessment_service` PDF export). |
| `POST /assessment` | **Ingestion endpoint** — receives the enriched assessment payload from `assessment_service` and creates the `raw` `activity_log` row. |

**Security split** (`ApplicationSecurityConfig`): `/llm-analytics/**` is open to authenticated users (JWT); `/llm-analytics/internal/**` and the `/assessment` ingestion require **HMAC** (service-to-service via `InternalClientUtils.makeHmacRequest`).

---

## 5. Capture & enrichment (assessment_service)

- **Trigger:** `LearnerAssessmentAttemptStatusManager.submitAssessment()` (online) and `AdminOfflineDataEntryManager` (offline data entry) call `AssessmentLLMAnalyticsService.sendAssessmentDataForAnalysisAsync(...)`, passing `assessment.getId()`.
- **Enrichment:** `AssessmentDataEnrichmentService.buildEnrichedAssessmentData()` assembles a compact-but-rich payload:
  - `assessment` block (id, name, type, total_marks, duration_minutes)
  - `attempt` block (id, user_id, start/submit time, duration_seconds)
  - `summary` (scored_marks, total_marks, result_status, percentage)
  - `class_context` (rank, percentile, participants, class-average marks/accuracy) via `LearnerReportService.buildComparisonData()`
  - `sections[]` → `questions[]` with **resolved question/option text**, the student's answer, the correct answer, per-question **status** (`CORRECT` / `INCORRECT` / `PARTIAL_CORRECT`), and marks.
  - Top-level `assessmentId`, `attemptId`, `instituteId` (**important** — see the gotcha in §10).
- **Delivery:** `AdminCoreServiceClient.saveAssessmentRawDataAsync()` POSTs to `/admin-core-service/llm-analytics/assessment` over HMAC, **fire-and-forget** — failures are logged and never block the learner's submission.

Quiz/question/assignment slide submissions follow the analogous path inside `LLMActivityAnalyticsService` (source types `llm_quiz` / `llm_question` / `llm_assignment`, with `source_id = slide_id`).

---

## 6. Processing (admin_core_service)

`ActivityLogProcessorService` (`features/learner_tracking/service/`):

- **Cron:** `@Scheduled(cron = "0 0 * * * *")` → `processRawActivityLogs()` runs **every hour at minute 0**.
- **Batching:** fetches up to `ENTRIES_PER_RUN = 20` rows with status in (`raw`,`failed`), oldest first, and processes them in batches of `BATCH_SIZE = 10`.
- **Per row** (`processActivityLog`): calls the LLM service, validates the returned insights, then `updateProcessedData(id, json, "processed")` — or `markAsFailed(id, error)` which writes `{"error":…,"timestamp":…}` into `processed_json` and sets status `failed`.
- **On-demand** (`processOnDemand(userId, sourceId)`): fetches the **latest** row for user+source; returns it immediately if already `processed`; otherwise runs the same `processActivityLog` synchronously and returns the updated row. The controller only surfaces it if it ended up `processed` (a `failed` row → empty response).

The hourly cron is the batch fallback; on-demand exists so a learner opening the report right after submitting doesn't have to wait up to an hour.

---

## 7. LLM details & `processed_json` shape

**Service:** `StudentAnalyticsLLMService` (`features/learner_tracking/service/`).

- **Provider:** OpenRouter — `https://openrouter.ai` `/api/v1/chat/completions`, Bearer `openrouter.api.key`.
- **Models:** `AIModelRegistryService.getModelPriority("analytics")` — priority list, tried in order; `MAX_RETRIES_PER_MODEL = 2` then fall back to the next model; all-fail → row marked `failed`.
- **Timeout:** `RESPONSE_TIMEOUT_SECONDS = 120`.
- **Format:** `response_format: {"type":"json_object"}`; system role = "expert educational data analyst…"; the prompt feeds the enriched `raw_json` and demands a single JSON object.
- **Source of truth:** the prompt instructs the model to use each question's `status` field (CORRECT/INCORRECT/PARTIAL_CORRECT) for correctness rather than re-grading.
- **Token usage** recorded via `AiTokenUsageService` (request type `ANALYTICS`).

**`processed_json` fields the model returns:**

| Field | Content |
|-------|---------|
| `performance_analysis` | 2–3 paragraph narrative (incl. class comparison if `class_context` present) |
| `strengths` / `weaknesses` | `{ topic: confidence% }` |
| `areas_of_improvement` | Markdown bullets |
| `improvement_path` | Markdown step-by-step study plan |
| `flashcards` | `[{ front, back }]` for missed concepts (≈5–10) |
| `confidence_estimation` | `{ overall_confidence, high_confidence_correct, high_confidence_wrong, low_confidence_correct, guessed_correct, insight }` |
| `topic_analysis` | `[{ topic, questions_count, correct, accuracy, avg_time_seconds, mastery_level }]` |
| `misconception_analysis` | `[{ question_summary, student_answer, correct_answer, misconception, remediation }]` |
| `blooms_taxonomy` | `{ remember:{total,correct}, understand, apply, analyze, evaluate, create }` |
| `behavioral_insights` | `{ time_management, difficulty_response, fatigue_indicator, skip_pattern }` |
| `recommended_learning_path` | `[{ priority, topic, current_level, target_level, suggestion, estimated_time }]` |

---

## 8. Frontend (learner dashboard)

**Route:** `/assessment/reports/ai-report/` — `frontend-learner-dashboard-app/src/routes/assessment/reports/ai-report/index.tsx`
Query params: `assessmentId` (required, used as `sourceId`), `assessmentName`, `attemptId` (optional, for comparison data).

**Load logic:**
1. Read `userId` from Capacitor Preferences.
2. `GET /llm-analytics/processed-logs?userId=&sourceId=assessmentId` → if a processed row exists, parse `processed_json` and render.
3. If empty/unparseable, show **"Generating your AI report…"** and `POST /llm-analytics/process-on-demand?userId=&sourceId=` (allow ~2 min for the LLM + DB write); on gateway timeout, re-fetch the processed logs once.
4. If still nothing, show **"Report Not Available"** (and "check back after ~1 hour", i.e. the next cron run).

**Display component:** `frontend-learner-dashboard-app/src/components/common/my-reports/ai-report-details-page.tsx` (`AIReportDetailsPage`) renders, in order: score overview tiles, **You vs Class** bars, leaderboard, performance analysis (Markdown), confidence estimation (circular chart + grid), **topic radar** + table, strengths/weaknesses, **Bloom's taxonomy** bars + table, misconception cards, behavioural insights grid, recommended learning path, areas/improvement-path Markdown, and a **flashcard carousel**. PDF export via `EXPORT_AI_REPORT` (`/assessment-service/assessment/learner/report/ai-pdf`).

**URLs:** `frontend-learner-dashboard-app/src/constants/urls.ts`
- `GET_AI_PROCESSED_LOGS` → `/admin-core-service/llm-analytics/processed-logs`
- `PROCESS_AI_REPORT_ON_DEMAND` → `/admin-core-service/llm-analytics/process-on-demand`
- `EXPORT_AI_REPORT` → `/assessment-service/assessment/learner/report/ai-pdf`

All client calls use the JWT `authenticatedAxiosInstance`.

---

## 9. How to use it

**As a learner (product flow):** submit an assessment → open its **AI Report** → if processing isn't done you'll see "Generating…" (on-demand kicks in) → read charts/insights → optionally download the PDF.

**As a developer / for testing:**
```bash
# Has it been processed yet?
curl "$BASE/admin-core-service/llm-analytics/processed-logs?userId=U&sourceId=ASSESSMENT_ID" -H "Authorization: Bearer $JWT"

# Force-generate now (synchronous, may take up to ~2 min)
curl -X POST "$BASE/admin-core-service/llm-analytics/process-on-demand?userId=U&sourceId=ASSESSMENT_ID" -H "Authorization: Bearer $JWT"

# Dev-only: run the whole queue / one row / the scheduler
curl -X POST "$BASE/admin-core-service/llm-analytics/process-all"
curl -X POST "$BASE/admin-core-service/llm-analytics/reprocess/{activityLogId}"
curl -X POST "$BASE/admin-core-service/llm-analytics/scheduler/trigger"
curl     "$BASE/admin-core-service/llm-analytics/scheduler/status"
```
**Prereq:** a `raw` `activity_log` row must exist for that `user_id` + `source_id`, which only happens after a submission flowed through `assessment_service` enrichment → HMAC ingestion. No raw row → on-demand returns empty.

---

## 10. Gotchas & operational notes

- **`source_id` population contract (was a bug, fixed 2026-06-18).** The frontend looks up reports by `findByUserIdAndSourceIdAndStatusProcessed`. If the enrichment payload omits the assessment id, `source_id` saves as `null` and the learner gets "Report Not Available" even though `processed_json` exists. `LLMActivityAnalyticsService.extractAssessmentId()` reads nested `assessment.id` then falls back to root `assessmentId` (same pattern for `attemptId` / `userId`). The fix sets the id on **both** paths — nested `assessment.id`/`attempt.id` **and** root `assessmentId`/`attemptId`/`instituteId`. **Forward-only**: historical rows whose `raw_json` never contained the id can't be backfilled.
- **Failed rows self-heal:** the cron's fetch includes `failed` status, so a transient LLM failure is retried next hour. On-demand also re-runs `raw`/`failed` rows.
- **No `institute_id` on `activity_log`** — don't filter by it at the table level.
- **HMAC required for ingestion** — `assessment_service` must be a registered HMAC client; a broken signature silently drops the analytics (submission still succeeds, fire-and-forget).
- **Build notes (admin_core_service):** `common_service` must be `mvn install`-ed first, and a full `mvn compile` may fail on pre-existing, unrelated `audience`/leads custom-field errors — not in this feature. `assessment_service` compile is fine; only the sentry source-bundle upload step needs a SENTRY token.

---

## 11. Relationship to Student Analysis Report

| | LLM Analysis (this doc) | [Student Analysis Report](./STUDENT_ANALYSIS_REPORT.md) |
|---|---|---|
| Audience | **Learner** | **Admin / teacher** |
| Scope | One **assessment/slide attempt** | One **learner over a date range** |
| Trigger | Auto on submit → **hourly cron** + on-demand | Admin clicks generate (`@Async`, no cron) |
| Controller | `/admin-core-service/llm-analytics` | `/admin-core-service/v1/student-analysis` |
| Storage | `activity_log` (`raw_json` / `processed_json`) | `student_analysis_process`, `user_linked_data` |
| Output | rich `processed_json` (Bloom's, flashcards, misconceptions, radar…) | `StudentReportData` (6 Markdown sections + strengths/weaknesses) |

**The link:** this pipeline's `processed_json` is an **input** to the Student Analysis Report — that feature pulls the last 5 *processed* `activity_log` rows when building its prompt. Both call OpenRouter via `AIModelRegistryService.getModelPriority("analytics")`. Think of LLM Analysis as the per-attempt micro-analysis and Student Analysis Report as the per-learner macro-rollup layered on top.

---

## 12. Quick file reference

```
assessment_service/.../features/learner_assessment/service/
  AssessmentLLMAnalyticsService.java        # triggers send on submit
  AssessmentDataEnrichmentService.java      # builds enriched raw_json (+ ids — see gotcha)
assessment_service/.../features/client/AdminCoreServiceClient.java   # HMAC POST /llm-analytics/assessment

admin_core_service/.../features/learner_tracking/
  controller/LearnerLLMAnalyticsController.java     # all /llm-analytics endpoints
  service/LLMActivityAnalyticsService.java          # ingest raw rows (assessment + slide types)
  service/ActivityLogProcessorService.java          # @Scheduled hourly cron + processOnDemand
  service/StudentAnalyticsLLMService.java           # OpenRouter call, prompt, fallback
  entity/ActivityLog.java
  repository/ActivityLogRepository.java
admin_core_service/.../db/migration/V62__Add_status_and_json_columns_to_activity_log.sql

frontend-learner-dashboard-app/src/
  routes/assessment/reports/ai-report/index.tsx
  components/common/my-reports/ai-report-details-page.tsx
  constants/urls.ts                                 # GET_AI_PROCESSED_LOGS, PROCESS_AI_REPORT_ON_DEMAND, EXPORT_AI_REPORT
```
