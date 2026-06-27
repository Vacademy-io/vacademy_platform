# Student Analysis Report

> Admin-facing feature that generates a holistic, LLM-written performance report for a **single learner over a chosen date range**. Lives in `admin_core_service` under the `student_analysis` feature package and is rendered in the admin dashboard's student side-panel.

**Related doc:** [LLM Analysis](./LLM_ANALYSIS.md) — the per-assessment AI pipeline whose `processed_json` output is one of the inputs this report aggregates. The two features are different things (see [Relationship to LLM Analysis](#relationship-to-llm-analysis)) and are easy to confuse.

---

## 1. What it is

The Student Analysis Report answers: *"How is this particular student doing over this period, and what should we do about it?"*

An admin (teacher / institute operator) opens a learner's profile, picks a **start and end date**, and clicks generate. The backend gathers everything it knows about that learner in that window — login/session stats, recently processed activity insights, and learner operations — sends it to an LLM, and stores a structured, Markdown-rich report. The admin reads it across tabbed sections (Efforts, Overview, Topics, Remedial) and can manually curate the learner's running list of **strengths and weaknesses**.

It is:
- **Per-learner** and **date-range scoped** (not per-assessment).
- **Admin-initiated / on-demand** (no cron; there is no automatic generation).
- **Asynchronous** — the API returns a `processId` immediately; the report is produced in the background and polled for.
- **Persistent** — every generated report is stored and listed historically.

It is **not** the learner-facing AI report shown after an assessment — that is the separate [LLM Analysis](./LLM_ANALYSIS.md) feature.

---

## 2. Architecture at a glance

```
Admin UI (frontend-admin-dashboard)
  │  student side-panel → "Student Reports" tab
  │
  ├─ POST /initiate ───────────────► StudentAnalysisController
  │                                     └─ create student_analysis_process (PENDING)
  │                                     └─ processorService.processStudentAnalysis(id)  [@Async]
  │                                            │
  │                                            ├─ StudentAnalysisDataService.collectStudentData()
  │                                            │     ├─ AuthService login/session stats
  │                                            │     ├─ last 5 processed activity_log rows (processed_json)
  │                                            │     └─ learner_operation rows in date range
  │                                            │
  │                                            ├─ StudentReportLLMService.generateStudentReport()
  │                                            │     └─ OpenRouter (model priority "analytics", fallback)
  │                                            │
  │                                            ├─ save report_json + status=COMPLETED
  │                                            └─ updateUserLinkedData() → user_linked_data
  │
  ├─ GET /report/{processId} ──────► poll status, return StudentReportData when COMPLETED
  ├─ GET /reports/user/{userId} ───► paginated history of completed reports
  ├─ GET /user-linked-data/{userId}► current strengths/weaknesses
  └─ PUT /user-linked-data/{userId}► manually add / update / delete strengths & weaknesses
```

**Backend package:** `admin_core_service/src/main/java/vacademy/io/admin_core_service/features/student_analysis/`

| Layer | Class |
|-------|-------|
| Controller | `controller/StudentAnalysisController.java` |
| Orchestrator (async) | `service/StudentAnalysisProcessorService.java` |
| Data aggregation | `service/StudentAnalysisDataService.java` |
| LLM call | `service/StudentReportLLMService.java` |
| Entities | `entity/StudentAnalysisProcess.java`, `entity/UserLinkedData.java` |
| Repositories | `repository/StudentAnalysisProcessRepository.java`, `repository/UserLinkedDataRepository.java` |
| DTOs | `dto/StudentAnalysisRequest.java`, `dto/StudentReportData.java`, `dto/StudentAnalysisData.java`, `dto/StudentAnalysisReportResponse.java`, `dto/StudentAnalysisReportListResponse.java`, `dto/StudentAnalysisReportListItem.java`, `dto/StudentAnalysisInitiateResponse.java`, `dto/StudentLoginStatsDto.java`, `dto/LearnerOperationSummary.java`, `dto/UserLinkedDataUpdateRequest.java` |

---

## 3. Data model

Created by migration **`V66__Create_student_analysis_tables.sql`** (`admin_core_service/src/main/resources/db/migration/`).

### `student_analysis_process` — one row per generated report

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(255) PK | UUID |
| `user_id` | VARCHAR(255) NOT NULL | the learner the report is about |
| `institute_id` | VARCHAR(255) NOT NULL | |
| `start_date_iso` | DATE NOT NULL | window start (YYYY-MM-DD) |
| `end_date_iso` | DATE NOT NULL | window end (YYYY-MM-DD) |
| `status` | VARCHAR(50) NOT NULL DEFAULT `'PENDING'` | `PENDING` → `PROCESSING` → `COMPLETED` / `FAILED` |
| `report_json` | TEXT | serialized `StudentReportData` (populated when COMPLETED) |
| `error_message` | TEXT | populated when FAILED |
| `created_at` / `updated_at` | TIMESTAMP | `updated_at` maintained by a `BEFORE UPDATE` trigger |

Indexes on `user_id`, `status`, `created_at`.

### `user_linked_data` — running strengths & weaknesses per learner

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(255) PK | UUID |
| `user_id` | VARCHAR(255) NOT NULL | |
| `type` | VARCHAR(50) NOT NULL | `'strength'` or `'weakness'` |
| `data` | VARCHAR(255) NOT NULL | topic name (e.g. `algebra`, `p-block`) |
| `percentage` | INTEGER | score 0–100 |
| `created_at` / `updated_at` | TIMESTAMP | trigger-maintained |

Indexes on `user_id` and `(user_id, type)`.

This table is **cumulative across reports**, not per-report. Each generation merges its detected strengths/weaknesses in (dedupe is case-insensitive, keeping the highest percentage), and admins can hand-edit it via the PUT endpoint. Convention used in the LLM prompt: **70–100 = strength, 0–50 = weakness**.

---

## 4. The report payload — `StudentReportData`

`dto/StudentReportData.java`, serialized with `SnakeCaseStrategy`, so JSON keys are snake_case:

| JSON field | Type | Content |
|------------|------|---------|
| `learning_frequency` | string (Markdown) | how often / regularly the student engaged |
| `progress` | string (Markdown) | overall progress narrative |
| `student_efforts` | string (Markdown) | effort assessment |
| `topics_of_improvement` | string (Markdown) | topics trending up |
| `topics_of_degradation` | string (Markdown) | topics trending down |
| `remedial_points` | string (Markdown) | concrete action items |
| `strengths` | `Map<String,Integer>` | topic → confidence % |
| `weaknesses` | `Map<String,Integer>` | topic → confidence % |

The Markdown fields are rendered with `react-markdown` (GFM) on the admin side, so they can contain headers, tables, lists, and emojis.

---

## 5. API reference

Base path: **`/admin-core-service/v1/student-analysis`** — all JWT-authenticated (admin user via `@RequestAttribute("user")`).

### POST `/initiate`
Start an async report. Returns immediately.
```jsonc
// request (snake_case)
{ "user_id": "...", "institute_id": "...", "start_date_iso": "2026-06-01", "end_date_iso": "2026-06-24" }
// response
{ "process_id": "uuid", "status": "PENDING", "message": "..." }
```

### GET `/report/{processId}`
Poll a single process. While running, returns just status; when `COMPLETED`, embeds the `report` object (`StudentReportData`); when `FAILED`, returns `error_message`.
```jsonc
{ "process_id": "uuid", "status": "COMPLETED", "report": { /* StudentReportData */ }, "error_message": null }
```

### GET `/reports/user/{userId}?page=0&size=10`
Paginated history of **completed** reports for a learner (newest first). Each item carries its date range, timestamps, and embedded `report`. Returns `current_page`, `total_pages`, `total_elements`, `page_size`.

### GET `/user-linked-data/{userId}`
Returns the learner's full list of `UserLinkedData` (strengths + weaknesses).

### PUT `/user-linked-data/{userId}`
Bulk add/update/delete. Body is an array of operations:
```jsonc
[
  { "action": "add",    "type": "strength", "data": "Algebra",  "percentage": 88 },
  { "action": "update", "id": "uuid", "data": "Geometry", "percentage": 72 },
  { "action": "delete", "id": "uuid" }
]
```

---

## 6. Generation flow (backend)

1. **Initiate** (`StudentAnalysisController.initiateAnalysis`) — persists a `student_analysis_process` row (`PENDING`) and fires `processorService.processStudentAnalysis(processId)` asynchronously, returning the `processId`.
2. **Collect** (`StudentAnalysisDataService.collectStudentData`) builds a `StudentAnalysisData` from:
   - **Login / session stats** — via `AuthService` (total logins, last login, avg session duration, total active minutes).
   - **Recent processed activity** — the last **5** processed `activity_log` rows (`findProcessedLogsForAnalysis()`), reading their `processed_json` — i.e. it reuses the output of the [LLM Analysis](./LLM_ANALYSIS.md) pipeline.
   - **Learner operations** — `learner_operation` rows in the date range (source, operation, value, timestamp).
3. **Process** (`StudentAnalysisProcessorService.processStudentAnalysis`) flips status to `PROCESSING`, calls the LLM service (with a ~70s timeout), serializes the result into `report_json`, merges strengths/weaknesses into `user_linked_data`, and sets `COMPLETED` (or `FAILED` + `error_message`).
4. **LLM** (`StudentReportLLMService.generateStudentReport`) — see below.

### Status lifecycle
`PENDING` → `PROCESSING` → `COMPLETED` | `FAILED`. (`ERROR` is also returned by the controller for request-level failures that never created/over-wrote a process.)

---

## 7. LLM details

- **Provider:** OpenRouter (`https://openrouter.ai`, `/api/v1/chat/completions`), Bearer token from `openrouter.api.key`.
- **Model selection:** `AIModelRegistryService.getModelPriority("analytics")` — a priority list tried in order, with retries per model and fallback to the next on failure (shared with the LLM Analysis feature; same `"analytics"` use-case key).
- **Output format:** `response_format: {"type":"json_object"}` — the prompt demands a JSON object whose keys map 1:1 to `StudentReportData`.
- **System role:** "expert educational analyst specializing in comprehensive student performance evaluation."
- **Prompt inputs:** date range, login stats, the processed activity logs, learner-operations summary, and the learner's *existing* strengths/weaknesses (so the model refines rather than resets them).
- **Robustness:** response parsing strips ```` ```json ```` fences; per-model retries; model fallback; token usage recorded via `AiTokenUsageService` (request type `ANALYTICS`).

---

## 8. Frontend (admin dashboard)

**Location:** `frontend-admin-dashboard/src/routes/manage-students/students-list/-components/students-list/student-side-view/student-reports/`

| File | Role |
|------|------|
| `student-reports.tsx` | Main tab. Lists reports grouped by status (Processing / Completed / Failed), stat tiles, pagination (5/page), "New Report" + "Check Status" buttons. Tracks in-flight `process_id`s in `sessionStorage` (`student_analysis_processes`). |
| `InitiateReportDialog.tsx` | Date-range picker → calls `initiateStudentAnalysis`. |
| `StudentReportDetailsDialog.tsx` | Renders a completed report across tabs: **Efforts** (efforts + frequency), **Overview** (progress), **Topics** (strengths/weaknesses progress bars + improvement/degradation), **Remedial** (action items). Uses `react-markdown` + GFM. |

**Service:** `frontend-admin-dashboard/src/services/student-analysis.ts`
- `initiateStudentAnalysis(payload, instituteId)` → POST `/initiate`
- `getStudentReports(userId, instituteId, page, size)` → GET `/reports/user/{userId}`
- `getStudentReport(processId)` → GET `/report/{processId}`

**Types:** `frontend-admin-dashboard/src/types/student-analysis.ts` (`InitiateAnalysisRequest`, `StudentReportData`, `StudentReport`).

> The learner dashboard also has a thin reader (`frontend-learner-dashboard-app/src/services/student-reports-api.ts` + `stores/report-store.ts`) that fetches the same reports for the logged-in user, but generation/curation is an admin action.

### Polling pattern
`POST /initiate` returns a `processId`; the UI stores it and polls `GET /report/{processId}` (manually via "Check Status", and on list refresh) until status leaves `PROCESSING`. There is **no** websocket/push — it is poll-based.

---

## 9. How to use it

**As an admin (product flow):**
1. Open a student in **Manage Students** → side panel → **Student Reports**.
2. **New Report** → choose start/end dates → generate.
3. Watch the row move Processing → Completed (use **Check Status** if impatient).
4. Open the report; read Efforts / Overview / Topics / Remedial.
5. Optionally hand-curate the student's strengths/weaknesses (these persist in `user_linked_data` and feed future generations).

**As a developer (calling the API directly):**
```bash
# 1. kick off
curl -X POST $BASE/admin-core-service/v1/student-analysis/initiate \
  -H "Authorization: Bearer $JWT" -H 'Content-Type: application/json' \
  -d '{"user_id":"U","institute_id":"I","start_date_iso":"2026-06-01","end_date_iso":"2026-06-24"}'
# → { "process_id": "P", "status": "PENDING" }

# 2. poll
curl $BASE/admin-core-service/v1/student-analysis/report/P -H "Authorization: Bearer $JWT"
# repeat until status == COMPLETED, then read .report
```

**Prerequisites for a *useful* report:** the learner needs data in the window — logins, processed `activity_log` rows (i.e. they took assessments/quizzes that the LLM Analysis pipeline processed), and/or learner operations. With an empty window the LLM has little to work with.

---

## 10. Relationship to LLM Analysis

These are **two separate features that share infrastructure**:

| | Student Analysis Report (this doc) | [LLM Analysis](./LLM_ANALYSIS.md) |
|---|---|---|
| Audience | Admin / teacher | Learner |
| Scope | One learner over a **date range** | One **assessment/slide attempt** |
| Trigger | Admin clicks generate (`@Async`, no cron) | Auto on submit → **hourly cron** + on-demand |
| Controller | `/admin-core-service/v1/student-analysis` | `/admin-core-service/llm-analytics` |
| Storage | `student_analysis_process`, `user_linked_data` | `activity_log` (`raw_json` / `processed_json`) |
| Output shape | `StudentReportData` (6 Markdown fields + strengths/weaknesses) | rich `processed_json` (Bloom's, flashcards, misconceptions, etc.) |

**The link:** Student Analysis Report *consumes* the LLM Analysis output — `StudentAnalysisDataService` pulls the last 5 **processed** `activity_log` rows and feeds their `processed_json` into the report prompt. Both call OpenRouter through `AIModelRegistryService.getModelPriority("analytics")`. So LLM Analysis is the per-attempt micro-analysis; Student Analysis Report is the per-learner macro-rollup built (partly) on top of it.

---

## 11. Quick file reference

```
admin_core_service/.../features/student_analysis/
  controller/StudentAnalysisController.java        # 5 endpoints
  service/StudentAnalysisProcessorService.java     # @Async orchestrator, status, linked-data merge
  service/StudentAnalysisDataService.java          # gathers login stats + activity logs + operations
  service/StudentReportLLMService.java             # OpenRouter call + prompt
  entity/StudentAnalysisProcess.java
  entity/UserLinkedData.java
  dto/StudentReportData.java                       # the report shape
admin_core_service/.../db/migration/V66__Create_student_analysis_tables.sql

frontend-admin-dashboard/src/
  routes/.../student-side-view/student-reports/    # student-reports.tsx, InitiateReportDialog.tsx, StudentReportDetailsDialog.tsx
  services/student-analysis.ts
  types/student-analysis.ts
```
